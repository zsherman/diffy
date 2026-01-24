import { useMemo, useState } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TreeEvergreen, CaretUpDown, Check, Circle, Plus } from '@phosphor-icons/react';
import { listWorktrees, openRepository } from '../../lib/tauri';
import { useTabsStore } from '../../stores/tabs-store';
import { useToast } from './Toast';
import { CreateWorktreeDialog } from '../../features/worktrees/components/CreateWorktreeDialog';
import type { WorktreeInfo } from '../../types/git';

export function WorktreeSwitcher() {
  const { repository, openTab } = useTabsStore();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [inputValue, setInputValue] = useState('');
  const [open, setOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: worktrees = [], isLoading } = useQuery({
    queryKey: ['worktrees', repository?.path],
    queryFn: () => listWorktrees(repository!.path),
    enabled: !!repository?.path,
    staleTime: 30000,
  });

  // Filter worktrees based on input
  const filteredWorktrees = useMemo(() => {
    if (!inputValue) return worktrees;
    const lower = inputValue.toLowerCase();
    return worktrees.filter(
      (w) =>
        w.name.toLowerCase().includes(lower) ||
        w.headBranch?.toLowerCase().includes(lower)
    );
  }, [worktrees, inputValue]);

  // Find the current worktree (the one matching our repo path)
  const currentWorktree = useMemo(
    () => worktrees.find((w) => w.path === repository?.path),
    [worktrees, repository?.path]
  );

  const handleSelect = async (value: WorktreeInfo | null) => {
    if (value && value.path !== repository?.path) {
      try {
        const repoInfo = await openRepository(value.path);
        openTab(repoInfo);
        toast.success('Switched worktree', `Now viewing ${value.name}`);
      } catch (error) {
        toast.error('Failed to switch worktree', (error as Error).message);
      }
    }
    setOpen(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setInputValue('');
    }
  };

  // Don't render if no repository
  if (!repository) {
    return null;
  }

  return (
    <Combobox.Root<WorktreeInfo>
      value={currentWorktree ?? null}
      onValueChange={handleSelect}
      inputValue={inputValue}
      onInputValueChange={(val) => setInputValue(val)}
      itemToStringLabel={(worktree) => worktree?.name ?? ''}
      isItemEqualToValue={(a, b) => a.path === b.path}
      open={open}
      onOpenChange={handleOpenChange}
    >
      <Combobox.Trigger
        className="flex items-center gap-1.5 px-2 py-0.5 text-text-secondary hover:bg-bg-hover rounded-sm transition-colors cursor-pointer"
        aria-label="Switch worktree"
      >
        <TreeEvergreen size={12} weight="bold" />
        <span className="max-w-[120px] truncate">
          {isLoading ? '...' : (currentWorktree?.name ?? repository.name)}
        </span>
        <CaretUpDown size={10} className="text-text-muted" />
      </Combobox.Trigger>

      <Combobox.Portal keepMounted>
        <Combobox.Positioner sideOffset={4} className="z-50">
          <Combobox.Popup className="min-w-[200px] max-w-[300px] max-h-[350px] overflow-hidden rounded-md border border-border-primary bg-bg-secondary shadow-lg outline-hidden">
            <div className="p-2 border-b border-border-primary">
              <Combobox.Input
                placeholder="Search worktrees..."
                autoFocus
                className="w-full px-2 py-1.5 text-sm bg-bg-tertiary border border-border-primary rounded-sm text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-hidden"
              />
            </div>

            <div className="p-1 border-b border-border-primary">
              <button
                onClick={() => {
                  setOpen(false);
                  setShowCreateDialog(true);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-text-primary hover:bg-bg-hover rounded-sm transition-colors"
              >
                <Plus size={14} weight="bold" />
                <span>Create new worktree</span>
              </button>
            </div>

            <Combobox.List className="p-1 overflow-y-auto max-h-[250px]">
              {filteredWorktrees.map((worktree) => (
                <Combobox.Item
                  key={worktree.path}
                  value={worktree}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer text-text-primary data-highlighted:bg-bg-hover data-selected:bg-bg-selected"
                >
                  <Combobox.ItemIndicator className="w-4">
                    <Check size={14} weight="bold" className="text-text-secondary" />
                  </Combobox.ItemIndicator>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{worktree.name}</span>
                      {worktree.isMain && (
                        <span className="text-[10px] px-1 py-0.5 bg-accent-green/20 text-accent-green rounded-sm">
                          main
                        </span>
                      )}
                      {worktree.isDirty && (
                        <Circle
                          size={6}
                          weight="fill"
                          className="text-accent-yellow shrink-0"
                          title="Has uncommitted changes"
                        />
                      )}
                    </div>
                    {worktree.headBranch && (
                      <div className="text-xs text-text-muted truncate">
                        {worktree.headBranch}
                      </div>
                    )}
                  </div>
                </Combobox.Item>
              ))}
            </Combobox.List>

            {filteredWorktrees.length === 0 && (
              <div className="p-4 text-sm text-text-muted text-center">
                No worktrees found
              </div>
            )}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>

      <CreateWorktreeDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['worktrees'] });
        }}
      />
    </Combobox.Root>
  );
}
