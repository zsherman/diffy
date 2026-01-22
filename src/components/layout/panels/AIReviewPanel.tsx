import type { IDockviewPanelProps } from 'dockview-react';
import { DockviewPanelWrapper } from '../DockviewPanelWrapper';
import { AIReviewContent } from '../../../features/ai-review/components';

export function AIReviewPanel(props: IDockviewPanelProps) {
  return (
    <DockviewPanelWrapper panelId="ai-review" {...props}>
      <AIReviewContent />
    </DockviewPanelWrapper>
  );
}
