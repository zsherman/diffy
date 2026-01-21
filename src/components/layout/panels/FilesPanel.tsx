import type { IDockviewPanelProps } from 'dockview-react';
import { DockviewPanelWrapper } from '../DockviewPanelWrapper';
import { FileList } from '../../../features/files/components';

export function FilesPanel(props: IDockviewPanelProps) {
  return (
    <DockviewPanelWrapper panelId="files" {...props}>
      <FileList />
    </DockviewPanelWrapper>
  );
}
