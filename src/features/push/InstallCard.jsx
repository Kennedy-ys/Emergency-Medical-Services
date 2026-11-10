import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { useInstallPrompt } from '../../lib/installPrompt';

/** Offers to install the app when the browser allows it. Shows nothing otherwise. */
export default function InstallCard() {
  const { available, install } = useInstallPrompt();
  if (!available) return null;
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1 basis-64">
        <h2 className="text-lg font-semibold text-gray-900">Install the app on this phone</h2>
        <p className="text-gray-600">
          It opens from your home screen like any other app, and alerts arrive more reliably.
        </p>
      </div>
      <Button variant="secondary" onClick={install}>
        Install
      </Button>
    </Card>
  );
}
