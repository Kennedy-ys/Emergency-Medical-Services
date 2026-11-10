import StaffShell from '../../components/layout/StaffShell';
import { EmptyState } from '../../components/ui/States';

/** Placeholder until the driver screens are rebuilt (implementation plan, Phase 2). */
export default function DriverHomePage() {
  return (
    <StaffShell title="Your trips">
      <EmptyState title="The new driver screens are not built yet">
        Going on duty, open requests and the trip screen arrive in the next phase.
      </EmptyState>
    </StaffShell>
  );
}
