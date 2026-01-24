import { useState } from 'react';
import { Toolbar } from '@base-ui/react/toolbar';
import { ArrowDown, ArrowUp, ArrowsClockwise, CloudArrowDown } from '@phosphor-icons/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTabsStore } from '../../stores/tabs-store';
import { useToast } from './Toast';
import { gitFetch, gitPull, gitPush, getAheadBehind } from '../../lib/tauri';
import { getErrorMessage } from '../../lib/errors';
import { BranchSwitcher } from './BranchSwitcher';
import { WorktreeSwitcher } from './WorktreeSwitcher';
import { LayoutSwitcher } from './LayoutSwitcher';

export function TopToolbar() {
  const { repository } = useTabsStore();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [isFetching, setIsFetching] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  const { data: aheadBehind } = useQuery({
    queryKey: ['aheadBehind', repository?.path],
    queryFn: () => getAheadBehind(repository!.path),
    enabled: !!repository,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleFetch = async () => {
    if (!repository || isFetching) return;
    setIsFetching(true);
    try {
      await gitFetch(repository.path);
      toast.success('Fetch complete', 'Successfully fetched from remote');
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
      queryClient.invalidateQueries({ queryKey: ['aheadBehind'] });
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
      queryClient.invalidateQueries({ queryKey: ['aheadBehind'] });
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
      queryClient.invalidateQueries({ queryKey: ['status'] });
      queryClient.invalidateQueries({ queryKey: ['aheadBehind'] });
    } catch (error) {
      console.error('Push failed:', error);
      toast.error('Push failed', getErrorMessage(error));
    } finally {
      setIsPushing(false);
    }
  };

  const toolbarButtonClass =
    'flex items-center gap-1.5 px-2 py-1 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-accent-blue';

  if (!repository) return null;

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-bg-tertiary border-b border-border-primary text-xs">
      {/* Left: Branch, worktree, and git actions */}
      <div className="flex items-center gap-2">
        <BranchSwitcher />
        <WorktreeSwitcher />

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
            className={`${toolbarButtonClass} relative`}
            onClick={handlePull}
            disabled={isPulling}
          >
            {isPulling ? (
              <ArrowsClockwise size={14} weight="bold" className="animate-spin" />
            ) : (
              <ArrowDown size={14} weight="bold" />
            )}
            <span className="hidden sm:inline">Pull</span>
            {aheadBehind && aheadBehind.behind > 0 && !isPulling && (
              <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center text-[9px] font-medium bg-accent-orange text-white rounded-full">
                {aheadBehind.behind > 99 ? '99+' : aheadBehind.behind}
              </span>
            )}
          </Toolbar.Button>

          <Toolbar.Button
            className={`${toolbarButtonClass} relative`}
            onClick={handlePush}
            disabled={isPushing}
          >
            {isPushing ? (
              <ArrowsClockwise size={14} weight="bold" className="animate-spin" />
            ) : (
              <ArrowUp size={14} weight="bold" />
            )}
            <span className="hidden sm:inline">Push</span>
            {aheadBehind && aheadBehind.ahead > 0 && !isPushing && (
              <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center text-[9px] font-medium bg-accent-blue text-white rounded-full">
                {aheadBehind.ahead > 99 ? '99+' : aheadBehind.ahead}
              </span>
            )}
          </Toolbar.Button>
        </Toolbar.Root>
      </div>

      {/* Right: Layout switcher */}
      <div className="flex items-center gap-2">
        <LayoutSwitcher />
      </div>
    </div>
  );
}
