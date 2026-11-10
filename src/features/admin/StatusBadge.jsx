import { STATUS } from '../../lib/status';

/** A request's status in the staff wording, as a coloured label. */
export default function StatusBadge({ status }) {
  const meta = STATUS[status];
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap ${meta.tone}`}
    >
      {meta.tripLabel}
    </span>
  );
}
