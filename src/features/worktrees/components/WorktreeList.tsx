import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { VList } from 'virtua';
import type { VListHandle } from 'virtua';
import { Plus, Lock, LockOpen, Trash } from '@phosphor-icons/react';
import { listWorktrees, removeWorktree, lockWorktree, unlockWorktree, openRepository } from '../../../lib/tauri';
import { useTabsStore, useActiveTabState } from '../../../stores/tabs-store';
import { useUIStore } from '../../../stores/ui-store';
import { LoadingSpinner, SkeletonList, WorktreeContextMenu } from '../../../components/ui';
import { useToast } from '../../../components/ui/Toast';
import type { WorktreeInfo } from '../../../types/git';
import { WorktreeRow } from './WorktreeRow';
import { CreateWorktreeDialog } from './CreateWorktreeDialog';

export function WorktreeList() {
  const { repository, openTab } = useTabsStore();
  const {
    worktreeFilter,
    setWorktreeFilter,
    selectedWorktree,
    setSelectedWorktree,
  } = useActiveTabState();
  const { activePanel } = useUIStore();
  const queryClient = useQueryClient();
  const toast = useToast();
  const listRef = useRef<VListHandle>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: worktrees = [], isLoading } = useQuery({
    queryKey: ['worktrees', repository?.path],
    queryFn: () => listWorktrees(repository!.path),
    enabled: !!repository?.path,
    staleTime: 30000,
  });

  const removeMutation = useMutation({
    mutationFn: ({ name, force }: { name: string; force: boolean }) =>
      removeWorktree(repository!.path, name, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worktrees'] });
      toast.success('Worktree removed', 'Successfully removed worktree');
    },
    onError: (error: Error) => {
      toast.error('Failed to remove worktree', error.message);
    },
  });

  const lockMutation = useMutation({
    mutationFn: ({ name, reason }: { name: string; reason?: string }) =>
      lockWorktree(repository!.path, name, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worktrees'] });
      toast.success('Worktree locked', 'Successfully locked worktree');
    },
    onError: (error: Error) => {
      toast.error('Failed to lock worktree', error.message);
    },
  });

  const unlockMutation = useMutation({
    mutationFn: (name: string) => unlockWorktree(repository!.path, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worktrees'] });
      toast.success('Worktree unlocked', 'Successfully unlocked worktree');
    },
    onError: (error: Error) => {
      toast.error('Failed to unlock worktree', error.message);
    },
  });

  // Filter worktrees
  const filteredWorktrees = useMemo(() => {
    if (!worktreeFilter) return worktrees;
    const lower = worktreeFilter.toLowerCase();
    return worktrees.filter(
      (w) =>
        w.name.toLowerCase().includes(lower) ||
        w.path.toLowerCase().includes(lower) ||
        w.headBranch?.toLowerCase().includes(lower)
    );
  }, [worktrees, worktreeFilter]);

  // Define callbacks before the useEffect that uses them
  const handleWorktreeClick = useCallback(
    (worktree: WorktreeInfo, index: number) => {
      setFocusedIndex(index);
      setSelectedWorktree(worktree.name);
    },
    [setSelectedWorktree]
  );

  const handleWorktreeSwitch = useCallback(
    async (worktree: WorktreeInfo) => {
      try {
        // Switch to the worktree by opening it as a new tab
        const repoInfo = await openRepository(worktree.path);
        openTab(repoInfo);
        toast.success('Switched worktree', `Now viewing ${worktree.name}`);
      } catch (error) {
        toast.error('Failed to switch worktree', (error as Error).message);
      }
    },
    [openTab, toast]
  );

  const handleRemove = useCallback(
    (worktree: WorktreeInfo) => {
      if (worktree.isMain) {
        toast.error('Cannot remove', 'Cannot remove the main worktree');
        return;
      }
      const force = worktree.isDirty || worktree.isLocked;
      if (force) {
        const confirmed = window.confirm(
          `This worktree ${worktree.isDirty ? 'has uncommitted changes' : ''}${
            worktree.isDirty && worktree.isLocked ? ' and ' : ''
          }${worktree.isLocked ? 'is locked' : ''}. Are you sure you want to remove it?`
        );
        if (!confirmed) return;
      }
      removeMutation.mutate({ name: worktree.name, force });
    },
    [removeMutation, toast]
  );

  // Keyboard navigation
  useEffect(() => {
    if (activePanel !== 'worktrees') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, filteredWorktrees.length - 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const worktree = filteredWorktrees[focusedIndex];
        if (worktree) {
          handleWorktreeSwitch(worktree);
        }
      } else if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowCreateDialog(true);
      } else if (e.key === 'l' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const worktree = filteredWorktrees[focusedIndex];
        if (worktree && !worktree.isMain) {
          if (worktree.isLocked) {
            unlockMutation.mutate(worktree.name);
          } else {
            lockMutation.mutate({ name: worktree.name });
          }
        }
      } else if (e.key === 'd' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const worktree = filteredWorktrees[focusedIndex];
        if (worktree && !worktree.isMain) {
          handleRemove(worktree);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePanel, filteredWorktrees, focusedIndex, lockMutation, unlockMutation, handleWorktreeSwitch, handleRemove]);

  // Scroll focused item into view
  useEffect(() => {
    listRef.current?.scrollToIndex(focusedIndex, { align: 'center' });
  }, [focusedIndex]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center py-3 px-2">
          <LoadingSpinner size="sm" message="Loading worktrees..." />
        </div>
        <div className="flex-1 px-2 overflow-hidden">
          <SkeletonList rows={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with filter and actions */}
      <div className="px-2 py-1.5 border-b border-border-primary flex gap-2">
        <input
          type="text"
          placeholder="Filter worktrees..."
          value={worktreeFilter}
          onChange={(e) => setWorktreeFilter(e.target.value)}
          className="flex-1 px-2 py-1 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-none"
        />
        <button
          onClick={() => setShowCreateDialog(true)}
          className="px-2 py-1 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary hover:bg-bg-hover flex items-center gap-1"
          title="Create new worktree (n)"
        >
          <Plus size={14} />
          <span>New</span>
        </button>
      </div>

      {/* Worktree list */}
      {filteredWorktrees.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
          {worktreeFilter ? 'No matching worktrees' : 'No worktrees found'}
        </div>
      ) : (
        <VList ref={listRef} className="flex-1">
          {filteredWorktrees.map((worktree, index) => (
            <div key={worktree.name} className="group relative">
              <WorktreeContextMenu
                worktree={worktree}
                onOpen={() => handleWorktreeSwitch(worktree)}
                onToggleLock={() => {
                  if (worktree.isLocked) {
                    unlockMutation.mutate(worktree.name);
                  } else {
                    lockMutation.mutate({ name: worktree.name });
                  }
                }}
                onRemove={() => handleRemove(worktree)}
              >
                <WorktreeRow
                  worktree={worktree}
                  isSelected={selectedWorktree === worktree.name}
                  isFocused={index === focusedIndex}
                  onClick={() => handleWorktreeClick(worktree, index)}
                  onDoubleClick={() => handleWorktreeSwitch(worktree)}
                />
              </WorktreeContextMenu>
              {/* Action buttons on hover */}
              {!worktree.isMain && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (worktree.isLocked) {
                        unlockMutation.mutate(worktree.name);
                      } else {
                        lockMutation.mutate({ name: worktree.name });
                      }
                    }}
                    className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary"
                    title={worktree.isLocked ? 'Unlock worktree (l)' : 'Lock worktree (l)'}
                  >
                    {worktree.isLocked ? <LockOpen size={14} /> : <Lock size={14} />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(worktree);
                    }}
                    className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-accent-red"
                    title="Remove worktree (d)"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </VList>
      )}

      {/* Create dialog */}
      <CreateWorktreeDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['worktrees'] });
        }}
      />
    </div>
  );
}
