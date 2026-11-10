import { Link } from 'react-router-dom';
import StaffShell from '../../components/layout/StaffShell';
import { EmptyState } from '../../components/ui/States';

/** Placeholder until the dispatch console is built (implementation plan, Phase 3). */
export default function DispatchPage() {
  return (
    <StaffShell title="Dispatch">
      <EmptyState title="The dispatch console is not built yet">
        <p>Live requests, assignment and driver approval arrive in the next phases.</p>
        <p className="mt-2">
          The earlier admin screens are still available at{' '}
          <Link to="/admin" className="font-semibold text-brand underline">
            the old admin area
          </Link>{' '}
          with the old sign-in.
        </p>
      </EmptyState>
    </StaffShell>
  );
}
