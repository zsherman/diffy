import {
  useMemo,
  useState,
  useCallback,
  useEffect,
  memo,
  useRef,
  useDeferredValue,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { VList } from "virtua";
import type { VListHandle } from "virtua";
import { PencilSimple } from "@phosphor-icons/react";
import { getCommitHistory, getCommitGraph } from "../../../lib/tauri";
import {
  useTabsStore,
  useActiveTabState,
  useActiveTabPanels,
} from "../../../stores/tabs-store";
import { useActivePanel, usePanelFontSize } from "../../../stores/ui-store";
import { CommitGraphSVG } from "./CommitGraph";
import type { CommitInfo } from "../../../types/git";
import { createMountLogger } from "../../../lib/perf";

const ROW_HEIGHT = 48;
const GRAPH_WIDTH = 24;

function formatTimeAgo(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return "just now";
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
  fontSize,
}: {
  commit: CommitInfo;
  isSelected: boolean;
  isFocused: boolean;
  onClick: () => void;
  fontSize: number;
}) {
  return (
    <div
      className={`flex items-center cursor-pointer h-12 ${
        isFocused
          ? "bg-bg-selected"
          : isSelected
            ? "bg-bg-hover"
            : "hover:bg-bg-hover"
      }`}
      onClick={onClick}
    >
      <div style={{ width: GRAPH_WIDTH, flexShrink: 0 }} />
      <div className="flex-1 min-w-0 px-2 py-1 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-accent-yellow font-mono shrink-0"
            style={{ fontSize: `${fontSize}px` }}
          >
            {commit.shortId}
          </span>
          <span
            className="text-text-primary truncate"
            style={{ fontSize: `${fontSize}px` }}
          >
            {commit.summary}
          </span>
        </div>
        <div
          className="flex items-center gap-1.5 text-text-muted whitespace-nowrap overflow-hidden"
          style={{ fontSize: `${Math.max(10, fontSize - 2)}px` }}
        >
          <span className="truncate max-w-[100px]">{commit.authorName}</span>
          <span className="shrink-0">•</span>
          <span className="shrink-0">{formatTimeAgo(commit.time)}</span>
          {commit.filesChanged > 0 && (
            <>
              <span className="shrink-0">•</span>
              <span className="flex items-center gap-0.5 shrink-0">
                <PencilSimple size={10} weight="bold" />
                {commit.filesChanged}
              </span>
              {commit.additions > 0 && (
                <span className="text-accent-green shrink-0">
                  +{commit.additions}
                </span>
              )}
              {commit.deletions > 0 && (
                <span className="text-accent-red shrink-0">
                  -{commit.deletions}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export function CommitList() {
  const { repository } = useTabsStore();
  const {
    selectedBranch,
    selectedCommit,
    setSelectedCommit,
    commitFilter,
    setCommitFilter,
    setSelectedFile,
  } = useActiveTabState();
  // Use focused hooks - avoids re-render when unrelated state changes
  const { activePanel } = useActivePanel();
  const { setShowFilesPanel } = useActiveTabPanels();
  const panelFontSize = usePanelFontSize();
  const listRef = useRef<VListHandle>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });

  // Track mount/unmount for performance debugging
  useEffect(() => createMountLogger("CommitList"), []);

  // Fetch commits - use regular query with placeholderData to avoid Suspense flash on tab switch
  // The data is prefetched in TabBar.handleSwitchTab before the switch happens
  const { data: commits = [], isLoading: isLoadingCommits } = useQuery({
    queryKey: ["commits", repository?.path, selectedBranch],
    queryFn: () =>
      getCommitHistory(repository!.path, selectedBranch ?? undefined, 200),
    staleTime: 30000,
    enabled: !!repository?.path,
    // Keep showing previous data while fetching new data (smooth transitions)
    placeholderData: (previousData) => previousData,
  });

  // Stable key for graph query - only changes when commits actually change
  const commitIdsKey = useMemo(
    () => (commits.length > 0 ? commits[0].id + commits.length : ""),
    [commits],
  );

  // Fetch graph data (non-suspense, loads in background)
  // Use 'commitListGraph' key to avoid collision with GraphTableView's graph query
  const { data: graph } = useQuery({
    queryKey: ["commitListGraph", repository?.path, selectedBranch, commitIdsKey],
    queryFn: () =>
      getCommitGraph(
        repository!.path,
        commits.map((c) => c.id),
      ),
    enabled: !!repository?.path && commits.length > 0,
    staleTime: 30000,
  });

  // Defer filter value to keep typing responsive while filtering large lists
  const deferredFilter = useDeferredValue(commitFilter);

  // Filter commits - uses deferred value so typing stays responsive
  const filteredCommits = useMemo(() => {
    if (!deferredFilter) return commits;
    const lower = deferredFilter.toLowerCase();
    return commits.filter(
      (c) =>
        c.summary.toLowerCase().includes(lower) ||
        c.authorName.toLowerCase().includes(lower) ||
        c.shortId.toLowerCase().includes(lower),
    );
  }, [commits, deferredFilter]);

  // Keyboard navigation
  useEffect(() => {
    if (activePanel !== "commits") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) =>
          Math.min(prev + 1, filteredCommits.length - 1),
        );
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const commit = filteredCommits[focusedIndex];
        if (commit) {
          setSelectedCommit(commit.id);
          setSelectedFile(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activePanel,
    filteredCommits,
    focusedIndex,
    setSelectedCommit,
    setSelectedFile,
  ]);

  // Scroll focused item into view
  useEffect(() => {
    listRef.current?.scrollToIndex(focusedIndex, { align: "center" });
  }, [focusedIndex]);

  const handleCommitClick = useCallback(
    (commit: CommitInfo, index: number) => {
      setFocusedIndex(index);
      setSelectedCommit(commit.id);
      setSelectedFile(null);
      setShowFilesPanel(true);
    },
    [setSelectedCommit, setSelectedFile, setShowFilesPanel],
  );

  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    const handle = listRef.current;
    const startIndex = handle.findItemIndex(handle.scrollOffset);
    const endIndex = handle.findItemIndex(
      handle.scrollOffset + handle.viewportSize,
    );
    setVisibleRange({ start: startIndex, end: endIndex });
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Filter input */}
      <div className="px-2 py-1.5 border-b border-border-primary">
        <input
          type="text"
          placeholder="Filter commits..."
          value={commitFilter}
          onChange={(e) => setCommitFilter(e.target.value)}
          className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-none"
          style={{ fontSize: `${panelFontSize}px` }}
        />
      </div>

      {/* Commit list */}
      <div className="flex-1 relative overflow-hidden">
        {/* Loading state for initial load */}
        {isLoadingCommits && commits.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            Loading commits...
          </div>
        ) : (
          <>
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
            <VList ref={listRef} className="h-full" onScroll={handleScroll}>
              {filteredCommits.map((commit, index) => (
                <CommitRow
                  key={commit.id}
                  commit={commit}
                  isSelected={selectedCommit === commit.id}
                  isFocused={index === focusedIndex}
                  onClick={() => handleCommitClick(commit, index)}
                  fontSize={panelFontSize}
                />
              ))}
            </VList>
          </>
        )}
      </div>
    </div>
  );
}
