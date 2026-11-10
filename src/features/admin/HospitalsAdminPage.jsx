import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import StaffShell from '../../components/layout/StaffShell';
import LocationPicker from '../../components/map/LocationPicker';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Field from '../../components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { ADMIN_NAV, useAllHospitals, useArchiveHospital, useSaveHospital } from './api';
import { reportFailure } from './shared';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the hospital name.').max(120, 'Name is too long.'),
  address: z.string().trim().max(200, 'Address is too long.'),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^\+?[\d\s()-]{7,20}$/.test(value),
      'Enter a valid phone number, or leave this empty.'
    ),
});

function HospitalForm({ hospital, onDone }) {
  const save = useSaveHospital();
  const [point, setPoint] = useState(hospital ? { lat: hospital.lat, lng: hospital.lng } : null);
  const [pointError, setPointError] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: hospital?.name ?? '',
      address: hospital?.address ?? '',
      phone: hospital?.phone ?? '',
    },
  });

  const submit = (values) => {
    if (!point) {
      setPointError('Tap the map to mark where the hospital is.');
      return;
    }
    save.mutate(
      {
        id: hospital?.id,
        name: values.name,
        address: values.address || null,
        phone: values.phone || null,
        lat: point.lat,
        lng: point.lng,
      },
      {
        onSuccess: () => {
          toast.success(hospital ? 'Hospital updated.' : 'Hospital added.');
          onDone();
        },
        onError: reportFailure,
      }
    );
  };

  return (
    <Card>
      <h2 className="text-lg font-semibold text-gray-900">
        {hospital ? `Edit ${hospital.name}` : 'Add a hospital'}
      </h2>
      <form className="mt-3 space-y-4" noValidate onSubmit={handleSubmit(submit)}>
        <Field label="Name" error={errors.name?.message} {...register('name')} />
        <Field label="Address" error={errors.address?.message} {...register('address')} />
        <Field
          label="Phone number (optional)"
          type="tel"
          inputMode="tel"
          error={errors.phone?.message}
          {...register('phone')}
        />
        <div>
          <p className="mb-1 font-medium text-gray-900">Location</p>
          <p className="mb-2 text-sm text-gray-600">
            Tap the map to place the pin on the entrance, or drag it.
          </p>
          <LocationPicker
            value={point}
            onChange={(next) => {
              setPoint(next);
              setPointError(null);
            }}
            height="40vh"
          />
          {pointError && (
            <p className="mt-1 text-sm text-red-700" role="alert">
              {pointError}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={save.isPending}>
            {hospital ? 'Save changes' : 'Add hospital'}
          </Button>
          <Button variant="secondary" disabled={save.isPending} onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function HospitalsAdminPage() {
  const { data, isPending, isError, refetch } = useAllHospitals();
  const archive = useArchiveHospital();
  const [editing, setEditing] = useState(null); // null | 'new' | hospital

  const setArchived = (hospital, archived) =>
    archive.mutate(
      { id: hospital.id, archived },
      {
        onSuccess: () =>
          toast.success(
            archived
              ? `${hospital.name} is hidden from patients.`
              : `${hospital.name} is shown to patients again.`
          ),
        onError: reportFailure,
      }
    );

  let body;
  if (editing) {
    body = (
      <HospitalForm
        key={editing === 'new' ? 'new' : editing.id}
        hospital={editing === 'new' ? null : editing}
        onDone={() => setEditing(null)}
      />
    );
  } else if (isPending) body = <LoadingState label="Loading hospitals…" />;
  else if (isError) body = <ErrorState message="Could not load hospitals." onRetry={refetch} />;
  else {
    body = (
      <>
        <Button className="mb-4" onClick={() => setEditing('new')}>
          Add a hospital
        </Button>
        {data.length === 0 ? (
          <EmptyState title="No hospitals yet">
            Patients cannot choose a hospital until one is added.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {data.map((hospital) => (
              <Card as="li" key={hospital.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{hospital.name}</h2>
                    {hospital.address && <p className="text-gray-600">{hospital.address}</p>}
                    {hospital.phone && <p className="text-gray-600">{hospital.phone}</p>}
                  </div>
                  {hospital.is_archived && (
                    <span className="rounded-full bg-gray-200 px-3 py-1 text-sm font-semibold text-gray-900">
                      Hidden from patients
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setEditing(hospital)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    loading={archive.isPending && archive.variables?.id === hospital.id}
                    onClick={() => setArchived(hospital, !hospital.is_archived)}
                  >
                    {hospital.is_archived ? 'Show to patients' : 'Hide from patients'}
                  </Button>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <StaffShell title="Hospitals" nav={ADMIN_NAV}>
      {body}
    </StaffShell>
  );
}
