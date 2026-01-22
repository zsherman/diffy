import type { IDockviewPanelProps } from 'dockview-react';
import { DockviewPanelWrapper } from '../DockviewPanelWrapper';
import { WorktreeList } from '../../../features/worktrees/components';

export function WorktreesPanel(props: IDockviewPanelProps) {
  return (
    <DockviewPanelWrapper panelId="worktrees" {...props}>
      <WorktreeList />
    </DockviewPanelWrapper>
  );
}
