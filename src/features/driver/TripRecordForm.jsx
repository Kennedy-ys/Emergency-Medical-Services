import { useId, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Field from '../../components/ui/Field';
import { useSaveTripRecord } from './api';

const schema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Enter the name of the patient.')
    .max(120, 'Name is too long.'),
  age: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || (/^\d{1,3}$/.test(value) && Number(value) <= 130),
      'Enter an age in years, or leave this empty.'
    ),
  gender: z.enum(['', 'Female', 'Male']),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^\+?[\d\s()-]{7,20}$/.test(value),
      'Enter a valid phone number, or leave this empty.'
    ),
  address: z.string().trim().max(200, 'Address is too long.'),
  notes: z.string().trim().max(2000, 'Keep the notes under 2,000 characters.'),
});

/** The record a crew writes after a trip. `trip` is the completed request it belongs to. */
export default function TripRecordForm({ trip, userId, onDone }) {
  const save = useSaveTripRecord();
  // One id for this form, so pressing Save twice or retrying never stores two records.
  const requestId = useRef(crypto.randomUUID());
  const genderId = useId();
  const notesId = useId();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      age: '',
      gender: '',
      phone: trip.contact_phone ?? '',
      address: trip.pickup_address ?? '',
      notes: '',
    },
  });

  const submit = (values) =>
    save.mutate(
      {
        clientRequestId: requestId.current,
        bookingId: trip.id,
        userId,
        fullName: values.fullName,
        age: values.age === '' ? null : Number(values.age),
        gender: values.gender || null,
        phone: values.phone || null,
        address: values.address || null,
        notes: values.notes || null,
        lat: trip.pickup_lat,
        lng: trip.pickup_lng,
      },
      {
        onSuccess: () => {
          toast.success('Trip record saved.');
          onDone();
        },
        onError: () => toast.error('Could not save. Check your connection and try again.'),
      }
    );

  return (
    <Card>
      <h2 className="text-lg font-semibold text-gray-900">Trip record</h2>
      <p className="text-gray-600">
        For the trip requested by {trip.contact_name}. Dispatch can read this record.
      </p>
      <form onSubmit={handleSubmit(submit)} noValidate className="mt-3 space-y-3">
        <Field
          label="Full name of the patient"
          hint="The patient may not be the person who made the request."
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Age in years (optional)"
            inputMode="numeric"
            error={errors.age?.message}
            {...register('age')}
          />
          <div>
            <label htmlFor={genderId} className="mb-1 block font-medium text-gray-900">
              Sex (optional)
            </label>
            <select
              id={genderId}
              className="block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900"
              {...register('gender')}
            >
              <option value="">Not recorded</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
            </select>
          </div>
        </div>
        <Field
          label="Phone (optional)"
          type="tel"
          error={errors.phone?.message}
          {...register('phone')}
        />
        <Field
          label="Address (optional)"
          error={errors.address?.message}
          {...register('address')}
        />
        <div>
          <label htmlFor={notesId} className="mb-1 block font-medium text-gray-900">
            What you found and what you did
          </label>
          <textarea
            id={notesId}
            rows={4}
            aria-invalid={errors.notes ? true : undefined}
            className="block w-full rounded-lg border border-gray-300 bg-white p-3 text-base text-gray-900"
            {...register('notes')}
          />
          {errors.notes && <p className="mt-1 text-sm text-red-700">{errors.notes.message}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={save.isPending}>
            Save record
          </Button>
          <Button variant="secondary" disabled={save.isPending} onClick={onDone}>
            Not now
          </Button>
        </div>
      </form>
    </Card>
  );
}
