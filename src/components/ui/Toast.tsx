import { Toast } from '@base-ui/react/toast';
import { Check, X, Warning, Info } from '@phosphor-icons/react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  title: string;
  description?: string;
  type?: ToastType;
}

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <Check size={16} weight="bold" className="text-accent-green" />,
  error: <X size={16} weight="bold" className="text-accent-red" />,
  warning: <Warning size={16} weight="bold" className="text-accent-yellow" />,
  info: <Info size={16} weight="bold" className="text-accent-blue" />,
};

function ToastList() {
  const { toasts } = Toast.useToastManager();

  return toasts.map((toast) => {
    const data = toast.data as ToastData | undefined;
    const type = data?.type || 'info';

    return (
      <Toast.Root
        key={toast.id}
        toast={toast}
        className="flex items-start gap-3 px-4 py-3 bg-bg-secondary border border-border-primary rounded-lg shadow-lg min-w-[300px] max-w-[400px] data-[swipe=move]:translate-x-[var(--toast-swipe-move-x)] data-[ending-style]:opacity-0 data-[ending-style]:translate-x-2 transition-all duration-200"
      >
        <span className="mt-0.5">{iconMap[type]}</span>
        <Toast.Content className="flex-1 min-w-0">
          <Toast.Title className="font-medium text-sm text-text-primary">
            {data?.title}
          </Toast.Title>
          {data?.description && (
            <Toast.Description className="text-xs text-text-muted mt-0.5">
              {data.description}
            </Toast.Description>
          )}
        </Toast.Content>
        <Toast.Close className="text-text-muted hover:text-text-primary p-1 -m-1">
          <X size={14} />
        </Toast.Close>
      </Toast.Root>
    );
  });
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider timeout={4000}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed bottom-4 right-4 flex flex-col gap-2 z-50" />
        <ToastList />
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
      manager.add({ title, description, type: 'error' } as ToastData),
    warning: (title: string, description?: string) =>
      manager.add({ title, description, type: 'warning' } as ToastData),
    info: (title: string, description?: string) =>
      manager.add({ title, description, type: 'info' } as ToastData),
    promise: manager.promise,
  };
};
