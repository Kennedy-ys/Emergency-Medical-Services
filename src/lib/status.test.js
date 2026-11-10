import { describe, expect, it } from 'vitest';
import {
  NEXT_TRIP_ACTION,
  STATUS,
  STEPS,
  TRIP_STATUSES,
  errorText,
  isFinished,
  isOnTrip,
  patientCanCancel,
} from './status';
import { requestSchema } from '../features/booking/requestSchema';

const ALL = [
  'pending',
  'assigned',
  'arrived_at_patient',
  'en_route_to_hospital',
  'completed',
  'cancelled',
];

describe('status map', () => {
  it('describes every status the database can hold', () => {
    expect(Object.keys(STATUS).sort()).toEqual([...ALL].sort());
    for (const status of ALL) {
      expect(STATUS[status].label).toBeTruthy();
      expect(STATUS[status].tripLabel).toBeTruthy();
      expect(STATUS[status].tone).toBeTruthy();
    }
  });

  it('gives every live status a progress step that exists', () => {
    for (const status of ['pending', ...TRIP_STATUSES]) {
      expect(STEPS[STATUS[status].step]).toBeTruthy();
    }
  });

  it('lets the patient cancel only before the ambulance arrives', () => {
    expect(ALL.filter(patientCanCancel)).toEqual(['pending', 'assigned']);
  });

  it('gives the driver one next action for each trip status', () => {
    expect(Object.keys(NEXT_TRIP_ACTION)).toEqual(TRIP_STATUSES);
    expect(ALL.filter(isOnTrip)).toEqual(TRIP_STATUSES);
    expect(ALL.filter(isFinished)).toEqual(['completed', 'cancelled']);
  });

  it('turns server error codes into plain words, with a fallback', () => {
    expect(errorText('booking_already_taken')).toMatch(/another driver/i);
    expect(errorText('something_new')).toBe('Something went wrong. Try again.');
  });
});

describe('request form rules', () => {
  const valid = { contactName: 'Ada Obi', contactPhone: '0803 123 4567', hospitalId: 'nearest' };

  it('accepts local and international phone formats and stores digits only', () => {
    expect(requestSchema.parse(valid).contactPhone).toBe('08031234567');
    expect(
      requestSchema.parse({ ...valid, contactPhone: '+234 (803) 123-4567' }).contactPhone
    ).toBe('+2348031234567');
  });

  it('rejects a missing name and an impossible phone number', () => {
    expect(requestSchema.safeParse({ ...valid, contactName: ' ' }).success).toBe(false);
    expect(requestSchema.safeParse({ ...valid, contactPhone: '12345' }).success).toBe(false);
    expect(requestSchema.safeParse({ ...valid, contactPhone: 'call me' }).success).toBe(false);
  });

  it('limits notes to 500 characters', () => {
    expect(requestSchema.safeParse({ ...valid, notes: 'x'.repeat(501) }).success).toBe(false);
    expect(requestSchema.safeParse({ ...valid, notes: 'Chest pain' }).success).toBe(true);
  });
});
