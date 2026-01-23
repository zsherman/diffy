import { useState, useCallback } from 'react';
import { Toast } from '@base-ui/react/toast';
import { Check, X, Warning, Info, Copy, CheckCircle } from '@phosphor-icons/react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastData {
  title: string;
  description?: string;
  type?: ToastType;
  action?: ToastAction;
}

// Module-level storage for action callbacks
// This is needed because Base UI's toast manager serializes data
const actionRegistry = new Map<string, () => void>();

let actionIdCounter = 0;
function registerAction(callback: () => void): string {
  const id = `toast-action-${++actionIdCounter}`;
  actionRegistry.set(id, callback);
  // Clean up after a reasonable timeout (longer than toast duration)
  setTimeout(() => actionRegistry.delete(id), 30000);
  return id;
}

function getAction(id: string): (() => void) | undefined {
  return actionRegistry.get(id);
}

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <Check size={16} weight="bold" />,
  error: <Warning size={16} weight="fill" />,
  warning: <Warning size={16} weight="fill" />,
  info: <Info size={16} weight="fill" />,
};

const borderColorMap: Record<ToastType, string> = {
  success: 'border-accent-green',
  error: 'border-accent-red',
  warning: 'border-accent-yellow',
  info: 'border-accent-blue',
};

const titleColorMap: Record<ToastType, string> = {
  success: 'text-accent-green',
  error: 'text-accent-red',
  warning: 'text-accent-yellow',
  info: 'text-accent-blue',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
      title="Copy error message"
    >
      {copied ? (
        <CheckCircle size={14} weight="fill" className="text-accent-green" />
      ) : (
        <Copy size={14} />
      )}
    </button>
  );
}

interface ToastDataWithActionId extends Omit<ToastData, 'action'> {
  actionId?: string;
  actionLabel?: string;
}

function ToastList() {
  const manager = Toast.useToastManager();
  const { toasts } = manager;

  return toasts.map((toast) => {
    // Base UI spreads data directly onto the toast object, not under toast.data
    const toastData = toast as unknown as ToastDataWithActionId & { id: string };
    const type = toastData.type || 'info';
    const title = toastData.title || 'Notification';
    const description = toastData.description;
    const showCopy = type === 'error' && description;
    const actionId = toastData.actionId;
    const actionLabel = toastData.actionLabel;

    const handleActionClick = () => {
      if (actionId) {
        const callback = getAction(actionId);
        if (callback) {
          callback();
          // Try different methods to dismiss the toast
          if ('remove' in manager && typeof manager.remove === 'function') {
            manager.remove(toast.id);
          } else if ('dismiss' in manager && typeof manager.dismiss === 'function') {
            (manager as { dismiss: (id: string) => void }).dismiss(toast.id);
          }
          // If neither exists, the toast will auto-dismiss after timeout
        }
      }
    };

    return (
      <Toast.Root
        key={toast.id}
        toast={toast}
        className={`flex items-start gap-3 px-4 py-3 bg-bg-secondary border rounded-lg shadow-lg min-w-[320px] max-w-[420px] data-[swipe=move]:translate-x-[var(--toast-swipe-move-x)] data-[ending-style]:opacity-0 data-[ending-style]:translate-x-2 transition-all duration-200 ${borderColorMap[type]}`}
      >
        <Toast.Content className="flex-1 min-w-0">
          <Toast.Title className={`flex items-center gap-2 font-medium text-sm ${titleColorMap[type]}`}>
            {iconMap[type]}
            <span className="text-text-primary">{title}</span>
          </Toast.Title>
          {description && (
            <Toast.Description className="text-sm text-text-muted mt-2 leading-relaxed">
              {description}
            </Toast.Description>
          )}
          {actionId && actionLabel && (
            <button
              onClick={handleActionClick}
              className="mt-2 px-3 py-1 text-xs font-medium bg-accent-blue text-white rounded hover:bg-accent-blue/90 transition-colors"
            >
              {actionLabel}
            </button>
          )}
        </Toast.Content>
        <div className="flex items-center gap-1 shrink-0">
          {showCopy && <CopyButton text={`${title}\n\n${description}`} />}
          <Toast.Close className="text-text-muted hover:text-text-primary p-1">
            <X size={14} />
          </Toast.Close>
        </div>
      </Toast.Root>
    );
  });
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider timeout={5000}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

// Re-export useToastManager for convenience
export { Toast };
export const useToast = () => {
  const manager = Toast.useToastManager();

  return {
    success: (title: string, description?: string) =>
      manager.add({ title, description, type: 'success' as const }),
    error: (title: string, description?: string) =>
      manager.add({ title, description, type: 'error' as const }, { timeout: 10000 }),
    warning: (title: string, description?: string) =>
      manager.add({ title, description, type: 'warning' as const }, { timeout: 7000 }),
    info: (title: string, description?: string) =>
      manager.add({ title, description, type: 'info' as const }),
    // New: toast with action button
    withAction: (
      title: string,
      description: string | undefined,
      type: ToastType,
      action: ToastAction,
      timeout?: number
    ) => {
      const actionId = registerAction(action.onClick);
      return manager.add(
        {
          title,
          description,
          type,
          actionId,
          actionLabel: action.label,
        },
        { timeout: timeout ?? 15000 } // Longer timeout for actionable toasts
      );
    },
    promise: manager.promise,
  };
};
