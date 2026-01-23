import { useEffect, Suspense, type ReactNode } from 'react';
import type { IDockviewPanelProps } from 'dockview-react';
import { useUIStore } from '../../stores/ui-store';
import { LoadingSpinner } from '../ui';
import type { PanelId } from '../../types/git';

interface DockviewPanelWrapperProps extends IDockviewPanelProps {
  panelId: PanelId;
  children: ReactNode;
  fallback?: ReactNode;
}

function DefaultFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <LoadingSpinner size="sm" />
    </div>
  );
}

export function DockviewPanelWrapper({
  panelId,
  children,
  api,
  fallback,
}: DockviewPanelWrapperProps) {
  const { activePanel, setActivePanel } = useUIStore();
  const isActive = activePanel === panelId;

  // Sync dockview focus changes to ui-store
  useEffect(() => {
    const disposable = api.onDidActiveChange((event) => {
      if (event.isActive) {
        setActivePanel(panelId);
      }
    });

    return () => disposable.dispose();
  }, [api, panelId, setActivePanel]);

  return (
    <div
      className={`flex flex-col h-full w-full bg-bg-secondary ${
        isActive ? 'ring-1 ring-inset ring-accent-blue/30' : ''
      }`}
      onClick={() => setActivePanel(panelId)}
    >
      <Suspense fallback={fallback ?? <DefaultFallback />}>
        {children}
      </Suspense>
    </div>
  );
}
