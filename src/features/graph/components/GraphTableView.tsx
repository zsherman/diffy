import {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
  useDeferredValue,
} from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { VList } from "virtua";
import type { VListHandle } from "virtua";
import {
  getCommitHistoryAllBranches,
  getCommitGraph,
  listBranches,
} from "../../../lib/tauri";
import {
  useTabsStore,
  useActiveTabState,
  useActiveTabPanels,
} from "../../../stores/tabs-store";
import { useActivePanel, useGraphColumnWidths } from "../../../stores/ui-store";
import { LoadingSpinner, SkeletonCommits } from "../../../components/ui";
import { useCommitRefs } from "../hooks";
import { GraphTableHeader } from "./GraphTableHeader";
import { GraphTableRow } from "./GraphTableRow";
import type {
  CommitInfo,
  CommitGraph as CommitGraphType,
} from "../../../types/git";
import { createMountLogger } from "../../../lib/perf";
import { isPerfTracingEnabled } from "../../../stores/ui-store";

const ROW_HEIGHT = 48;
const MIN_BRANCH_TAG_WIDTH = 80;
const MAX_BRANCH_TAG_WIDTH = 300;
const MIN_GRAPH_WIDTH = 60;
const COLUMN_WIDTH = 16;
const PAGE_SIZE = 100;

export function GraphTableView() {
  const { repository } = useTabsStore();
  const {
    selectedCommit,
    setSelectedCommit,
    commitFilter,
    setCommitFilter,
    setSelectedFile,
  } = useActiveTabState();
  // Use focused hooks - avoids re-render when unrelated state changes
  const { activePanel } = useActivePanel();
  const { setShowFilesPanel } = useActiveTabPanels();
  const { graphColumnWidths, setGraphColumnWidths } = useGraphColumnWidths();
  const listRef = useRef<VListHandle>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Local column widths state for immediate UI response
  const [localColumnWidths, setLocalColumnWidths] = useState(graphColumnWidths);

  // Track mount/unmount for performance debugging
  useEffect(() => createMountLogger('GraphTableView'), []);

  // Sync local state with store on mount and when store changes externally
  useEffect(() => {
    setLocalColumnWidths(graphColumnWidths);
  }, [graphColumnWidths]);

  // Fetch commits from all branches with infinite scrolling
  const {
    data: commitsData,
    isLoading: isLoadingCommits,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["graph-commits", repository?.path],
    queryFn: ({ pageParam = 0 }) =>
      getCommitHistoryAllBranches(repository!.path, PAGE_SIZE, pageParam),
    getNextPageParam: (lastPage, allPages) => {
      // If we got fewer commits than requested, we've reached the end
      if (lastPage.length < PAGE_SIZE) return undefined;
      // Next offset is total commits fetched so far
      return allPages.reduce((sum, page) => sum + page.length, 0);
    },
    initialPageParam: 0,
    enabled: !!repository?.path,
    staleTime: 30000,
    refetchOnMount: false, // Don't refetch on tab switch - watcher handles updates
    placeholderData: (prev) => prev, // Keep showing previous data during transitions
  });

  // Flatten pages into single array
  const commits = useMemo(() => commitsData?.pages.flat() ?? [], [commitsData]);

  // Debug log (only when perf tracing enabled)
  useEffect(() => {
    if (isPerfTracingEnabled()) {
      console.log("[GraphTableView] Commits loaded:", {
        totalCommits: commits.length,
        hasNextPage,
        isFetchingNextPage,
        pages: commitsData?.pages.length,
      });
    }
  }, [
    commits.length,
    hasNextPage,
    isFetchingNextPage,
    commitsData?.pages.length,
  ]);

  // Fetch branches
  const { data: branches = [], isLoading: isLoadingBranches } = useQuery({
    queryKey: ["branches", repository?.path],
    queryFn: () => listBranches(repository!.path),
    enabled: !!repository?.path,
    staleTime: 30000,
    refetchOnMount: false, // Don't refetch on tab switch
  });

  // Build commit refs map
  const commitRefsMap = useCommitRefs(branches);

  // Stable key for graph query
  const commitIdsKey = useMemo(
    () => (commits.length > 0 ? commits[0].id + commits.length : ""),
    [commits],
  );

  // Fetch graph data
  // Use 'graphTableGraph' key to avoid collision with CommitList's graph query
  const { data: graph } = useQuery({
    queryKey: ["graphTableGraph", repository?.path, "allBranches", commitIdsKey],
    queryFn: () =>
      getCommitGraph(
        repository!.path,
        commits.map((c) => c.id),
      ),
    enabled: !!repository?.path && commits.length > 0,
    staleTime: 30000,
    refetchOnMount: false, // Don't refetch on tab switch
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

  // Calculate minimum graph width based on max columns
  const minGraphWidth = useMemo(() => {
    if (!graph) return MIN_GRAPH_WIDTH;
    return Math.max(
      MIN_GRAPH_WIDTH,
      (graph.maxColumns + 2) * COLUMN_WIDTH + 40,
    ); // +40 for avatar
  }, [graph]);

  // Handle column resize
  const handleResize = useCallback(
    (column: "branchTag" | "graph", width: number) => {
      const newWidths = {
        ...localColumnWidths,
        [column]: width,
      };
      setLocalColumnWidths(newWidths);
      // Debounce store update
      setGraphColumnWidths(newWidths);
    },
    [localColumnWidths, setGraphColumnWidths],
  );

  // Keyboard navigation
  useEffect(() => {
    if (activePanel !== "graph") return;

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

  // Load more when scrolling near the bottom
  const handleScroll = useCallback(() => {
    if (!listRef.current || !hasNextPage || isFetchingNextPage) return;

    const handle = listRef.current;
    const endIndex = handle.findItemIndex(
      handle.scrollOffset + handle.viewportSize,
    );

    // Guard against invalid index
    if (endIndex < 0) return;

    // Load more when within 15 items of the end
    if (endIndex >= commits.length - 15) {
      if (isPerfTracingEnabled()) {
        console.log("[GraphTableView] Loading more commits...", {
          endIndex,
          total: commits.length,
        });
      }
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, commits.length, fetchNextPage]);

  const isLoading = isLoadingCommits || isLoadingBranches;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center py-3 px-2">
          <LoadingSpinner size="sm" message="Loading graph..." />
        </div>
        <div className="flex-1 px-2 overflow-hidden">
          <SkeletonCommits rows={8} />
        </div>
      </div>
    );
  }

  // Create an empty graph if data isn't loaded yet
  const effectiveGraph: CommitGraphType = graph || { nodes: [], maxColumns: 0 };

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

      {/* Header */}
      <GraphTableHeader
        branchTagWidth={localColumnWidths.branchTag}
        graphWidth={Math.max(localColumnWidths.graph, minGraphWidth)}
        onResize={handleResize}
        minBranchTagWidth={MIN_BRANCH_TAG_WIDTH}
        maxBranchTagWidth={MAX_BRANCH_TAG_WIDTH}
        minGraphWidth={minGraphWidth}
      />

      {/* Rows */}
      <div className="flex-1 overflow-hidden">
        <VList ref={listRef} className="h-full" onScroll={handleScroll}>
          {filteredCommits.map((commit, index) => (
            <GraphTableRow
              key={commit.id}
              commit={commit}
              graph={effectiveGraph}
              rowIndex={index}
              rowHeight={ROW_HEIGHT}
              refs={commitRefsMap.get(commit.id) || []}
              branches={branches}
              branchTagWidth={localColumnWidths.branchTag}
              graphWidth={Math.max(localColumnWidths.graph, minGraphWidth)}
              isSelected={selectedCommit === commit.id}
              isFocused={index === focusedIndex}
              onClick={() => handleCommitClick(commit, index)}
              repoPath={repository?.path ?? ""}
            />
          ))}
          {isFetchingNextPage && (
            <div className="flex items-center justify-center py-4">
              <LoadingSpinner size="sm" message="Loading more commits..." />
            </div>
          )}
        </VList>
      </div>
    </div>
  );
}
