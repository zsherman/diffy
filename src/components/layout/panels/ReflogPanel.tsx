import type { IDockviewPanelProps } from 'dockview-react';
import { DockviewPanelWrapper } from '../DockviewPanelWrapper';
import { ReflogView } from '../../../features/reflog/components';
import { SkeletonList } from '../../../components/ui';

function ReflogFallback() {
  return (
    <div className="flex flex-col h-full p-2">
      <SkeletonList rows={8} />
    </div>
  );
}

export function ReflogPanel(props: IDockviewPanelProps) {
  return (
    <DockviewPanelWrapper panelId="reflog" {...props} fallback={<ReflogFallback />}>
      <ReflogView />
    </DockviewPanelWrapper>
  );
}
