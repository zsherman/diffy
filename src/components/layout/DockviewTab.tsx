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
  type IconProps,
} from '@phosphor-icons/react';

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
};

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
    <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium select-none">
      {Icon && (
        <Icon
          size={14}
          weight="bold"
          className={isActive ? 'text-accent-blue' : 'opacity-60'}
        />
      )}
      <span>{title}</span>
    </div>
  );
}
