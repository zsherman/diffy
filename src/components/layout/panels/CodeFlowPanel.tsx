import type { IDockviewPanelProps } from "dockview-react";
import { DockviewPanelWrapper } from "../DockviewPanelWrapper";
import { CodeFlowView } from "../../../features/codeflow/components";

export function CodeFlowPanel(props: IDockviewPanelProps) {
  return (
    <DockviewPanelWrapper panelId="codeflow" {...props}>
      <CodeFlowView />
    </DockviewPanelWrapper>
  );
}
