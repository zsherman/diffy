import { useCallback, useState, useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { open } from "@tauri-apps/plugin-dialog";
import {
  FolderOpen,
  ClockCounterClockwise,
  X,
} from "@phosphor-icons/react";
import { DockviewLayout } from "./components/layout";
import {
  StatusBar,
  HelpOverlay,
  SettingsDialog,
  CommandPalette,
  ToastProvider,
  TabBar,
  GlobalErrorBoundary,
} from "./components/ui";
import { RepoHeader } from "./features/repository/components";
import { SkillsDialog, SkillsView } from "./features/skills";
import { StatisticsView } from "./features/statistics";
import { ChangelogView } from "./features/changelog";
import { openRepository, discoverRepository } from "./lib/tauri";
import {
  useTabActions,
  useActiveTabView,
  useHasOpenTabs,
  useActiveRepository,
  getSavedTabPaths,
  createTabState,
} from "./stores/tabs-store";
import { useTheme, useAppView, getDockviewApi } from "./stores/ui-store";
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";
import { useRepoWatcher } from "./hooks/useRepoWatcher";
import {
  getRecentRepositories,
  addRecentRepository,
  removeRecentRepository,
  type RecentRepository,
} from "./lib/recent-repos";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      gcTime: 1000 * 60 * 10, // Keep unused data in cache for 10 minutes (helps with tab switching)
      refetchOnWindowFocus: false,
      refetchOnMount: false, // Don't refetch on mount if data exists
    },
  },
});

function AppContent() {
  // Use focused hooks to minimize subscriptions and re-renders
  const hasOpenTabs = useHasOpenTabs();
  const repository = useActiveRepository();
  // Use focused action hook - no state subscriptions, just stable callbacks
  const { openTab, restoreTabs } = useTabActions();
  const { mainView } = useActiveTabView();
  const [recentRepos, setRecentRepos] = useState<RecentRepository[]>([]);
  const [isRestoring, setIsRestoring] = useState(true);

  // Get theme from UI store (global setting) - use focused hook to avoid unnecessary subscriptions
  const { theme } = useTheme();
  
  // Get global app view (workspace vs skills)
  const { appView } = useAppView();

  // Track previous mainView to detect transitions from overlay views (statistics/changelog)
  const prevMainViewRef = useRef(mainView);
  
  // Helper to check if a view is an overlay view (rendered outside Dockview)
  const isOverlayView = (view: string) => view === "statistics" || view === "changelog";
  
  // Check if we're in skills view (also an overlay, but global)
  const isSkillsView = appView === "skills";

  // Sync theme to document
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Ref to the Dockview container for layout recalculation
  const dockviewContainerRef = useRef<HTMLDivElement>(null);

  // Force Dockview layout recalculation when returning from overlay views (statistics/changelog)
  // Dockview doesn't auto-resize correctly after being hidden with display:none
  useEffect(() => {
    const wasOverlay = isOverlayView(prevMainViewRef.current);
    const isNowVisible = !isOverlayView(mainView);
    prevMainViewRef.current = mainView;

    if (wasOverlay && isNowVisible && dockviewContainerRef.current) {
      // Give React a moment to update display:none -> visible, then nudge Dockview
      requestAnimationFrame(() => {
        const api = getDockviewApi();
        const container = dockviewContainerRef.current;
        if (api && container) {
          // Force layout recalculation with current dimensions
          const { width, height } = container.getBoundingClientRect();
          if (width > 0 && height > 0) {
            api.layout(width, height, true);
          }
        }
      });
    }
  }, [mainView]);

  // Set up keyboard navigation
  useKeyboardNavigation();

  // Set up file watcher for automatic refresh (watches active repository)
  useRepoWatcher(repository?.path ?? null);

  // Load recent repos on mount
  useEffect(() => {
    setRecentRepos(getRecentRepositories());
  }, []);

  // Restore tabs from localStorage on mount
  useEffect(() => {
    const restoreTabsFromStorage = async () => {
      const saved = getSavedTabPaths();
      if (saved.paths.length === 0) {
        setIsRestoring(false);
        return;
      }

      const restoredTabs = [];
      for (const path of saved.paths) {
        try {
          const repo = await openRepository(path);
          restoredTabs.push(createTabState(repo));
        } catch {
          try {
            const repo = await discoverRepository(path);
            restoredTabs.push(createTabState(repo));
          } catch {
            // Repository no longer exists, skip it
            console.warn(`Could not restore tab for ${path}`);
          }
        }
      }

      if (restoredTabs.length > 0) {
        // Determine active tab - use saved active or first tab
        let activeTabPath = saved.activeTabPath;
        if (
          !activeTabPath ||
          !restoredTabs.some((t) => t.repository.path === activeTabPath)
        ) {
          activeTabPath = restoredTabs[0].repository.path;
        }
        restoreTabs(restoredTabs, activeTabPath);
      }
      setIsRestoring(false);
    };

    restoreTabsFromStorage();
  }, [restoreTabs]);

  // Save to recent repos when a repository is opened
  useEffect(() => {
    if (repository) {
      addRecentRepository(repository.path, repository.name);
      setRecentRepos(getRecentRepositories());
    }
  }, [repository]);

  const handleOpenRepository = useCallback(async () => {
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
            // Show error via empty state or toast
            console.error(`Not a git repository: ${selected}`);
          }
        }
      }
    } catch (e) {
      console.error(String(e));
    }
  }, [openTab]);

  const handleOpenRecent = useCallback(
    async (path: string) => {
      try {
        const repo = await openRepository(path);
        openTab(repo);
      } catch {
        try {
          const repo = await discoverRepository(path);
          openTab(repo);
        } catch {
          // Remove from recent if it no longer exists
          removeRecentRepository(path);
          setRecentRepos(getRecentRepositories());
        }
      }
    },
    [openTab],
  );

  const handleRemoveRecent = useCallback(
    (e: React.MouseEvent, path: string) => {
      e.stopPropagation();
      removeRecentRepository(path);
      setRecentRepos(getRecentRepositories());
    },
    [],
  );

  // Show loading state while restoring tabs
  if (isRestoring) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg-primary">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-text-muted text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  // hasOpenTabs comes from useHasOpenTabs() hook above

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg-primary">
      {/* Tab bar - always shown when there are tabs */}
      {hasOpenTabs ? (
        <TabBar />
      ) : (
        /* Empty title bar for window dragging when no tabs are open */
        <div
          data-tauri-drag-region
          className="h-8 bg-bg-secondary border-b border-border-primary select-none"
        />
      )}

      {/* Repo header with branch, git actions, view toggle, and layout switcher - always shown for Skills button */}
      <RepoHeader />

      {/* Main content */}
      {isSkillsView ? (
        /* Skills view - global, not tied to repository */
        <SkillsView />
      ) : repository ? (
        <>
          {/* Overlay views - rendered outside Dockview when active */}
          {mainView === "statistics" && <StatisticsView />}
          {mainView === "changelog" && <ChangelogView />}
          {/* DockviewLayout stays mounted but hidden when overlay views are active */}
          {/* This avoids expensive remount when switching back to history/changes */}
          <div
            ref={dockviewContainerRef}
            className="flex-1 min-h-0"
            style={{ display: isOverlayView(mainView) ? "none" : undefined }}
          >
            <DockviewLayout />
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md w-full px-4">
            <FolderOpen
              size={64}
              weight="duotone"
              className="mx-auto text-text-muted mb-4"
            />
            <p className="text-text-primary mb-1 font-medium">
              No repository selected
            </p>
            <p className="text-text-muted text-sm mb-6">
              Open a Git repository to get started
            </p>
            <button
              onClick={handleOpenRepository}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent-blue text-bg-primary font-medium rounded-md hover:bg-accent-blue/90 transition-colors"
            >
              <FolderOpen size={18} weight="bold" />
              Open Repository
            </button>

            {recentRepos.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 text-text-muted text-sm mb-3">
                  <ClockCounterClockwise size={16} />
                  <span>Recent Repositories</span>
                </div>
                <div className="space-y-1">
                  {recentRepos.map((repo) => (
                    <div
                      key={repo.path}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpenRecent(repo.path)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          handleOpenRecent(repo.path);
                        }
                      }}
                      className="w-full group flex items-center gap-3 px-3 py-2 rounded-md bg-bg-secondary hover:bg-bg-hover transition-colors text-left cursor-pointer"
                    >
                      <FolderOpen
                        size={18}
                        className="text-text-muted shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-text-primary text-sm font-medium truncate">
                          {repo.name}
                        </p>
                        <p className="text-text-muted text-xs truncate">
                          {repo.path}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleRemoveRecent(e, repo.path)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-bg-tertiary rounded-sm transition-opacity"
                        title="Remove from recent"
                      >
                        <X size={14} className="text-text-muted" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status bar */}
      <StatusBar />

      {/* Help overlay */}
      <HelpOverlay />

      {/* Settings dialog */}
      <SettingsDialog />

      {/* Skills dialog */}
      <SkillsDialog />

      {/* Command palette */}
      <CommandPalette />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <GlobalErrorBoundary>
          <AppContent />
        </GlobalErrorBoundary>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
