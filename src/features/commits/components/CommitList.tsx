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
import { getCommitHistory } from "../../../lib/tauri";
import { CommitContextMenu } from "../../../components/ui";
import {
  useTabsStore,
  useActiveTabState,
  useActiveTabPanels,
} from "../../../stores/tabs-store";
import { useActivePanel, usePanelFontSize } from "../../../stores/ui-store";
import { AuthorAvatar } from "../../graph/components/AuthorAvatar";
import type { CommitInfo } from "../../../types/git";
import { createMountLogger } from "../../../lib/perf";

const ROW_HEIGHT = 50;

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
  repoPath,
}: {
  commit: CommitInfo;
  isSelected: boolean;
  isFocused: boolean;
  onClick: () => void;
  fontSize: number;
  repoPath: string;
}) {
  return (
    <CommitContextMenu
      commitId={commit.id}
      shortId={commit.shortId}
      message={commit.message}
      repoPath={repoPath}
    >
      <div
        className={`@container flex items-center cursor-pointer border-b border-black/20 ${
          isFocused
            ? "bg-bg-selected"
            : isSelected
              ? "bg-bg-hover"
              : "hover:bg-bg-hover/50"
        }`}
        style={{ height: ROW_HEIGHT }}
        onClick={onClick}
      >
        {/* Author avatar */}
        <div className="pl-3 pr-2.5 shrink-0">
          <AuthorAvatar email={commit.authorEmail} size={24} />
        </div>
        
        <div className="flex-1 min-w-0 pr-3 py-1.5 overflow-hidden">
          {/* Commit message - primary focus */}
          <div
            className="text-text-primary truncate font-medium leading-snug"
            style={{ fontSize: `${fontSize}px` }}
          >
            {commit.summary}
          </div>
          
          {/* Metadata row */}
          <div
            className="flex items-center gap-1.5 text-text-muted mt-0.5 overflow-hidden"
            style={{ fontSize: `${Math.max(11, fontSize - 2)}px` }}
          >
            <span className="truncate min-w-0 shrink">{commit.authorName}</span>
            <span className="opacity-40 shrink-0">•</span>
            <span className="opacity-70 shrink-0">{formatTimeAgo(commit.time)}</span>
            {commit.filesChanged > 0 && (
              <>
                <span className="opacity-40 shrink-0">•</span>
                <span className="opacity-70 shrink-0">{commit.filesChanged} files</span>
                <span className="text-accent-green shrink-0">+{commit.additions}</span>
                <span className="text-accent-red shrink-0">-{commit.deletions}</span>
              </>
            )}
          </div>
        </div>
        
        {/* Commit ID on the right - hidden at small container sizes */}
        <div className="pr-3 shrink-0 hidden @[280px]:block">
          <span 
            className="font-mono text-text-muted/60"
            style={{ fontSize: `${Math.max(10, fontSize - 2)}px` }}
          >
            {commit.shortId}
          </span>
        </div>
      </div>
    </CommitContextMenu>
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

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Filter input */}
      <div className="px-3 py-2 border-b border-black/20">
        <input
          type="text"
          placeholder="Filter commits..."
          value={commitFilter}
          onChange={(e) => setCommitFilter(e.target.value)}
          className="w-full px-3 py-1.5 bg-bg-tertiary border border-black/30 rounded-md text-text-primary placeholder-text-muted/60 focus:border-accent-blue/60 focus:outline-hidden focus:ring-1 focus:ring-accent-blue/20 transition-all duration-150"
          style={{ fontSize: `${panelFontSize}px` }}
        />
      </div>

      {/* Commit list */}
      <div className="flex-1 overflow-hidden">
        {/* Loading state for initial load */}
        {isLoadingCommits && commits.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            Loading commits...
          </div>
        ) : (
          <VList ref={listRef} className="h-full">
            {filteredCommits.map((commit, index) => (
              <CommitRow
                key={commit.id}
                commit={commit}
                isSelected={selectedCommit === commit.id}
                isFocused={index === focusedIndex}
                onClick={() => handleCommitClick(commit, index)}
                fontSize={panelFontSize}
                repoPath={repository?.path ?? ""}
              />
            ))}
          </VList>
        )}
      </div>
    </div>
  );
}
