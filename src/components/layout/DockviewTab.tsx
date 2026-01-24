import { useState, useEffect } from 'react';
import type { IDockviewPanelHeaderProps } from 'dockview-react';
import {
  GitCommit,
  Files,
  FileCode,
  GitBranch,
  Tray,
  Sparkle,
  Tree,
  ChartBar,
  GitMerge,
  ClockCounterClockwise,
  type IconProps,
} from '@phosphor-icons/react';
import { useActiveTabAIReview } from '../../stores/tabs-store';

type IconComponent = React.ComponentType<IconProps>;

const panelIcons: Record<string, IconComponent> = {
  commits: GitCommit,
  files: Files,
  diff: FileCode,
  branches: GitBranch,
  staging: Tray,
  'ai-review': Sparkle,
  worktrees: Tree,
  graph: ChartBar,
  'merge-conflict': GitMerge,
  reflog: ClockCounterClockwise,
};

// Status indicator for AI Review panel
function AIReviewStatusIndicator() {
  const { aiReviewLoading } = useActiveTabAIReview();

  if (!aiReviewLoading) return null;

  return (
    <span className="w-2 h-2 rounded-full bg-accent-yellow animate-pulse" />
  );
}

export function DockviewTab({ api }: IDockviewPanelHeaderProps) {
  const [isActive, setIsActive] = useState(api.isActive);
  const panelId = api.id;
  const title = api.title || panelId;
  const Icon = panelIcons[panelId];

  useEffect(() => {
    const disposable = api.onDidActiveChange(() => {
      setIsActive(api.isActive);
    });
    return () => disposable.dispose();
  }, [api]);

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium select-none text-text-primary">
      {Icon && (
        <Icon
          size={14}
          weight="bold"
          className={isActive ? "text-accent-blue" : "text-text-muted"}
        />
      )}
      <span className={isActive ? "text-text-primary" : "text-text-muted"}>
        {title}
      </span>
      {panelId === 'ai-review' && <AIReviewStatusIndicator />}
    </div>
  );
}
