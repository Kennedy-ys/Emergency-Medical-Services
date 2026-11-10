import { useState } from 'react';
import toast from 'react-hot-toast';
import StaffShell from '../../components/layout/StaffShell';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { ADMIN_NAV, useDrivers, useSetDriverApproval } from './api';
import { formatDateTime, reportFailure } from './shared';

const APPROVAL = {
  pending: { label: 'Waiting for approval', tone: 'bg-amber-100 text-amber-900' },
  approved: { label: 'Approved', tone: 'bg-green-100 text-green-900' },
  suspended: { label: 'Suspended', tone: 'bg-gray-200 text-gray-900' },
};

const AVAILABILITY = { offline: 'Off duty', available: 'On duty, free', busy: 'On a trip' };

const GROUPS = [
  { status: 'pending', title: 'Waiting for approval' },
  { status: 'approved', title: 'Approved' },
  { status: 'suspended', title: 'Suspended' },
];

function DriverCard({ driver, onApprove, onSuspend, busy }) {
  const approval = APPROVAL[driver.approval_status];
  return (
    <Card as="li">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {driver.profile?.full_name || 'No name given'}
          </h3>
          <p className="text-gray-600">
            Ambulance {driver.ambulance_number}, plate {driver.license_plate}
          </p>
          {driver.profile?.phone && (
            <a href={`tel:${driver.profile.phone}`} className="font-semibold text-brand underline">
              {driver.profile.phone}
            </a>
          )}
          <p className="mt-1 text-sm text-gray-600">
            Applied {formatDateTime(driver.created_at)}
            {driver.approval_status === 'approved' ? ` · ${AVAILABILITY[driver.availability]}` : ''}
          </p>
          {driver.approval_note && (
            <p className="mt-1 text-gray-900">Note: {driver.approval_note}</p>
          )}
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${approval.tone}`}>
          {approval.label}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {driver.approval_status !== 'approved' && (
          <Button loading={busy} onClick={() => onApprove(driver)}>
            {driver.approval_status === 'suspended' ? 'Reinstate' : 'Approve'}
          </Button>
        )}
        {driver.approval_status !== 'suspended' && (
          <Button variant="secondary" disabled={busy} onClick={() => onSuspend(driver)}>
            {driver.approval_status === 'pending' ? 'Turn down' : 'Suspend'}
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function DriversPage() {
  const { data, isPending, isError, refetch } = useDrivers();
  const setApproval = useSetDriverApproval();
  const [suspending, setSuspending] = useState(null);
  const [note, setNote] = useState('');

  const approve = (driver) =>
    setApproval.mutate(
      { driverId: driver.id, status: 'approved' },
      {
        onSuccess: () =>
          toast.success(`${driver.profile?.full_name || 'Driver'} can now go on duty.`),
        onError: reportFailure,
      }
    );

  const suspend = () =>
    setApproval.mutate(
      { driverId: suspending.id, status: 'suspended', note },
      {
        onSuccess: () => {
          toast.success('Driver suspended.');
          setSuspending(null);
          setNote('');
        },
        onError: (error) => {
          setSuspending(null);
          reportFailure(error);
        },
      }
    );

  let body;
  if (isPending) body = <LoadingState label="Loading drivers…" />;
  else if (isError) body = <ErrorState message="Could not load drivers." onRetry={refetch} />;
  else if (data.length === 0) {
    body = (
      <EmptyState title="No drivers yet">
        Drivers apply at /driver/register. Their applications appear here for approval.
      </EmptyState>
    );
  } else {
    body = GROUPS.map(({ status, title }) => {
      const drivers = data.filter((driver) => driver.approval_status === status);
      if (drivers.length === 0) return null;
      return (
        <section key={status} className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            {title} ({drivers.length})
          </h2>
          <ul className="space-y-3">
            {drivers.map((driver) => (
              <DriverCard
                key={driver.id}
                driver={driver}
                busy={setApproval.isPending && setApproval.variables?.driverId === driver.id}
                onApprove={approve}
                onSuspend={setSuspending}
              />
            ))}
          </ul>
        </section>
      );
    });
  }

  return (
    <StaffShell title="Drivers" nav={ADMIN_NAV}>
      {body}
      <ConfirmDialog
        open={Boolean(suspending)}
        title={`Suspend ${suspending?.profile?.full_name || 'this driver'}?`}
        confirmLabel="Suspend"
        loading={setApproval.isPending}
        onConfirm={suspend}
        onClose={() => setSuspending(null)}
      >
        <p>
          They will stop receiving requests straight away. A trip already under way is not
          interrupted.
        </p>
        <label htmlFor="suspend-note" className="mt-3 mb-1 block font-medium text-gray-900">
          Reason (the driver sees this)
        </label>
        <textarea
          id="suspend-note"
          rows={2}
          maxLength={200}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="block w-full rounded-lg border border-gray-300 p-2 text-base text-gray-900"
        />
      </ConfirmDialog>
    </StaffShell>
  );
}
