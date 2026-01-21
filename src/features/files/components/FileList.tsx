import React, { useMemo, useState, useCallback, useEffect, memo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { VList } from 'virtua';
import type { VListHandle } from 'virtua';
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
}: {
  text: string;
}) {
  return (
    <div className="px-2 py-1 text-xs font-semibold text-text-muted bg-bg-tertiary uppercase tracking-wider">
      {text}
    </div>
  );
});

// Memoized file row
const FileRow = memo(function FileRow({
  file,
  isSelected,
  isFocused,
  onClick,
}: {
  file: FileStatus | DiffFile;
  isSelected: boolean;
  isFocused: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const status = file.status;
  const statusColor = STATUS_COLORS[status] || 'text-text-primary';

  return (
    <div
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
    setShowDiffPanel,
  } = useUIStore();
  const queryClient = useQueryClient();
  const listRef = useRef<VListHandle>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Fetch working directory status
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['status', repository?.path],
    queryFn: () => getStatus(repository!.path),
    enabled: !!repository?.path && !selectedCommit,
    refetchInterval: 5000,
    staleTime: 2000,
  });

  // Fetch commit files when a commit is selected (only keep file list, discard patch)
  const { data: commitFiles, isLoading: diffLoading } = useQuery({
    queryKey: ['commit-files', repository?.path, selectedCommit],
    queryFn: async () => {
      const diff = await getCommitDiff(repository!.path, selectedCommit!);
      return diff.files; // Only return files, let patch be garbage collected
    },
    enabled: !!repository?.path && !!selectedCommit,
    staleTime: 60000,
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
    if (selectedCommit && commitFiles) {
      // Commit view
      const items: FileItem[] = [];
      if (commitFiles.length > 0) {
        items.push({ type: 'header', data: `Changed Files (${commitFiles.length})` });
        commitFiles.forEach((f) => items.push({ type: 'file', data: f, section: 'commit' }));
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
  }, [status, commitFiles, selectedCommit]);

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
          setShowDiffPanel(true);
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
    setShowDiffPanel,
    stageMutation,
    unstageMutation,
    discardMutation,
  ]);

  // Scroll focused item into view
  useEffect(() => {
    listRef.current?.scrollToIndex(focusedIndex, { align: 'center' });
  }, [focusedIndex]);

  const handleFileClick = useCallback(
    (e: React.MouseEvent, file: FileStatus | DiffFile, index: number) => {
      e.stopPropagation();
      setFocusedIndex(index);
      setSelectedFile(file.path);
      setShowDiffPanel(true);
    },
    [setSelectedFile, setShowDiffPanel]
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
      <VList ref={listRef} className="flex-1">
        {flatList.map((item, index) => {
          if (item.type === 'header') {
            return (
              <HeaderRow
                key={`header-${item.data}`}
                text={item.data as string}
              />
            );
          }

          const file = item.data as FileStatus | DiffFile;
          return (
            <FileRow
              key={file.path}
              file={file}
              isSelected={selectedFile === file.path}
              isFocused={index === focusedIndex}
              onClick={(e) => handleFileClick(e, file, index)}
            />
          );
        })}
      </VList>
    </div>
  );
}
