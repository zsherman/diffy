import { useState } from 'react';
import { Toolbar } from '@base-ui/react/toolbar';
import { ArrowDown, ArrowUp, ArrowsClockwise, CloudArrowDown } from '@phosphor-icons/react';
import { useGitStore } from '../../stores/git-store';
import { useUIStore } from '../../stores/ui-store';
import { useToast } from './Toast';
import { gitFetch, gitPull, gitPush } from '../../lib/tauri';
import { useQueryClient } from '@tanstack/react-query';

export function StatusBar() {
  const { repository } = useGitStore();
  const { activePanel, diffViewMode } = useUIStore();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [isFetching, setIsFetching] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  const getErrorMessage = (error: unknown): string => {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    return JSON.stringify(error);
  };

  const hints: Record<string, string> = {
    branches: 'j/k:navigate | Enter:checkout | Tab:next panel',
    commits: 'j/k:navigate | Enter:select | Tab:next panel',
    files: 'j/k:navigate | Space:stage | u:unstage | d:discard',
    diff: 'v:toggle view | Tab:next panel',
    staging: 'Stage/unstage files | Enter:commit',
  };

  const handleFetch = async () => {
    if (!repository || isFetching) return;
    setIsFetching(true);
    try {
      await gitFetch(repository.path);
      toast.success('Fetch complete', 'Successfully fetched from remote');
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
    } catch (error) {
      console.error('Fetch failed:', error);
      toast.error('Fetch failed', getErrorMessage(error));
    } finally {
      setIsFetching(false);
    }
  };

  const handlePull = async () => {
    if (!repository || isPulling) return;
    setIsPulling(true);
    try {
      const result = await gitPull(repository.path);
      toast.success('Pull complete', result || 'Successfully pulled from remote');
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
    } catch (error) {
      console.error('Pull failed:', error);
      toast.error('Pull failed', getErrorMessage(error));
    } finally {
      setIsPulling(false);
    }
  };

  const handlePush = async () => {
    if (!repository || isPushing) return;
    setIsPushing(true);
    try {
      await gitPush(repository.path);
      toast.success('Push complete', 'Successfully pushed to remote');
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
    } catch (error) {
      console.error('Push failed:', error);
      toast.error('Push failed', getErrorMessage(error));
    } finally {
      setIsPushing(false);
    }
  };

  const toolbarButtonClass =
    'flex items-center gap-1.5 px-2 py-1 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-blue';

  return (
    <div className="flex items-center justify-between px-3 py-1 bg-bg-tertiary border-t border-border-primary text-xs">
      {/* Left: Branch and git actions */}
      <div className="flex items-center gap-2">
        {repository?.head_branch && (
          <span className="flex items-center gap-1 text-accent-green">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
              <path
                fillRule="evenodd"
                d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z"
              />
            </svg>
            {repository.head_branch}
          </span>
        )}

        {/* Git actions toolbar */}
        {repository && (
          <>
            <div className="w-px h-4 bg-border-primary mx-1" />
            <Toolbar.Root className="flex items-center gap-0.5">
              <Toolbar.Button
                className={toolbarButtonClass}
                onClick={handleFetch}
                disabled={isFetching}
              >
                {isFetching ? (
                  <ArrowsClockwise size={14} weight="bold" className="animate-spin" />
                ) : (
                  <CloudArrowDown size={14} weight="bold" />
                )}
                <span className="hidden sm:inline">Fetch</span>
              </Toolbar.Button>

              <Toolbar.Button
                className={toolbarButtonClass}
                onClick={handlePull}
                disabled={isPulling}
              >
                {isPulling ? (
                  <ArrowsClockwise size={14} weight="bold" className="animate-spin" />
                ) : (
                  <ArrowDown size={14} weight="bold" />
                )}
                <span className="hidden sm:inline">Pull</span>
              </Toolbar.Button>

              <Toolbar.Button
                className={toolbarButtonClass}
                onClick={handlePush}
                disabled={isPushing}
              >
                {isPushing ? (
                  <ArrowsClockwise size={14} weight="bold" className="animate-spin" />
                ) : (
                  <ArrowUp size={14} weight="bold" />
                )}
                <span className="hidden sm:inline">Push</span>
              </Toolbar.Button>
            </Toolbar.Root>
          </>
        )}

        <div className="w-px h-4 bg-border-primary mx-1" />
        <span className="text-text-muted">
          View: {diffViewMode === 'split' ? 'Split' : 'Unified'}
        </span>
      </div>

      {/* Center: Context-sensitive hints */}
      <div className="text-text-muted hidden md:block">{hints[activePanel]}</div>

      {/* Right: Help shortcut */}
      <div className="flex items-center gap-2 text-text-muted">
        <span className="px-1.5 py-0.5 bg-bg-hover rounded text-xs">?</span>
        <span>help</span>
      </div>
    </div>
  );
}
