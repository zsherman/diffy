import { useState } from 'react';
import { Toolbar } from '@base-ui/react/toolbar';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { Toggle } from '@base-ui/react/toggle';
import { ArrowDown, ArrowUp, ArrowsClockwise, CloudArrowDown, ClockCounterClockwise, GitDiff, ChartBar } from '@phosphor-icons/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useGitStore } from '../../stores/git-store';
import { useUIStore, getDockviewApi } from '../../stores/ui-store';
import { useToast } from './Toast';
import { gitFetch, gitPull, gitPush, getStatus } from '../../lib/tauri';
import { getErrorMessage } from '../../lib/errors';
import { applyLayout } from '../../lib/layouts';
import { BranchSwitcher } from './BranchSwitcher';
import { LayoutSwitcher } from './LayoutSwitcher';

type ViewMode = 'history' | 'changes' | 'statistics';

export function TopToolbar() {
  const { repository } = useGitStore();
  const { mainView, setMainView, setSelectedCommit } = useUIStore();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [isFetching, setIsFetching] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  // Get status to show changes count
  const { data: status } = useQuery({
    queryKey: ['status', repository?.path],
    queryFn: () => getStatus(repository!.path),
    enabled: !!repository?.path,
    staleTime: 2000,
  });

  const changesCount = status
    ? status.staged.length + status.unstaged.length + status.untracked.length
    : 0;

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

  const toggleButtonClass =
    'flex items-center gap-1.5 px-3 py-1 text-text-muted transition-colors first:rounded-l last:rounded-r data-[pressed]:bg-bg-hover data-[pressed]:text-text-primary hover:text-text-primary';

  const handleViewChange = (newValue: string[]) => {
    if (newValue.length > 0) {
      const view = newValue[0] as ViewMode;
      setMainView(view);

      const api = getDockviewApi();
      if (api) {
        if (view === 'history') {
          // Apply standard layout for history view
          applyLayout(api, 'standard');
        } else if (view === 'changes') {
          // Clear selected commit and apply changes layout
          setSelectedCommit(null);
          applyLayout(api, 'changes');
        }
        // Statistics view - handled by App.tsx showing empty state
      }
    }
  };

  if (!repository) return null;

  return (
    <div className="flex items-center px-3 py-1.5 bg-bg-tertiary border-b border-border-primary text-xs">
      {/* Left: Branch and git actions */}
      <div className="flex-1 flex items-center gap-2">
        <BranchSwitcher />

        {/* Git actions toolbar */}
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
      </div>

      {/* Center: View toggle group */}
      <ToggleGroup
        value={[mainView]}
        onValueChange={handleViewChange}
        className="flex items-center border border-border-primary rounded bg-bg-secondary"
      >
        <Toggle
          value="history"
          aria-label="History view"
          className={toggleButtonClass}
        >
          <ClockCounterClockwise size={14} weight="bold" />
          <span className="hidden sm:inline">History</span>
        </Toggle>
        <Toggle
          value="changes"
          aria-label="Changes view"
          className={toggleButtonClass}
        >
          <GitDiff size={14} weight="bold" />
          <span className="hidden sm:inline">Changes</span>
          {changesCount > 0 && (
            <span className="px-1.5 py-0.5 bg-accent-blue text-white text-[10px] rounded-full leading-none">
              {changesCount}
            </span>
          )}
        </Toggle>
        <Toggle
          value="statistics"
          aria-label="Statistics view"
          className={toggleButtonClass}
        >
          <ChartBar size={14} weight="bold" />
          <span className="hidden sm:inline">Statistics</span>
        </Toggle>
      </ToggleGroup>

      {/* Right: Layout switcher */}
      <div className="flex-1 flex items-center justify-end gap-2">
        <LayoutSwitcher />
      </div>
    </div>
  );
}
