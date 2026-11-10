import toast from 'react-hot-toast';
import StaffShell from '../../components/layout/StaffShell';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { useOnline } from '../../hooks/useOnline';
import { useSession } from '../../hooks/useSession';
import { classifyError } from '../../lib/supabase';
import { errorText } from '../../lib/status';
import { useDriverHeartbeat, useMyDriver, useMyTrip, useSetAvailability } from './api';
import OpenRequests from './OpenRequests';
import TripPanel from './TripPanel';

const LOCATION_PROBLEM = {
  denied:
    'Location access is off. Turn it on in your browser settings, or you will be taken off duty within two minutes.',
  unavailable:
    'We cannot get your location right now. Without it you will be taken off duty within two minutes.',
  unsupported: 'This device cannot share its location, so it cannot be used on duty.',
};

export default function DriverHomePage() {
  const { user } = useSession();
  const online = useOnline();
  const driver = useMyDriver(user?.id);
  const trip = useMyTrip(user?.id);
  const setAvailability = useSetAvailability();

  const availability = driver.data?.availability ?? 'offline';
  const onDuty = availability !== 'offline';
  const { position, problem } = useDriverHeartbeat(onDuty);

  const toggle = () =>
    setAvailability.mutate(!onDuty, {
      onError: (error) => {
        const { kind, code } = classifyError(error);
        toast.error(
          kind === 'business'
            ? errorText(code)
            : 'Could not change your status. Check your connection and try again.'
        );
      },
    });

  let body;
  if (driver.isPending || trip.isPending) {
    body = <LoadingState />;
  } else if (driver.isError || trip.isError) {
    body = (
      <ErrorState
        message="Could not load your status."
        onRetry={() => {
          driver.refetch();
          trip.refetch();
        }}
      />
    );
  } else if (driver.data.approval_status !== 'approved' && !trip.data) {
    const suspended = driver.data.approval_status === 'suspended';
    body = (
      <Card>
        <h2 className="text-lg font-semibold text-gray-900">
          {suspended ? 'Your account is suspended' : 'Your application is being reviewed'}
        </h2>
        <p className="mt-1 text-gray-600">
          {suspended
            ? 'You cannot go on duty. Contact dispatch for details.'
            : 'A dispatcher will check your details. You can go on duty once you are approved.'}
        </p>
        {driver.data.approval_note && (
          <p className="mt-2 text-gray-900">Note from dispatch: {driver.data.approval_note}</p>
        )}
      </Card>
    );
  } else if (trip.data) {
    body = <TripPanel trip={trip.data} position={position} />;
  } else {
    body = (
      <div className="space-y-4">
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-gray-900" aria-live="polite">
              {onDuty ? 'You are on duty' : 'You are off duty'}
            </p>
            <p className="text-gray-600">
              {onDuty
                ? 'You can receive requests. Your location is shared with dispatch.'
                : 'Go on duty to see and accept requests.'}
            </p>
          </div>
          <Button
            variant={onDuty ? 'secondary' : 'primary'}
            loading={setAvailability.isPending}
            disabled={!online}
            onClick={toggle}
          >
            {onDuty ? 'Go off duty' : 'Go on duty'}
          </Button>
        </Card>
        {!online && (
          <p className="text-gray-600">You are offline. Reconnect to change your status.</p>
        )}
        {onDuty && <OpenRequests position={position} />}
      </div>
    );
  }

  return (
    <StaffShell title={trip.data ? 'Current trip' : 'Requests'}>
      {onDuty && problem && (
        <p
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-gray-900"
          role="alert"
        >
          {LOCATION_PROBLEM[problem]}
        </p>
      )}
      {body}
    </StaffShell>
  );
}
