import type { IDockviewPanelProps } from 'dockview-react';
import { DockviewPanelWrapper } from '../DockviewPanelWrapper';
import { CommitList } from '../../../features/commits/components';
import { SkeletonCommits } from '../../../components/ui';

function CommitsFallback() {
  return (
    <div className="flex flex-col h-full p-2">
      <SkeletonCommits rows={8} />
    </div>
  );
}

export function CommitsPanel(props: IDockviewPanelProps) {
  return (
    <DockviewPanelWrapper panelId="commits" {...props} fallback={<CommitsFallback />}>
      <CommitList />
    </DockviewPanelWrapper>
  );
}
