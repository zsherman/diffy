import { useCallback, useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen, ClockCounterClockwise, X } from '@phosphor-icons/react';
import { DockviewLayout } from './components/layout';
import { StatusBar, HelpOverlay, SettingsDialog, CommandPalette, ToastProvider } from './components/ui';
import { RepoSelector } from './features/repository/components';
import { SkillsDialog } from './features/skills';
import { openRepository, discoverRepository } from './lib/tauri';
import { useGitStore } from './stores/git-store';
import { useUIStore } from './stores/ui-store';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import {
  getRecentRepositories,
  addRecentRepository,
  removeRecentRepository,
  type RecentRepository,
} from './lib/recent-repos';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  const { repository, error, setRepository, setError, setIsLoading } = useGitStore();
  const [recentRepos, setRecentRepos] = useState<RecentRepository[]>([]);

  // Get theme from UI store
  const { theme } = useUIStore();

  // Sync theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Set up keyboard navigation
  useKeyboardNavigation();

  // Load recent repos on mount
  useEffect(() => {
    setRecentRepos(getRecentRepositories());
  }, []);

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
        title: 'Select Git Repository',
      });

      if (selected && typeof selected === 'string') {
        setIsLoading(true);
        setError(null);

        try {
          const repo = await openRepository(selected);
          setRepository(repo);
        } catch {
          try {
            const repo = await discoverRepository(selected);
            setRepository(repo);
          } catch (e) {
            setError(`Not a git repository: ${selected}`);
          }
        }
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  }, [setRepository, setError, setIsLoading]);

  const handleOpenRecent = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const repo = await openRepository(path);
      setRepository(repo);
    } catch {
      try {
        const repo = await discoverRepository(path);
        setRepository(repo);
      } catch (e) {
        setError(`Failed to open repository: ${path}`);
        // Remove from recent if it no longer exists
        removeRecentRepository(path);
        setRecentRepos(getRecentRepositories());
      }
    } finally {
      setIsLoading(false);
    }
  }, [setRepository, setError, setIsLoading]);

  const handleRemoveRecent = useCallback((e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    removeRecentRepository(path);
    setRecentRepos(getRecentRepositories());
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg-primary">
      {/* Title bar / repo selector */}
      <RepoSelector />

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 bg-accent-red/20 border-b border-accent-red text-accent-red text-sm">
          {error}
        </div>
      )}

      {/* Main content */}
      {repository ? (
        <div className="flex-1 min-h-0">
          <DockviewLayout />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md w-full px-4">
            <FolderOpen size={64} weight="duotone" className="mx-auto text-text-muted mb-4" />
            <p className="text-text-primary mb-1 font-medium">No repository selected</p>
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
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleOpenRecent(repo.path);
                        }
                      }}
                      className="w-full group flex items-center gap-3 px-3 py-2 rounded-md bg-bg-secondary hover:bg-bg-hover transition-colors text-left cursor-pointer"
                    >
                      <FolderOpen size={18} className="text-text-muted flex-shrink-0" />
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
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-bg-tertiary rounded transition-opacity"
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
        <AppContent />
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
