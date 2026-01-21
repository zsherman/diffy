import React, { useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { openRepository, discoverRepository } from '../../../lib/tauri';
import { useGitStore } from '../../../stores/git-store';
import { useUIStore } from '../../../stores/ui-store';

export function RepoSelector() {
  const { repository, setRepository, setError, isLoading, setIsLoading } = useGitStore();
  const { showStagingSidebar, toggleStagingSidebar } = useUIStore();

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
          // First try to open directly
          const repo = await openRepository(selected);
          setRepository(repo);
        } catch {
          // If that fails, try to discover a repo in the directory or parent
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
    <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border-b border-border-primary">
      {/* Repo icon */}
      <svg
        className="w-4 h-4 text-text-muted"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
        />
      </svg>

      {/* Repo name or prompt */}
      <button
        onClick={handleSelectRepo}
        disabled={isLoading}
        className="flex-1 text-left text-sm hover:text-accent-blue transition-colors truncate"
      >
        {isLoading ? (
          <span className="text-text-muted">Loading...</span>
        ) : repository ? (
          <span className="text-text-primary">{repository.name}</span>
        ) : (
          <span className="text-text-muted">Select repository...</span>
        )}
      </button>

      {/* Path tooltip */}
      {repository && (
        <span className="text-xs text-text-muted truncate max-w-[200px]" title={repository.path}>
          {repository.path}
        </span>
      )}

      {/* Branch indicator */}
      {repository?.head_branch && (
        <span className="flex items-center gap-1 text-xs text-accent-green">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
            <path
              fillRule="evenodd"
              d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z"
            />
          </svg>
          {repository.head_branch}
        </span>
      )}

      {/* Staging sidebar toggle button */}
      {repository && (
        <button
          onClick={toggleStagingSidebar}
          className={`p-1.5 rounded hover:bg-bg-hover transition-colors ${
            showStagingSidebar ? 'text-accent-blue' : 'text-text-muted'
          }`}
          title="Toggle Staging Sidebar (Cmd+Shift+S)"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
