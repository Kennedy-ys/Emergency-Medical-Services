import { useOnline } from '../../hooks/useOnline';

export default function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="bg-warning px-4 py-2 text-center font-medium text-gray-900" role="status">
      You are offline. For an emergency, call{' '}
      <a href="tel:112" className="font-bold underline">
        112
      </a>
      .
    </div>
  );
}
