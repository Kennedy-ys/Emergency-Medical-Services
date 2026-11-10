import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { useSession } from '../../hooks/useSession';
import { usePushStatus, useTurnOffPush, useTurnOnPush } from './api';

const TEXT = {
  driver: {
    title: 'Alerts for new requests',
    off: 'Get a notification the moment a request comes in, even when this app is closed or the phone is locked.',
    on: 'This phone will alert you when a request comes in, even with the app closed.',
  },
  patient: {
    title: 'Alerts about your ambulance',
    off: 'Get a notification when an ambulance is on its way and when it arrives, even if you leave this page.',
    on: 'This phone will alert you when your ambulance is on its way and when it arrives.',
  },
};

const FAILED = {
  blocked: 'Notifications are blocked for this site. Allow them in your browser settings.',
  dismissed: 'Alerts stay off until you allow notifications.',
  not_ready: 'Alerts are not ready yet. Reload the page and try again.',
};

/**
 * Lets the user turn alerts for this device on or off, and explains what to do
 * when the device cannot have them yet. Patients are not shown problems they
 * cannot act on; drivers are, because their work depends on alerts.
 */
export default function PushOptIn({ audience }) {
  const { user } = useSession();
  const { data: status } = usePushStatus(user?.id);
  const turnOn = useTurnOnPush();
  const turnOff = useTurnOffPush();
  const text = TEXT[audience];
  const isDriver = audience === 'driver';

  if (!status || status === 'not_configured') return null;
  if (status === 'unsupported' && !isDriver) return null;

  const onError = (error) =>
    toast.error(
      FAILED[error.reason] ?? 'Could not change alerts. Check your connection and try again.'
    );

  let detail;
  let action = null;
  if (status === 'unsupported') {
    detail =
      'This browser cannot show alerts while the app is closed. Keep this screen open while on duty, or use Chrome on an Android phone.';
  } else if (status === 'needs_install') {
    detail =
      'On an iPhone or iPad, first add this app to your Home Screen: tap the Share button in Safari, then "Add to Home Screen". Open the app from the Home Screen and turn on alerts there.';
  } else if (status === 'blocked') {
    detail = FAILED.blocked;
  } else if (status === 'on') {
    detail = text.on;
    action = (
      <Button
        variant="ghost"
        loading={turnOff.isPending}
        onClick={() => turnOff.mutate(undefined, { onError })}
      >
        Turn off alerts
      </Button>
    );
  } else {
    detail = text.off;
    action = (
      <Button
        loading={turnOn.isPending}
        onClick={() =>
          turnOn.mutate(undefined, { onSuccess: () => toast.success('Alerts are on.'), onError })
        }
      >
        Turn on alerts
      </Button>
    );
  }

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1 basis-64">
        <h2 className="text-lg font-semibold text-gray-900">{text.title}</h2>
        <p className="text-gray-600">{detail}</p>
      </div>
      {action}
    </Card>
  );
}
