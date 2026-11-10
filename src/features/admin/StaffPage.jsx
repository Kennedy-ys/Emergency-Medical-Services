import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import StaffShell from '../../components/layout/StaffShell';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Field from '../../components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { ADMIN_NAV, inviteErrorMessage, useInviteStaff, useStaff } from './api';
import { formatDateTime } from './shared';

const ROLE_LABEL = { admin: 'Dispatcher', technician: 'Technician' };

const schema = z.object({
  fullName: z.string().trim().min(2, 'Enter their full name.').max(120, 'Name is too long.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  role: z.enum(['technician', 'admin']),
});

function InviteForm() {
  const invite = useInviteStaff();
  const roleId = useId();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', email: '', role: 'technician' },
  });

  const submit = (values) =>
    invite.mutate(values, {
      onSuccess: () => {
        toast.success(`Invitation sent to ${values.email}.`);
        reset();
      },
      onError: (error) => toast.error(inviteErrorMessage(error)),
    });

  return (
    <Card className="mb-6">
      <h2 className="text-lg font-semibold text-gray-900">Invite a staff member</h2>
      <p className="text-gray-600">
        They get an email with a link to choose a password. Drivers apply for themselves at
        /driver/register.
      </p>
      <form onSubmit={handleSubmit(submit)} noValidate className="mt-3 grid gap-3 md:grid-cols-2">
        <Field
          label="Full name"
          autoComplete="off"
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <Field
          label="Email"
          type="email"
          autoComplete="off"
          error={errors.email?.message}
          {...register('email')}
        />
        <div>
          <label htmlFor={roleId} className="mb-1 block font-medium text-gray-900">
            Role
          </label>
          <select
            id={roleId}
            className="block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900"
            {...register('role')}
          >
            <option value="technician">Technician (answers patient chats)</option>
            <option value="admin">Dispatcher (full access to these screens)</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" loading={invite.isPending}>
            Send invitation
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function StaffPage() {
  const { data, isPending, isError, refetch } = useStaff();

  let list;
  if (isPending) list = <LoadingState label="Loading staff…" />;
  else if (isError) list = <ErrorState message="Could not load staff." onRetry={refetch} />;
  else if (data.length === 0) list = <EmptyState title="No staff yet" />;
  else {
    list = (
      <ul className="space-y-2">
        {data.map((person) => (
          <li
            key={person.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-sm"
          >
            <span>
              <span className="block font-semibold text-gray-900">
                {person.full_name || 'No name given'}
              </span>
              <span className="block text-sm text-gray-600">
                Added {formatDateTime(person.created_at)}
                {person.phone ? ` · ${person.phone}` : ''}
              </span>
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-900">
              {ROLE_LABEL[person.role]}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <StaffShell title="Staff" nav={ADMIN_NAV}>
      <InviteForm />
      <h2 className="mb-2 text-lg font-semibold text-gray-900">Dispatchers and technicians</h2>
      {list}
    </StaffShell>
  );
}
