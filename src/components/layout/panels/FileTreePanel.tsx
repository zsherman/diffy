import { useEffect } from 'react';
import type { IDockviewPanelProps } from 'dockview-react';
import { DockviewPanelWrapper } from '../DockviewPanelWrapper';
import { FileTreeView } from '../../../features/files/components';
import { useActiveTabState } from '../../../stores/tabs-store';
import { SkeletonList } from '../../../components/ui';

function FileTreeFallback() {
  return (
    <div className="flex flex-col h-full p-2">
      <SkeletonList rows={8} />
    </div>
  );
}

export function FileTreePanel(props: IDockviewPanelProps) {
  const { selectedCommit } = useActiveTabState();

  // Update panel title based on whether viewing a commit or working directory
  useEffect(() => {
    const title = selectedCommit ? 'Commit Tree' : 'File Tree';
    props.api.setTitle(title);
  }, [selectedCommit, props.api]);

  return (
    <DockviewPanelWrapper panelId="file-tree" {...props} fallback={<FileTreeFallback />}>
      <FileTreeView />
    </DockviewPanelWrapper>
  );
}
