import { memo } from 'react';
import { Lock, Warning, Circle, FolderOpen } from '@phosphor-icons/react';
import type { WorktreeInfo } from '../../../types/git';

interface WorktreeRowProps {
  worktree: WorktreeInfo;
  isSelected: boolean;
  isFocused: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}

export const WorktreeRow = memo(function WorktreeRow({
  worktree,
  isSelected,
  isFocused,
  onClick,
  onDoubleClick,
}: WorktreeRowProps) {
  return (
    <div
      className={`flex items-center px-2 py-1.5 cursor-pointer text-sm ${
        isFocused ? 'bg-bg-selected' : isSelected ? 'bg-bg-hover' : 'hover:bg-bg-hover'
      }`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* Icon */}
      <span className={`mr-2 ${worktree.is_main ? 'text-accent-green' : 'text-text-muted'}`}>
        {worktree.is_main ? (
          <FolderOpen size={14} weight="fill" />
        ) : (
          <FolderOpen size={14} />
        )}
      </span>

      {/* Name and branch */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={`truncate ${
              worktree.is_main ? 'text-accent-green font-medium' : 'text-text-primary'
            }`}
          >
            {worktree.name}
          </span>
          {worktree.head_branch && (
            <span className="text-xs text-text-muted truncate">
              ({worktree.head_branch})
            </span>
          )}
        </div>
        <div className="text-xs text-text-muted truncate">{worktree.path}</div>
      </div>

      {/* Status indicators */}
      <div className="flex items-center gap-1 ml-2">
        {worktree.is_dirty && (
          <span title="Has uncommitted changes">
            <Circle size={8} weight="fill" className="text-accent-yellow" />
          </span>
        )}
        {worktree.is_locked && (
          <span title={worktree.lock_reason || 'Locked'}>
            <Lock size={14} className="text-accent-orange" />
          </span>
        )}
        {worktree.is_prunable && (
          <span title="Invalid worktree (prunable)">
            <Warning size={14} className="text-accent-red" />
          </span>
        )}
      </div>
    </div>
  );
});
