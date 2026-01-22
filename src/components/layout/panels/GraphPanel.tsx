import type { IDockviewPanelProps } from 'dockview-react';
import { DockviewPanelWrapper } from '../DockviewPanelWrapper';
import { GraphTableView } from '../../../features/graph/components';

export function GraphPanel(props: IDockviewPanelProps) {
  return (
    <DockviewPanelWrapper panelId="graph" {...props}>
      <GraphTableView />
    </DockviewPanelWrapper>
  );
}
