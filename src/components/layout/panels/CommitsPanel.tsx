import type { IDockviewPanelProps } from 'dockview-react';
import { DockviewPanelWrapper } from '../DockviewPanelWrapper';
import { CommitList } from '../../../features/commits/components';

export function CommitsPanel(props: IDockviewPanelProps) {
  return (
    <DockviewPanelWrapper panelId="commits" {...props}>
      <CommitList />
    </DockviewPanelWrapper>
  );
}
