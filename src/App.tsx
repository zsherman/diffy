import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Panel, PanelGroup } from './components/layout';
import { StatusBar, HelpOverlay } from './components/ui';
import { RepoSelector } from './features/repository/components';
import { BranchList } from './features/branches/components';
import { CommitList } from './features/commits/components';
import { FileList } from './features/files/components';
import { DiffViewer } from './features/diff/components';
import { useGitStore } from './stores/git-store';
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
  const { repository, error } = useGitStore();

  // Set up keyboard navigation
  useKeyboardNavigation();

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
        <div className="flex-1 overflow-hidden">
          <PanelGroup direction="horizontal" initialSizes={[15, 35, 50]}>
            {/* Branches panel */}
            <Panel id="branches" title="Branches">
              <BranchList />
            </Panel>

            {/* Commits panel */}
            <Panel id="commits" title="Commits">
              <CommitList />
            </Panel>

            {/* Files and Diff panel */}
            <PanelGroup direction="vertical" initialSizes={[35, 65]}>
              <Panel id="files" title="Files">
                <FileList />
              </Panel>

              <Panel id="diff" title="Diff">
                <DiffViewer />
              </Panel>
            </PanelGroup>
          </PanelGroup>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <svg
              className="w-16 h-16 mx-auto text-text-muted mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            <p className="text-text-muted mb-2">No repository selected</p>
            <p className="text-text-muted text-sm">
              Click the repository selector above to open a Git repository
            </p>
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
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
