import type { IDockviewPanelProps } from "dockview-react";
import { DockviewPanelWrapper } from "../DockviewPanelWrapper";
import { MermaidChangesView } from "../../../features/mermaid-changes/components";

export function MermaidChangesPanel(props: IDockviewPanelProps) {
  return (
    <DockviewPanelWrapper panelId="mermaid-changes" {...props}>
      <MermaidChangesView />
    </DockviewPanelWrapper>
  );
}
