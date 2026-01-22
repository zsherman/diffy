import { useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen } from '@phosphor-icons/react';
import { DockviewLayout } from './components/layout';
import { StatusBar, HelpOverlay, ToastProvider } from './components/ui';
import { RepoSelector } from './features/repository/components';
import { openRepository, discoverRepository } from './lib/tauri';
import { useGitStore } from './stores/git-store';
import { useUIStore } from './stores/ui-store';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';

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
  // Panel visibility is now managed within DockviewLayout
  useUIStore();

  // Set up keyboard navigation
  useKeyboardNavigation();

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
          <div className="text-center">
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
          </div>
        </div>
      )}

      {/* Status bar */}
      <StatusBar />

      {/* Help overlay */}
      <HelpOverlay />
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
