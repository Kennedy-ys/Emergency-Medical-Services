// Sends push notifications about a change to a booking.
//
// Called by the database (trigger booking_events_push) with { "event_id": n }.
// Everything else is read from the database here, and the event is marked as
// notified in the same step that claims it, so a repeated or made-up call sends
// nothing. That is why this function is deployed without sign-in checking:
//
//   supabase functions deploy push-notify --no-verify-jwt
//
// Secrets it needs (supabase secrets set ...), none of which belong in the repo:
//   VAPID_PUBLIC_KEY   the same value the web app has as VITE_VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY  its private half
//   VAPID_SUBJECT      a contact address for push services, "mailto:..." or "https://..."

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { isPushServiceUrl, messagesFor } from './messages.js';

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Events older than this are not announced: the moment has passed. */
const MAX_AGE_MS = 5 * 60_000;

type Subscription = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  let eventId: number;
  try {
    eventId = Number((await req.json())?.event_id);
  } catch {
    return json(400, { error: 'invalid_input' });
  }
  if (!Number.isSafeInteger(eventId) || eventId <= 0) return json(400, { error: 'invalid_input' });

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT');
  if (!publicKey || !privateKey || !subject) {
    console.error('push keys are not set');
    return json(500, { error: 'not_configured' });
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Claim the event. Only one caller ever gets the row back.
  const { data: event, error: claimError } = await db
    .from('booking_events')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', eventId)
    .is('notified_at', null)
    .gte('created_at', new Date(Date.now() - MAX_AGE_MS).toISOString())
    .select('id, booking_id, actor_id, from_status, to_status')
    .maybeSingle();
  if (claimError) {
    console.error('claiming event failed', claimError.message);
    return json(500, { error: 'failed' });
  }
  if (!event) return json(200, { sent: 0 });

  const { data: booking, error: bookingError } = await db
    .from('bookings')
    .select('id, patient_id, driver_id, status')
    .eq('id', event.booking_id)
    .maybeSingle();
  if (bookingError || !booking) {
    console.error('loading booking failed', bookingError?.message);
    return json(500, { error: 'failed' });
  }

  let sent = 0;
  let removed = 0;

  for (const message of messagesFor(event, booking)) {
    let userIds: string[] = [];
    if (message.audience === 'patient') {
      userIds = [booking.patient_id];
    } else if (message.audience === 'driver') {
      userIds = booking.driver_id ? [booking.driver_id] : [];
    } else {
      // Approved drivers on duty and free, except those who passed on this request.
      const [{ data: drivers }, { data: declines }] = await Promise.all([
        db.from('drivers').select('id').eq('approval_status', 'approved').eq('availability', 'available'),
        db.from('booking_declines').select('driver_id').eq('booking_id', booking.id),
      ]);
      const declined = new Set((declines ?? []).map((row) => row.driver_id));
      userIds = (drivers ?? []).map((row) => row.id).filter((id) => !declined.has(id));
    }
    if (userIds.length === 0) continue;

    const { data: subscriptions } = await db
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .in('user_id', userIds);

    const body = JSON.stringify(message.payload);
    const dead: string[] = [];

    await Promise.all(
      ((subscriptions ?? []) as Subscription[]).map(async (sub) => {
        if (!isPushServiceUrl(sub.endpoint)) {
          dead.push(sub.id);
          return;
        }
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
            { TTL: message.ttl, urgency: message.payload.urgent ? 'high' : 'normal' }
          );
          sent += 1;
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode;
          // The browser dropped this subscription: stop sending to it.
          if (status === 404 || status === 410) dead.push(sub.id);
          else console.error('push failed', status ?? String(err));
        }
      })
    );

    if (dead.length > 0) {
      const { error } = await db.from('push_subscriptions').delete().in('id', dead);
      if (!error) removed += dead.length;
    }
  }

  return json(200, { sent, removed });
});
