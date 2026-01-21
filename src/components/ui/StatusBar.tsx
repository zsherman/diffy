import { useGitStore } from '../../stores/git-store';
import { useUIStore } from '../../stores/ui-store';

export function StatusBar() {
  const { repository } = useGitStore();
  const { activePanel, diffViewMode } = useUIStore();

  const hints: Record<string, string> = {
    branches: 'j/k:navigate | Enter:checkout | Tab:next panel',
    commits: 'j/k:navigate | Enter:select | Tab:next panel',
    files: 'j/k:navigate | Space:stage | u:unstage | d:discard',
    diff: 'v:toggle view | Tab:next panel',
    staging: 'Stage/unstage files | Enter:commit',
  };

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-bg-tertiary border-t border-border-primary text-xs">
      {/* Left: Branch and sync status */}
      <div className="flex items-center gap-3">
        {repository?.head_branch && (
          <span className="flex items-center gap-1 text-accent-green">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
              <path
                fillRule="evenodd"
                d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z"
              />
            </svg>
            {repository.head_branch}
          </span>
        )}
        <span className="text-text-muted">
          View: {diffViewMode === 'split' ? 'Split' : 'Unified'}
        </span>
      </div>

      {/* Center: Context-sensitive hints */}
      <div className="text-text-muted">{hints[activePanel]}</div>

      {/* Right: Help shortcut */}
      <div className="flex items-center gap-2 text-text-muted">
        <span className="px-1.5 py-0.5 bg-bg-hover rounded text-xs">?</span>
        <span>help</span>
      </div>
    </div>
  );
}
