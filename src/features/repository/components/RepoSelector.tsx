import { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Sidebar, FolderOpen, GitBranch } from '@phosphor-icons/react';
import { openRepository, discoverRepository, getStatus } from '../../../lib/tauri';
import { useGitStore } from '../../../stores/git-store';
import { useUIStore } from '../../../stores/ui-store';

export function RepoSelector() {
  const { repository, setRepository, setError, isLoading, setIsLoading } = useGitStore();
  const { showStagingSidebar, toggleStagingSidebar } = useUIStore();

  // Fetch working directory status for badge count
  const { data: status } = useQuery({
    queryKey: ['status', repository?.path],
    queryFn: () => getStatus(repository!.path),
    enabled: !!repository?.path,
    refetchInterval: 5000,
    staleTime: 2000,
  });

  // Count total uncommitted files
  const uncommittedCount = status
    ? status.staged.length + status.unstaged.length + status.untracked.length
    : 0;

  // Update window title when repository changes
  useEffect(() => {
    const updateTitle = async () => {
      const window = getCurrentWindow();
      if (repository) {
        await window.setTitle(repository.name);
      } else {
        await window.setTitle('Diffy');
      }
    };
    updateTitle();
  }, [repository]);

  const handleSelectRepo = useCallback(async () => {
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
    <div
      data-tauri-drag-region
      className="flex items-center gap-3 pl-[78px] pr-3 h-[38px] bg-bg-tertiary border-b border-border-primary select-none"
    >
      {/* Branch indicator - far left */}
      {repository?.head_branch && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-hover text-xs">
          <GitBranch size={14} weight="bold" className="text-accent-green" />
          <span className="text-accent-green font-medium">{repository.head_branch}</span>
        </div>
      )}

      {/* Left spacer for centering */}
      <div className="flex-1" />

      {/* Centered repo selector and path */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleSelectRepo}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-bg-hover transition-colors text-xs"
        >
          <FolderOpen size={14} weight="duotone" className="text-accent-blue/70" />
          {isLoading ? (
            <span className="text-text-muted">Loading...</span>
          ) : repository ? (
            <span className="text-accent-blue/70 font-medium">{repository.name}</span>
          ) : (
            <span className="text-text-muted">Open Repository</span>
          )}
        </button>

        {/* Path display */}
        {repository && (
          <span
            className="text-xs text-text-muted truncate max-w-[350px] hidden sm:block"
            title={repository.path}
          >
            {repository.path}
          </span>
        )}
      </div>

      {/* Right spacer for centering */}
      <div className="flex-1" />

      {/* Staging sidebar toggle - far right */}
      {repository && (
        <div className="relative">
          <button
            onClick={toggleStagingSidebar}
            className={`p-1.5 rounded-md transition-colors ${
              showStagingSidebar
                ? 'bg-accent-blue/20 text-accent-blue'
                : 'hover:bg-bg-hover text-text-muted hover:text-text-primary'
            }`}
            title="Toggle Staging Sidebar (Cmd+Shift+S)"
          >
            <Sidebar size={18} weight={showStagingSidebar ? 'fill' : 'regular'} />
          </button>
          {uncommittedCount > 0 && (
            <span className="absolute -top-1 -right-1 text-[9px] font-bold text-[#00d4ff] pointer-events-none">
              {uncommittedCount > 99 ? '99+' : uncommittedCount}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
