import type { IDockviewPanelProps } from 'dockview-react';
import { DockviewPanelWrapper } from '../DockviewPanelWrapper';
import { DiffViewer } from '../../../features/diff/components';

export function DiffPanel(props: IDockviewPanelProps) {
  return (
    <DockviewPanelWrapper panelId="diff" {...props}>
      <DiffViewer />
    </DockviewPanelWrapper>
  );
}
