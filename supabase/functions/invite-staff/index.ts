// Invites a technician or dispatcher by email and gives the new account its role.
//
// Runs on Supabase Edge Functions. Only this function may set a staff role: it
// holds the service role key, which Supabase provides to functions as an
// environment variable. That key must never appear in the web app or the repo.
//
// Deploy:  supabase functions deploy invite-staff
// The caller's sign-in token is checked here, so keep "Verify JWT" on.

import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const answer = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

const INVITABLE = ['technician', 'admin'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return answer(405, { error: 'method_not_allowed' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const authorization = req.headers.get('Authorization') ?? '';

  // Who is asking? Read with their own token, so the usual access rules apply.
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: caller } = await asCaller.auth.getUser();
  if (!caller?.user) return answer(401, { error: 'not_signed_in' });
  const { data: me } = await asCaller
    .from('profiles')
    .select('role')
    .eq('id', caller.user.id)
    .maybeSingle();
  if (me?.role !== 'admin') return answer(403, { error: 'not_admin' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return answer(400, { error: 'invalid_input' });
  }
  const email = String(body.email ?? '').trim().toLowerCase();
  const fullName = String(body.full_name ?? '').trim();
  const role = String(body.role ?? '');
  if (!EMAIL.test(email) || fullName.length < 2 || fullName.length > 120 || !INVITABLE.includes(role)) {
    return answer(400, { error: 'invalid_input' });
  }

  const asService = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // The link in the email returns to the app the dispatcher is using. Supabase
  // only honours addresses on the project's redirect allow-list.
  const origin = req.headers.get('Origin');
  const { data: invited, error: inviteError } = await asService.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: origin ? `${origin}/staff/welcome` : undefined,
  });
  if (inviteError || !invited?.user) {
    const taken = inviteError?.code === 'email_exists' || inviteError?.status === 422;
    if (!taken) console.error('invite failed', inviteError?.message);
    return answer(taken ? 409 : 500, { error: taken ? 'already_registered' : 'invite_failed' });
  }

  const { error: roleError } = await asService
    .from('profiles')
    .update({ role, full_name: fullName })
    .eq('id', invited.user.id);
  if (roleError) {
    // Do not leave an account behind that looks invited but has no staff access.
    console.error('setting role failed', roleError.message);
    await asService.auth.admin.deleteUser(invited.user.id);
    return answer(500, { error: 'invite_failed' });
  }

  return answer(200, { id: invited.user.id });
});
