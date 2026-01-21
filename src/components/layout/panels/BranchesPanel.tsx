import type { IDockviewPanelProps } from 'dockview-react';
import { DockviewPanelWrapper } from '../DockviewPanelWrapper';
import { BranchList } from '../../../features/branches/components';

export function BranchesPanel(props: IDockviewPanelProps) {
  return (
    <DockviewPanelWrapper panelId="branches" {...props}>
      <BranchList />
    </DockviewPanelWrapper>
  );
}
