import { memo } from 'react';
import { PencilSimple } from '@phosphor-icons/react';
import type { CommitInfo } from '../../../types/git';

interface CommitMessageCellProps {
  commit: CommitInfo;
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
}

export const CommitMessageCell = memo(function CommitMessageCell({
  commit,
}: CommitMessageCellProps) {
  return (
    <div className="flex-1 min-w-0 px-2 py-1">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-accent-yellow font-mono text-xs shrink-0">
          {commit.short_id}
        </span>
        <span className="text-text-primary text-sm truncate">
          {commit.summary}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <span className="truncate max-w-[120px]">{commit.author_name}</span>
        <span>•</span>
        <span>{formatTimeAgo(commit.time)}</span>
        {commit.files_changed > 0 && (
          <>
            <span>•</span>
            <span className="flex items-center gap-1">
              <PencilSimple size={12} weight="bold" />
              {commit.files_changed}
            </span>
            {commit.additions > 0 && (
              <span className="text-accent-green">+{commit.additions}</span>
            )}
            {commit.deletions > 0 && (
              <span className="text-accent-red">-{commit.deletions}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
});
