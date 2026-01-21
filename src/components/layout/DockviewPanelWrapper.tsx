import { useEffect, type ReactNode } from 'react';
import type { IDockviewPanelProps } from 'dockview-react';
import { useUIStore } from '../../stores/ui-store';
import type { PanelId } from '../../types/git';

interface DockviewPanelWrapperProps extends IDockviewPanelProps {
  panelId: PanelId;
  children: ReactNode;
}

export function DockviewPanelWrapper({
  panelId,
  children,
  api,
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
      {children}
    </div>
  );
}
