import { memo, forwardRef } from 'react';
import { Lock, Warning, Circle, FolderOpen } from '@phosphor-icons/react';
import type { WorktreeInfo } from '../../../types/git';

interface WorktreeRowProps extends React.HTMLAttributes<HTMLDivElement> {
  worktree: WorktreeInfo;
  isSelected: boolean;
  isFocused: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}

export const WorktreeRow = memo(forwardRef<HTMLDivElement, WorktreeRowProps>(function WorktreeRow({
  worktree,
  isSelected,
  isFocused,
  onClick,
  onDoubleClick,
  className,
  ...props
}, ref) {
  return (
    <div
      ref={ref}
      className={`flex items-center px-2 py-1.5 cursor-pointer text-sm ${
        isFocused ? 'bg-bg-selected' : isSelected ? 'bg-bg-hover' : 'hover:bg-bg-hover'
      } ${className || ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      {...props}
    >
      {/* Icon */}
      <span className={`mr-2 ${worktree.isMain ? 'text-accent-green' : 'text-text-muted'}`}>
        {worktree.isMain ? (
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
              worktree.isMain ? 'text-accent-green font-medium' : 'text-text-primary'
            }`}
          >
            {worktree.name}
          </span>
          {worktree.headBranch && (
            <span className="text-xs text-text-muted truncate">
              ({worktree.headBranch})
            </span>
          )}
        </div>
        <div className="text-xs text-text-muted truncate">{worktree.path}</div>
      </div>

      {/* Status indicators */}
      <div className="flex items-center gap-1 ml-2">
        {worktree.isDirty && (
          <span title="Has uncommitted changes">
            <Circle size={8} weight="fill" className="text-accent-yellow" />
          </span>
        )}
        {worktree.isLocked && (
          <span title={worktree.lockReason || 'Locked'}>
            <Lock size={14} className="text-accent-orange" />
          </span>
        )}
        {worktree.isPrunable && (
          <span title="Invalid worktree (prunable)">
            <Warning size={14} className="text-accent-red" />
          </span>
        )}
      </div>
    </div>
  );
}));
