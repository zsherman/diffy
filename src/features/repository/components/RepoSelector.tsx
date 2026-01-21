import React, { useCallback, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Sidebar, FolderOpen, GitBranch } from '@phosphor-icons/react';
import { openRepository, discoverRepository } from '../../../lib/tauri';
import { useGitStore } from '../../../stores/git-store';
import { useUIStore } from '../../../stores/ui-store';

export function RepoSelector() {
  const { repository, setRepository, setError, isLoading, setIsLoading } = useGitStore();
  const { showStagingSidebar, toggleStagingSidebar } = useUIStore();

  // Update window title when repository changes
  useEffect(() => {
    const updateTitle = async () => {
      const window = getCurrentWindow();
      if (repository) {
        await window.setTitle(repository.name);
      } else {
        await window.setTitle('Git GUI');
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
      {/* Repo selector button */}
      <button
        onClick={handleSelectRepo}
        disabled={isLoading}
        className="flex items-center gap-2 px-2.5 py-1 rounded-md hover:bg-bg-hover transition-colors text-sm"
      >
        <FolderOpen size={16} weight="duotone" className="text-text-muted" />
        {isLoading ? (
          <span className="text-text-muted">Loading...</span>
        ) : repository ? (
          <span className="text-text-primary font-medium">{repository.name}</span>
        ) : (
          <span className="text-text-muted">Open Repository</span>
        )}
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Path display */}
      {repository && (
        <span
          className="text-xs text-text-muted truncate max-w-[250px] hidden sm:block"
          title={repository.path}
        >
          {repository.path}
        </span>
      )}

      {/* Branch indicator */}
      {repository?.head_branch && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-hover text-xs">
          <GitBranch size={14} weight="bold" className="text-accent-green" />
          <span className="text-accent-green font-medium">{repository.head_branch}</span>
        </div>
      )}

      {/* Staging sidebar toggle */}
      {repository && (
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
      )}
    </div>
  );
}
