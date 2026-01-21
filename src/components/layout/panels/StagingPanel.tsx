import type { IDockviewPanelProps } from 'dockview-react';
import { DockviewPanelWrapper } from '../DockviewPanelWrapper';
import { StagingSidebar } from '../../../features/staging/components';

export function StagingPanel(props: IDockviewPanelProps) {
  return (
    <DockviewPanelWrapper panelId="staging" {...props}>
      <StagingSidebar />
    </DockviewPanelWrapper>
  );
}
