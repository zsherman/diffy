import { useEffect } from 'react';
import type { IDockviewPanelProps } from 'dockview-react';
import { DockviewPanelWrapper } from '../DockviewPanelWrapper';
import { FileList } from '../../../features/files/components';
import { useActiveTabState } from '../../../stores/tabs-store';
import { SkeletonList } from '../../../components/ui';

function FilesFallback() {
  return (
    <div className="flex flex-col h-full p-2">
      <SkeletonList rows={6} />
    </div>
  );
}

export function FilesPanel(props: IDockviewPanelProps) {
  const { selectedCommit } = useActiveTabState();

  // Update panel title based on whether viewing a commit or working directory
  useEffect(() => {
    const title = selectedCommit ? 'Commit Details' : 'Files';
    props.api.setTitle(title);
  }, [selectedCommit, props.api]);

  return (
    <DockviewPanelWrapper panelId="files" {...props} fallback={<FilesFallback />}>
      <FileList />
    </DockviewPanelWrapper>
  );
}
