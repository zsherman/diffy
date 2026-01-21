import React, { useMemo, useState, useCallback, useEffect, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { getStatus, getCommitDiff, stageFiles, unstageFiles, discardChanges } from '../../../lib/tauri';
import { useGitStore } from '../../../stores/git-store';
import { useUIStore } from '../../../stores/ui-store';
import { LoadingSpinner, SkeletonList } from '../../../components/ui';
import type { FileStatus, DiffFile } from '../../../types/git';

const STATUS_COLORS: Record<string, string> = {
  A: 'text-accent-green',
  M: 'text-accent-yellow',
  D: 'text-accent-red',
  R: 'text-accent-purple',
  '?': 'text-text-muted',
};

const STATUS_LABELS: Record<string, string> = {
  A: 'Added',
  M: 'Modified',
  D: 'Deleted',
  R: 'Renamed',
  '?': 'Untracked',
};

interface FileItem {
  type: 'header' | 'file';
  data: string | (FileStatus | DiffFile);
  section?: 'staged' | 'unstaged' | 'untracked' | 'commit';
}

// Memoized header row
const HeaderRow = memo(function HeaderRow({
  text,
  style,
}: {
  text: string;
  style: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className="px-2 py-1 text-xs font-semibold text-text-muted bg-bg-tertiary uppercase tracking-wider"
    >
      {text}
    </div>
  );
});

// Memoized file row
const FileRow = memo(function FileRow({
  file,
  isSelected,
  isFocused,
  style,
  onClick,
}: {
  file: FileStatus | DiffFile;
  isSelected: boolean;
  isFocused: boolean;
  style: React.CSSProperties;
  onClick: (e: React.MouseEvent) => void;
}) {
  const status = file.status;
  const statusColor = STATUS_COLORS[status] || 'text-text-primary';

  return (
    <div
      style={style}
      className={`flex items-center px-2 py-1 cursor-pointer text-sm ${
        isFocused ? 'bg-bg-selected' : isSelected ? 'bg-bg-hover' : 'hover:bg-bg-hover'
      }`}
      onClick={onClick}
    >
      <span
        className={`w-5 font-mono text-xs ${statusColor}`}
        title={STATUS_LABELS[status]}
      >
        [{status}]
      </span>
      <span className="truncate text-text-primary ml-1">{file.path}</span>
      {'additions' in file && file.additions > 0 && (
        <span className="ml-auto text-xs text-accent-green">+{file.additions}</span>
      )}
      {'deletions' in file && file.deletions > 0 && (
        <span className="ml-1 text-xs text-accent-red">-{file.deletions}</span>
      )}
    </div>
  );
});

export function FileList() {
  const { repository } = useGitStore();
  const {
    selectedCommit,
    selectedFile,
    setSelectedFile,
    activePanel,
    viewMode,
    setViewMode,
  } = useUIStore();
  const queryClient = useQueryClient();
  const parentRef = React.useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Fetch working directory status
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['status', repository?.path],
    queryFn: () => getStatus(repository!.path),
    enabled: !!repository?.path && !selectedCommit,
    refetchInterval: 5000, // Poll every 5 seconds (reduced from 2s)
    staleTime: 2000,
  });

  // Fetch commit diff when a commit is selected
  const { data: commitDiff, isLoading: diffLoading } = useQuery({
    queryKey: ['commit-diff', repository?.path, selectedCommit],
    queryFn: () => getCommitDiff(repository!.path, selectedCommit!),
    enabled: !!repository?.path && !!selectedCommit,
    staleTime: 60000, // Commit diffs don't change, cache for 1 minute
  });

  // Mutations
  const stageMutation = useMutation({
    mutationFn: (paths: string[]) => stageFiles(repository!.path, paths),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['status'] }),
  });

  const unstageMutation = useMutation({
    mutationFn: (paths: string[]) => unstageFiles(repository!.path, paths),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['status'] }),
  });

  const discardMutation = useMutation({
    mutationFn: (paths: string[]) => discardChanges(repository!.path, paths),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['status'] }),
  });

  // Update view mode based on selection
  useEffect(() => {
    if (selectedCommit) {
      setViewMode('commit');
    } else {
      setViewMode('working');
    }
  }, [selectedCommit, setViewMode]);

  // Build flat list
  const flatList = useMemo<FileItem[]>(() => {
    if (selectedCommit && commitDiff) {
      // Commit view
      const items: FileItem[] = [];
      if (commitDiff.files.length > 0) {
        items.push({ type: 'header', data: `Changed Files (${commitDiff.files.length})` });
        commitDiff.files.forEach((f) => items.push({ type: 'file', data: f, section: 'commit' }));
      }
      return items;
    }

    // Working directory view
    if (!status) return [];

    const items: FileItem[] = [];

    if (status.staged.length > 0) {
      items.push({ type: 'header', data: `Staged (${status.staged.length})` });
      status.staged.forEach((f) => items.push({ type: 'file', data: f, section: 'staged' }));
    }

    if (status.unstaged.length > 0) {
      items.push({ type: 'header', data: `Unstaged (${status.unstaged.length})` });
      status.unstaged.forEach((f) => items.push({ type: 'file', data: f, section: 'unstaged' }));
    }

    if (status.untracked.length > 0) {
      items.push({ type: 'header', data: `Untracked (${status.untracked.length})` });
      status.untracked.forEach((f) => items.push({ type: 'file', data: f, section: 'untracked' }));
    }

    return items;
  }, [status, commitDiff, selectedCommit]);

  const virtualizer = useVirtualizer({
    count: flatList.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 5,
  });

  // Keyboard navigation
  useEffect(() => {
    if (activePanel !== 'files') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = prev + 1;
          while (next < flatList.length && flatList[next].type === 'header') {
            next++;
          }
          return Math.min(next, flatList.length - 1);
        });
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = prev - 1;
          while (next >= 0 && flatList[next].type === 'header') {
            next--;
          }
          return Math.max(next, 0);
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = flatList[focusedIndex];
        if (item && item.type === 'file') {
          const file = item.data as FileStatus | DiffFile;
          setSelectedFile(file.path);
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        const item = flatList[focusedIndex];
        if (item && item.type === 'file' && item.section) {
          const file = item.data as FileStatus;
          if (item.section === 'staged') {
            unstageMutation.mutate([file.path]);
          } else {
            stageMutation.mutate([file.path]);
          }
        }
      } else if (e.key === 'u') {
        e.preventDefault();
        const item = flatList[focusedIndex];
        if (item && item.type === 'file' && item.section === 'staged') {
          const file = item.data as FileStatus;
          unstageMutation.mutate([file.path]);
        }
      } else if (e.key === 'd') {
        e.preventDefault();
        const item = flatList[focusedIndex];
        if (item && item.type === 'file' && item.section === 'unstaged') {
          const file = item.data as FileStatus;
          if (confirm(`Discard changes to ${file.path}?`)) {
            discardMutation.mutate([file.path]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activePanel,
    flatList,
    focusedIndex,
    setSelectedFile,
    stageMutation,
    unstageMutation,
    discardMutation,
  ]);

  // Scroll focused item into view
  useEffect(() => {
    virtualizer.scrollToIndex(focusedIndex, { align: 'auto' });
  }, [focusedIndex, virtualizer]);

  const handleFileClick = useCallback(
    (e: React.MouseEvent, file: FileStatus | DiffFile, index: number) => {
      e.stopPropagation();
      console.log('FileList: clicking file', file.path);
      setFocusedIndex(index);
      setSelectedFile(file.path);
    },
    [setSelectedFile]
  );

  const isLoading = statusLoading || diffLoading;

  if (isLoading && flatList.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center py-3 px-2">
          <LoadingSpinner size="sm" message="Loading files..." />
        </div>
        <div className="flex-1 px-2 overflow-hidden">
          <SkeletonList rows={6} />
        </div>
      </div>
    );
  }

  if (flatList.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        No changes
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = flatList[virtualItem.index];
            const style: React.CSSProperties = {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            };

            if (item.type === 'header') {
              return (
                <HeaderRow
                  key={virtualItem.key}
                  text={item.data as string}
                  style={style}
                />
              );
            }

            const file = item.data as FileStatus | DiffFile;
            return (
              <FileRow
                key={virtualItem.key}
                file={file}
                isSelected={selectedFile === file.path}
                isFocused={virtualItem.index === focusedIndex}
                style={style}
                onClick={(e) => handleFileClick(e, file, virtualItem.index)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
