import { useState, useCallback } from 'react';
import { Toast } from '@base-ui/react/toast';
import { Check, X, Warning, Info, Copy, CheckCircle } from '@phosphor-icons/react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  title: string;
  description?: string;
  type?: ToastType;
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

function ToastList() {
  const { toasts } = Toast.useToastManager();

  return toasts.map((toast) => {
    const data = toast.data as ToastData | undefined;
    const type = data?.type || 'info';
    const title = data?.title || 'Notification';
    const description = data?.description;
    const showCopy = type === 'error' && description;

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
      manager.add({ title, description, type: 'success' } as ToastData),
    error: (title: string, description?: string) =>
      // Errors get longer timeout so users can read and copy the message
      manager.add({ title, description, type: 'error' } as ToastData, { timeout: 10000 }),
    warning: (title: string, description?: string) =>
      manager.add({ title, description, type: 'warning' } as ToastData, { timeout: 7000 }),
    info: (title: string, description?: string) =>
      manager.add({ title, description, type: 'info' } as ToastData),
    promise: manager.promise,
  };
};
