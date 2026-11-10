import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import OfflineBanner from '../components/layout/OfflineBanner';
import PendingRequestBanner from '../features/booking/PendingRequestBanner';
import AppRoutes from './routes';

export default function App() {
  return (
    <BrowserRouter>
      <OfflineBanner />
      <PendingRequestBanner />
      <Toaster position="top-right" />
      <AppRoutes />
    </BrowserRouter>
  );
}
