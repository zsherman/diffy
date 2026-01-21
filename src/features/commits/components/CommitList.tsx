import React, { useMemo, useState, useCallback, useEffect, memo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { VList } from 'virtua';
import type { VListHandle } from 'virtua';
import { getCommitHistory, getCommitGraph } from '../../../lib/tauri';
import { useGitStore } from '../../../stores/git-store';
import { useUIStore } from '../../../stores/ui-store';
import { LoadingSpinner, SkeletonCommits } from '../../../components/ui';
import { CommitGraphSVG } from './CommitGraph';
import type { CommitInfo } from '../../../types/git';

const ROW_HEIGHT = 48;
const GRAPH_WIDTH = 80;

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

// Memoized commit row component
const CommitRow = memo(function CommitRow({
  commit,
  isSelected,
  isFocused,
  onClick,
}: {
  commit: CommitInfo;
  isSelected: boolean;
  isFocused: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`flex items-center cursor-pointer h-12 ${
        isFocused ? 'bg-bg-selected' : isSelected ? 'bg-bg-hover' : 'hover:bg-bg-hover'
      }`}
      onClick={onClick}
    >
      <div style={{ width: GRAPH_WIDTH, flexShrink: 0 }} />
      <div className="flex-1 min-w-0 px-2 py-1">
        <div className="flex items-center gap-2">
          <span className="text-accent-yellow font-mono text-xs">
            {commit.short_id}
          </span>
          <span className="text-text-primary text-sm truncate flex-1">
            {commit.summary}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>{commit.author_name}</span>
          <span>•</span>
          <span>{formatTimeAgo(commit.time)}</span>
        </div>
      </div>
    </div>
  );
});

export function CommitList() {
  const { repository } = useGitStore();
  const {
    selectedBranch,
    selectedCommit,
    setSelectedCommit,
    commitFilter,
    setCommitFilter,
    activePanel,
    setSelectedFile,
  } = useUIStore();
  const listRef = useRef<VListHandle>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });

  // Fetch commits
  const { data: commits = [], isLoading } = useQuery({
    queryKey: ['commits', repository?.path, selectedBranch],
    queryFn: () => getCommitHistory(repository!.path, selectedBranch ?? undefined, 200),
    enabled: !!repository?.path,
    staleTime: 30000,
  });

  // Stable key for graph query - only changes when commits actually change
  const commitIdsKey = useMemo(
    () => commits.length > 0 ? commits[0].id + commits.length : '',
    [commits]
  );

  // Fetch graph data
  const { data: graph } = useQuery({
    queryKey: ['graph', repository?.path, commitIdsKey],
    queryFn: () => getCommitGraph(repository!.path, commits.map((c) => c.id)),
    enabled: !!repository?.path && commits.length > 0,
    staleTime: 30000,
  });

  // Filter commits
  const filteredCommits = useMemo(() => {
    if (!commitFilter) return commits;
    const lower = commitFilter.toLowerCase();
    return commits.filter(
      (c) =>
        c.summary.toLowerCase().includes(lower) ||
        c.author_name.toLowerCase().includes(lower) ||
        c.short_id.toLowerCase().includes(lower)
    );
  }, [commits, commitFilter]);

  // Keyboard navigation
  useEffect(() => {
    if (activePanel !== 'commits') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, filteredCommits.length - 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const commit = filteredCommits[focusedIndex];
        if (commit) {
          setSelectedCommit(commit.id);
          setSelectedFile(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePanel, filteredCommits, focusedIndex, setSelectedCommit, setSelectedFile]);

  // Scroll focused item into view
  useEffect(() => {
    listRef.current?.scrollToIndex(focusedIndex, { align: 'center' });
  }, [focusedIndex]);

  const handleCommitClick = useCallback(
    (commit: CommitInfo, index: number) => {
      setFocusedIndex(index);
      setSelectedCommit(commit.id);
      setSelectedFile(null);
    },
    [setSelectedCommit, setSelectedFile]
  );

  const handleRangeChange = useCallback((start: number, end: number) => {
    setVisibleRange({ start, end });
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center py-3 px-2">
          <LoadingSpinner size="sm" message="Loading commits..." />
        </div>
        <div className="flex-1 px-2 overflow-hidden">
          <SkeletonCommits rows={8} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter input */}
      <div className="px-2 py-1.5 border-b border-border-primary">
        <input
          type="text"
          placeholder="Filter commits..."
          value={commitFilter}
          onChange={(e) => setCommitFilter(e.target.value)}
          className="w-full px-2 py-1 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-none"
        />
      </div>

      {/* Commit list */}
      <div className="flex-1 relative overflow-hidden">
        {/* Graph overlay */}
        {graph && (
          <CommitGraphSVG
            graph={graph}
            rowHeight={ROW_HEIGHT}
            visibleStartIndex={visibleRange.start}
            visibleEndIndex={visibleRange.end}
          />
        )}

        {/* Commit rows */}
        <VList
          ref={listRef}
          className="h-full"
          onRangeChange={handleRangeChange}
        >
          {filteredCommits.map((commit, index) => (
            <CommitRow
              key={commit.id}
              commit={commit}
              isSelected={selectedCommit === commit.id}
              isFocused={index === focusedIndex}
              onClick={() => handleCommitClick(commit, index)}
            />
          ))}
        </VList>
      </div>
    </div>
  );
}
