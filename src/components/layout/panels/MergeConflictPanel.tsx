import type { IDockviewPanelProps } from 'dockview-react';
import { DockviewPanelWrapper } from '../DockviewPanelWrapper';
import { MergeConflictView } from '../../../features/merge-conflict/components';

export function MergeConflictPanel(props: IDockviewPanelProps) {
  return (
    <DockviewPanelWrapper panelId="merge-conflict" {...props}>
      <MergeConflictView />
    </DockviewPanelWrapper>
  );
}
