import { useState } from 'react';
import { Toolbar } from '@base-ui/react/toolbar';
import { ArrowDown, ArrowUp, ArrowsClockwise, CloudArrowDown, GearSix } from '@phosphor-icons/react';
import { useGitStore } from '../../stores/git-store';
import { useUIStore } from '../../stores/ui-store';
import { useToast } from './Toast';
import { gitFetch, gitPull, gitPush } from '../../lib/tauri';
import { getErrorMessage } from '../../lib/errors';
import { useQueryClient } from '@tanstack/react-query';
import { BranchSwitcher } from './BranchSwitcher';
import { LayoutSwitcher } from './LayoutSwitcher';

export function StatusBar() {
  const { repository } = useGitStore();
  const { activePanel, setShowSettingsDialog } = useUIStore();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [isFetching, setIsFetching] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

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
        <BranchSwitcher />

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
        <LayoutSwitcher />
      </div>

      {/* Center: Context-sensitive hints */}
      <div className="text-text-muted hidden md:block">{hints[activePanel]}</div>

      {/* Right: Settings and Help */}
      <div className="flex items-center gap-3 text-text-muted">
        <button
          onClick={() => setShowSettingsDialog(true)}
          className="p-1 rounded hover:bg-bg-hover transition-colors hover:text-text-primary"
          title="Settings"
        >
          <GearSix size={16} weight="bold" />
        </button>
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 bg-bg-hover rounded text-xs">?</span>
          <span>help</span>
        </div>
      </div>
    </div>
  );
}
