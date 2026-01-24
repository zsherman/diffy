import { useMemo, useState, useCallback, useEffect, memo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { VList } from "virtua";
import type { VListHandle } from "virtua";
import { ArrowClockwise, GitCommit, ArrowsLeftRight, GitMerge, ArrowBendUpLeft } from "@phosphor-icons/react";
import { getReflog } from "../../../lib/tauri";
import { useTabsStore } from "../../../stores/tabs-store";
import { useActivePanel, usePanelFontSize } from "../../../stores/ui-store";
import type { ReflogEntry } from "../../../types/git";

const ROW_HEIGHT = 44;

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

// Determine the icon based on reflog message
function getReflogIcon(message: string): React.ReactNode {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.startsWith("commit")) {
    return <GitCommit size={14} weight="bold" className="text-accent-green" />;
  }
  if (lowerMessage.startsWith("checkout") || lowerMessage.startsWith("branch")) {
    return <ArrowsLeftRight size={14} weight="bold" className="text-accent-blue" />;
  }
  if (lowerMessage.startsWith("merge")) {
    return <GitMerge size={14} weight="bold" className="text-accent-purple" />;
  }
  if (lowerMessage.startsWith("reset") || lowerMessage.startsWith("rebase")) {
    return <ArrowBendUpLeft size={14} weight="bold" className="text-accent-yellow" />;
  }
  if (lowerMessage.startsWith("pull")) {
    return <ArrowBendUpLeft size={14} weight="bold" className="text-accent-cyan" />;
  }
  return <GitCommit size={14} weight="bold" className="text-text-muted" />;
}

// Memoized reflog row component
const ReflogRow = memo(function ReflogRow({
  entry,
  isFocused,
  onClick,
  fontSize,
}: {
  entry: ReflogEntry;
  isFocused: boolean;
  onClick: () => void;
  fontSize: number;
}) {
  return (
    <div
      className={`flex items-center cursor-pointer px-2 py-1.5 ${
        isFocused ? "bg-bg-selected" : "hover:bg-bg-hover"
      }`}
      style={{ height: ROW_HEIGHT }}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mr-2 shrink-0">
        {getReflogIcon(entry.message)}
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-accent-yellow font-mono shrink-0"
            style={{ fontSize: `${fontSize}px` }}
          >
            {entry.shortOid}
          </span>
          <span
            className="text-text-primary truncate"
            style={{ fontSize: `${fontSize}px` }}
          >
            {entry.message}
          </span>
        </div>
        <div
          className="flex items-center gap-1.5 text-text-muted whitespace-nowrap overflow-hidden"
          style={{ fontSize: `${Math.max(10, fontSize - 2)}px` }}
        >
          <span className="text-text-muted/70">{entry.selector}</span>
          <span className="shrink-0">•</span>
          <span className="shrink-0">{formatTimeAgo(entry.time)}</span>
        </div>
      </div>
    </div>
  );
});

export function ReflogView() {
  const { repository } = useTabsStore();
  const { activePanel } = useActivePanel();
  const panelFontSize = usePanelFontSize();
  const listRef = useRef<VListHandle>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [filter, setFilter] = useState("");

  // Fetch reflog entries
  const { data: entries = [], isLoading, refetch } = useQuery({
    queryKey: ["reflog", repository?.path],
    queryFn: () => getReflog(repository!.path, 200),
    staleTime: 30000,
    enabled: !!repository?.path,
    placeholderData: (previousData) => previousData,
  });

  // Filter entries based on search
  const filteredEntries = useMemo(() => {
    if (!filter) return entries;
    const lower = filter.toLowerCase();
    return entries.filter(
      (e) =>
        e.message.toLowerCase().includes(lower) ||
        e.shortOid.toLowerCase().includes(lower) ||
        e.selector.toLowerCase().includes(lower)
    );
  }, [entries, filter]);

  // Keyboard navigation
  useEffect(() => {
    if (activePanel !== "reflog") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) =>
          Math.min(prev + 1, filteredEntries.length - 1)
        );
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "r") {
        e.preventDefault();
        refetch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePanel, filteredEntries.length, refetch]);

  // Scroll focused item into view
  useEffect(() => {
    listRef.current?.scrollToIndex(focusedIndex, { align: "center" });
  }, [focusedIndex]);

  const handleRowClick = useCallback((index: number) => {
    setFocusedIndex(index);
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <div className="flex flex-col h-full">
      {/* Header with filter and refresh */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border-primary">
        <input
          type="text"
          placeholder="Filter reflog..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-none"
          style={{ fontSize: `${panelFontSize}px` }}
        />
        <button
          onClick={handleRefresh}
          className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
          title="Refresh reflog (r)"
        >
          <ArrowClockwise size={14} weight="bold" />
        </button>
      </div>

      {/* Reflog list */}
      <div className="flex-1 relative overflow-hidden">
        {isLoading && entries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            Loading reflog...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            {filter ? "No matching entries" : "No reflog entries"}
          </div>
        ) : (
          <VList ref={listRef} className="h-full">
            {filteredEntries.map((entry, index) => (
              <ReflogRow
                key={`${entry.selector}-${entry.oid}`}
                entry={entry}
                isFocused={index === focusedIndex}
                onClick={() => handleRowClick(index)}
                fontSize={panelFontSize}
              />
            ))}
          </VList>
        )}
      </div>

      {/* Footer with count */}
      <div className="px-2 py-1 border-t border-border-primary text-text-muted text-xs">
        {filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"}
        {filter && entries.length !== filteredEntries.length && (
          <span> (filtered from {entries.length})</span>
        )}
      </div>
    </div>
  );
}
