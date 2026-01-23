import type { IDockviewPanelProps } from 'dockview-react';
import { DockviewPanelWrapper } from '../DockviewPanelWrapper';
import { DiffViewer } from '../../../features/diff/components';
import { SkeletonDiff } from '../../../components/ui';

function DiffFallback() {
  return (
    <div className="flex flex-col h-full p-4">
      <SkeletonDiff lines={12} />
    </div>
  );
}

export function DiffPanel(props: IDockviewPanelProps) {
  return (
    <DockviewPanelWrapper panelId="diff" {...props} fallback={<DiffFallback />}>
      <DiffViewer />
    </DockviewPanelWrapper>
  );
}
