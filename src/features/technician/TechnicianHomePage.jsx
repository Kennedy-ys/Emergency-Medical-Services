import StaffShell from '../../components/layout/StaffShell';
import { EmptyState } from '../../components/ui/States';

/** Placeholder until technician chat is built (implementation plan, Phase 6). */
export default function TechnicianHomePage() {
  return (
    <StaffShell title="Conversations">
      <EmptyState title="Technician chat is not built yet">
        The queue of waiting patients will appear here.
      </EmptyState>
    </StaffShell>
  );
}
