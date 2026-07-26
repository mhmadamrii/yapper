import { CircleCheckIcon, OctagonXIcon } from 'lucide-react';
import { toast as sonnerToast } from 'sonner';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastOptions {
  action?: ToastAction;
  duration?: number;
}

function ToastCard({
  id,
  icon,
  iconClassName,
  message,
  action,
}: {
  id: string | number;
  icon: React.ReactNode;
  iconClassName: string;
  message: string;
  action?: ToastAction;
}) {
  return (
    <div className="bg-popover text-popover-foreground border-border ring-foreground/10 flex w-[min(356px,100vw-2rem)] items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ring-1">
      <span className={`shrink-0 ${iconClassName}`}>{icon}</span>
      <span className="flex-1">{message}</span>
      {action && (
        <button
          onClick={() => {
            action.onClick();
            sonnerToast.dismiss(id);
          }}
          className="text-primary shrink-0 text-sm font-medium hover:underline"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// Drop-in replacement for sonner's `toast.success`/`toast.error` — renders
// via `toast.custom` so the toast card is styled with this app's own theme
// tokens (popover/border/primary) instead of sonner's built-in palette.
export const toast = {
  success: (message: string, options?: ToastOptions) =>
    sonnerToast.custom(
      (id) => (
        <ToastCard
          id={id}
          icon={<CircleCheckIcon className="size-4" />}
          iconClassName="text-primary"
          message={message}
          action={options?.action}
        />
      ),
      { duration: options?.duration },
    ),
  error: (message: string, options?: ToastOptions) =>
    sonnerToast.custom(
      (id) => (
        <ToastCard
          id={id}
          icon={<OctagonXIcon className="size-4" />}
          iconClassName="text-destructive"
          message={message}
          action={options?.action}
        />
      ),
      { duration: options?.duration },
    ),
};
