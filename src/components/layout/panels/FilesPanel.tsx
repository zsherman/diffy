import { useEffect } from 'react';
import type { IDockviewPanelProps } from 'dockview-react';
import { DockviewPanelWrapper } from '../DockviewPanelWrapper';
import { FileList } from '../../../features/files/components';
import { useUIStore } from '../../../stores/ui-store';

export function FilesPanel(props: IDockviewPanelProps) {
  const { selectedCommit } = useUIStore();

  // Update panel title based on whether viewing a commit or working directory
  useEffect(() => {
    const title = selectedCommit ? 'Commit Details' : 'Files';
    props.api.setTitle(title);
  }, [selectedCommit, props.api]);

  return (
    <DockviewPanelWrapper panelId="files" {...props}>
      <FileList />
    </DockviewPanelWrapper>
  );
}
