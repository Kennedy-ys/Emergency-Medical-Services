import { describe, expect, it } from 'vitest';
import { isPushServiceUrl, messagesFor } from '../../../supabase/functions/push-notify/messages.js';

const booking = (over = {}) => ({
  id: 'b1',
  patient_id: 'patient',
  driver_id: null,
  status: 'pending',
  ...over,
});
const audiences = (event, b) => messagesFor(event, b).map((message) => message.audience);

describe('messagesFor', () => {
  it('offers a new request to drivers on duty only', () => {
    const out = messagesFor(
      { actor_id: 'patient', from_status: null, to_status: 'pending' },
      booking()
    );
    expect(out).toHaveLength(1);
    expect(out[0].audience).toBe('drivers_on_duty');
    expect(out[0].payload.url).toBe('/driver');
    expect(out[0].payload.urgent).toBe(true);
    expect(out[0].ttl).toBeLessThanOrEqual(120);
  });

  it('says nothing when the booking has already moved on', () => {
    expect(
      messagesFor(
        { actor_id: 'patient', from_status: null, to_status: 'pending' },
        booking({ status: 'assigned', driver_id: 'driver' })
      )
    ).toEqual([]);
  });

  it('tells the patient, not the driver, when a driver accepts', () => {
    const out = messagesFor(
      { actor_id: 'driver', from_status: 'pending', to_status: 'assigned' },
      booking({ status: 'assigned', driver_id: 'driver' })
    );
    expect(out.map((message) => message.audience)).toEqual(['patient']);
    expect(out[0].payload.url).toBe('/track/b1');
  });

  it('tells both when a dispatcher assigns the trip', () => {
    expect(
      audiences(
        { actor_id: 'admin', from_status: 'pending', to_status: 'assigned' },
        booking({ status: 'assigned', driver_id: 'driver' })
      )
    ).toEqual(['patient', 'driver']);
  });

  it('offers a released request again and tells the patient', () => {
    expect(
      audiences({ actor_id: 'driver', from_status: 'assigned', to_status: 'pending' }, booking())
    ).toEqual(['drivers_on_duty', 'patient']);
  });

  it('tells the patient when the ambulance arrives, and nothing after that', () => {
    const onTrip = (status) => booking({ status, driver_id: 'driver' });
    expect(
      audiences(
        { actor_id: 'driver', from_status: 'assigned', to_status: 'arrived_at_patient' },
        onTrip('arrived_at_patient')
      )
    ).toEqual(['patient']);
    expect(
      audiences(
        {
          actor_id: 'driver',
          from_status: 'arrived_at_patient',
          to_status: 'en_route_to_hospital',
        },
        onTrip('en_route_to_hospital')
      )
    ).toEqual([]);
    expect(
      audiences(
        { actor_id: 'driver', from_status: 'en_route_to_hospital', to_status: 'completed' },
        onTrip('completed')
      )
    ).toEqual([]);
  });

  it('tells the other side about a cancellation, never the one who cancelled', () => {
    const cancelled = (driverId) => booking({ status: 'cancelled', driver_id: driverId });
    const event = (actor) => ({ actor_id: actor, from_status: 'assigned', to_status: 'cancelled' });
    expect(audiences(event('patient'), cancelled('driver'))).toEqual(['driver']);
    expect(audiences(event('admin'), cancelled('driver'))).toEqual(['driver', 'patient']);
    expect(audiences(event('patient'), cancelled(null))).toEqual([]);
    expect(audiences(event('admin'), cancelled(null))).toEqual(['patient']);
  });

  it('never puts personal details in a notification', () => {
    const b = { ...booking(), contact_name: 'Ada Obi', contact_phone: '08030000000', notes: 'x' };
    const text = JSON.stringify(
      messagesFor({ actor_id: 'patient', from_status: null, to_status: 'pending' }, b)
    );
    expect(text).not.toMatch(/Ada|0803/);
  });
});

describe('isPushServiceUrl', () => {
  it('accepts the push services browsers use', () => {
    expect(isPushServiceUrl('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isPushServiceUrl('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true);
    expect(isPushServiceUrl('https://web.push.apple.com/abc')).toBe(true);
    expect(isPushServiceUrl('https://wns2-by3p.notify.windows.com/w/?token=abc')).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isPushServiceUrl('https://example.org/hook')).toBe(false);
    expect(isPushServiceUrl('http://fcm.googleapis.com/fcm/send/abc')).toBe(false);
    expect(isPushServiceUrl('https://fcm.googleapis.com.evil.test/x')).toBe(false);
    expect(isPushServiceUrl('not a url')).toBe(false);
  });
});
