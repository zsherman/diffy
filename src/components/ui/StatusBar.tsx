import { GearSix } from '@phosphor-icons/react';
import { useUIStore } from '../../stores/ui-store';

export function StatusBar() {
  const { activePanel, setShowSettingsDialog } = useUIStore();

  const hints: Record<string, string> = {
    branches: 'j/k:navigate | Enter:checkout | Tab:next panel',
    commits: 'j/k:navigate | Enter:select | Tab:next panel',
    files: 'j/k:navigate | Space:stage | u:unstage | d:discard',
    diff: 'v:toggle view | Tab:next panel',
    staging: 'Stage/unstage files | Enter:commit',
    'merge-conflict': 'Ctrl+1:use ours | Ctrl+2:use theirs | Ctrl+Up/Down:navigate files',
  };

  return (
    <div className="flex items-center justify-between px-3 py-1 bg-bg-tertiary border-t border-border-primary text-xs">
      {/* Left: Context-sensitive hints */}
      <div className="text-text-muted">{hints[activePanel]}</div>

      {/* Right: Settings and Help */}
      <div className="flex items-center gap-3 text-text-muted">
        <button
          onClick={() => setShowSettingsDialog(true)}
          className="p-1 rounded hover:bg-bg-hover transition-colors hover:text-text-primary"
          title="Settings"
        >
          <GearSix size={16} weight="bold" />
        </button>
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 bg-bg-hover rounded text-xs">?</span>
          <span>help</span>
        </div>
      </div>
    </div>
  );
}
