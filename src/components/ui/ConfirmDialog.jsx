import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import Button from './Button';

/** A yes/no question in a dialog. Escape and the backdrop both mean "no". */
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Go back',
  variant = 'emergency',
  loading = false,
  onConfirm,
  onClose,
}) {
  return (
    <Dialog open={open} onClose={loading ? () => {} : onClose} className="relative z-[2000]">
      <DialogBackdrop className="fixed inset-0 bg-black/40" />
      <div className="fixed inset-0 flex items-end justify-center p-4 sm:items-center">
        <DialogPanel className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
          <DialogTitle className="text-lg font-semibold text-gray-900">{title}</DialogTitle>
          {children && <div className="mt-2 text-gray-600">{children}</div>}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
            <Button variant={variant} loading={loading} onClick={onConfirm}>
              {confirmLabel}
            </Button>
            <Button variant="secondary" disabled={loading} onClick={onClose}>
              {cancelLabel}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
