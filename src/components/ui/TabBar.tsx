import { useCallback, useEffect, useTransition } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "@phosphor-icons/react";
import { useTabsStore, useActiveTabState } from "../../stores/tabs-store";
import {
  openRepository,
  discoverRepository,
  getCommitHistory,
  getCommitHistoryAllBranches,
  getStatus,
} from "../../lib/tauri";
import { useToast } from "./Toast";
import { measureUntilPaint } from "../../lib/perf";

export function TabBar() {
  const { tabs, activeTabPath, openTab, closeTab, switchTab } = useTabsStore();
  const { commitMessage, commitDescription } = useActiveTabState();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  // Switch tab immediately; prefetch fires in background (hover should have warmed the cache)
  const handleSwitchTab = useCallback(
    (path: string) => {
      // Skip if already active
      if (path === activeTabPath) return;

      measureUntilPaint("TabBar.switchTab");

      // Fire prefetch in background (non-blocking) - hover likely already warmed cache
      queryClient.prefetchQuery({
        queryKey: ["commits", path, null],
        queryFn: () => getCommitHistory(path, undefined, 200),
        staleTime: 30000,
      });
      queryClient.prefetchQuery({
        queryKey: ["status", path],
        queryFn: () => getStatus(path),
        staleTime: 30000,
      });

      // Switch immediately - don't wait for prefetch
      startTransition(() => {
        switchTab(path);
      });
    },
    [switchTab, activeTabPath, queryClient],
  );

  // Prefetch data on tab hover to warm cache before switch
  const handleTabHover = useCallback(
    (repoPath: string) => {
      // Don't prefetch if already the active tab
      if (repoPath === activeTabPath) return;

      // Prefetch commits (main data needed for the commits panel)
      queryClient.prefetchQuery({
        queryKey: ["commits", repoPath, null], // null = default branch
        queryFn: () => getCommitHistory(repoPath, undefined, 200),
        staleTime: 30000,
      });

      // Prefetch status (needed for files panel)
      queryClient.prefetchQuery({
        queryKey: ["status", repoPath],
        queryFn: () => getStatus(repoPath),
        staleTime: 30000, // 30s - watcher invalidates on changes
      });

      // Prefetch graph commits (needed for graph panel)
      queryClient.prefetchInfiniteQuery({
        queryKey: ["graph-commits", repoPath],
        queryFn: () => getCommitHistoryAllBranches(repoPath, 100, 0),
        staleTime: 30000,
        initialPageParam: 0,
      });
    },
    [queryClient, activeTabPath],
  );

  // Handle opening a new repository
  const handleAddTab = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Git Repository",
      });

      if (selected && typeof selected === "string") {
        try {
          const repo = await openRepository(selected);
          openTab(repo);
        } catch {
          try {
            const repo = await discoverRepository(selected);
            openTab(repo);
          } catch {
            toast.error("Not a git repository", selected);
          }
        }
      }
    } catch (e) {
      toast.error("Failed to open repository", String(e));
    }
  }, [openTab, toast]);

  // Handle closing a tab with dirty check
  const handleCloseTab = useCallback(
    (e: React.MouseEvent, path: string) => {
      e.stopPropagation();

      // Check if this tab has unsaved commit message
      const isActiveTab = path === activeTabPath;
      if (isActiveTab && (commitMessage.trim() || commitDescription.trim())) {
        const confirmed = window.confirm(
          "You have an unsaved commit message. Are you sure you want to close this tab?",
        );
        if (!confirmed) return;
      }

      closeTab(path);
    },
    [closeTab, activeTabPath, commitMessage, commitDescription],
  );

  // Handle middle-click to close
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, path: string) => {
      if (e.button === 1) {
        // Middle click
        e.preventDefault();
        handleCloseTab(e, path);
      }
    },
    [handleCloseTab],
  );

  // Keyboard shortcuts for tab navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      // Cmd+W to close current tab
      if (isMeta && e.key === "w") {
        e.preventDefault();
        if (activeTabPath) {
          // Create a synthetic event for the dirty check
          const syntheticEvent = {
            stopPropagation: () => {},
          } as React.MouseEvent;
          handleCloseTab(syntheticEvent, activeTabPath);
        }
        return;
      }

      // Cmd+1-9 to switch tabs
      if (isMeta && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (index < tabs.length) {
          handleSwitchTab(tabs[index].repository.path);
        }
        return;
      }

      // Cmd+T to open new tab
      if (isMeta && e.key === "t") {
        e.preventDefault();
        handleAddTab();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTabPath, tabs, handleSwitchTab, handleCloseTab, handleAddTab]);

  return (
    <div
      data-tauri-drag-region
      className={`flex items-center h-8 bg-bg-secondary border-b border-border-primary select-none pl-[78px] ${isPending ? "opacity-80" : ""}`}
    >
      {/* Tab list */}
      <div className="flex items-center h-full overflow-x-auto">
        {tabs.map((tab, index) => {
          const isActive = tab.repository.path === activeTabPath;
          return (
            <div
              key={tab.repository.path}
              role="tab"
              tabIndex={0}
              aria-selected={isActive}
              onClick={() => handleSwitchTab(tab.repository.path)}
              onMouseEnter={() => handleTabHover(tab.repository.path)}
              onMouseDown={(e) => handleMouseDown(e, tab.repository.path)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleSwitchTab(tab.repository.path);
                }
              }}
              title={tab.repository.path}
              className={`
                group flex items-center gap-2 h-full px-3 text-xs cursor-pointer transition-colors
                border-r border-border-primary
                ${
                  isActive
                    ? "bg-bg-primary text-text-primary"
                    : "bg-bg-secondary text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
                }
              `}
            >
              {/* Tab number indicator */}
              <span className="text-text-muted text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                {index < 9 ? `${index + 1}` : ""}
              </span>

              {/* Repository name */}
              <span className="truncate max-w-[120px] font-medium">
                {tab.repository.name}
              </span>

              {/* Close button */}
              <button
                onClick={(e) => handleCloseTab(e, tab.repository.path)}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-bg-hover transition-opacity"
                title="Close tab"
              >
                <X size={12} weight="bold" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add tab button */}
      <button
        onClick={handleAddTab}
        className="flex items-center justify-center w-8 h-full text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
        title="Open repository (Cmd+T)"
      >
        <Plus size={14} weight="bold" />
      </button>
    </div>
  );
}
