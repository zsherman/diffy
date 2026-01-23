import { useMemo, useState } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GitBranch, CaretUpDown, Check, Plus } from '@phosphor-icons/react';
import { listBranches, checkoutBranch, createBranch } from '../../lib/tauri';
import { useGitStore } from '../../stores/git-store';
import { useToast } from './Toast';
import { getErrorMessage } from '../../lib/errors';
import type { BranchInfo } from '../../types/git';

export function BranchSwitcher() {
  const { repository, setHeadBranch } = useGitStore();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [inputValue, setInputValue] = useState('');
  const [open, setOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');

  const { data: branches = [] } = useQuery({
    queryKey: ['branches', repository?.path],
    queryFn: () => listBranches(repository!.path),
    enabled: !!repository?.path,
    staleTime: 30000,
  });

  const checkoutMutation = useMutation({
    mutationFn: (branchName: string) => checkoutBranch(repository!.path, branchName),
    onSuccess: (_, branchName) => {
      toast.success('Branch switched', `Switched to ${branchName}`);
      // Update the head branch in the store immediately
      setHeadBranch(branchName);
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['branches'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['commits'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['graph'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['status'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['repository'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['working-diff-staged'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['working-diff-unstaged'], refetchType: 'all' });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.error('Checkout failed', message);
    },
  });

  const createBranchMutation = useMutation({
    mutationFn: (branchName: string) => createBranch(repository!.path, branchName, true),
    onSuccess: (_, branchName) => {
      toast.success('Branch created', `Created and switched to ${branchName}`);
      // Update the head branch in the store immediately
      setHeadBranch(branchName);
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['branches'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['commits'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['graph'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['status'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['repository'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['working-diff-staged'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['working-diff-unstaged'], refetchType: 'all' });
      setNewBranchName('');
      setShowCreateForm(false);
      setOpen(false);
    },
    onError: (error) => {
      toast.error('Create branch failed', getErrorMessage(error));
    },
  });

  // Only show local branches for switching
  const localBranches = useMemo(
    () => branches.filter((b) => !b.isRemote),
    [branches]
  );

  // Filter branches based on input
  const filteredBranches = useMemo(() => {
    if (!inputValue) return localBranches;
    const lower = inputValue.toLowerCase();
    return localBranches.filter((b) => b.name.toLowerCase().includes(lower));
  }, [localBranches, inputValue]);

  const currentBranch = useMemo(
    () => localBranches.find((b) => b.isHead),
    [localBranches]
  );

  const handleSelect = (value: BranchInfo | null) => {
    if (value && !value.isHead) {
      checkoutMutation.mutate(value.name);
    }
    setOpen(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setInputValue('');
      setShowCreateForm(false);
      setNewBranchName('');
    }
  };

  const handleCreateBranch = () => {
    const trimmed = newBranchName.trim();
    if (trimmed) {
      createBranchMutation.mutate(trimmed);
    }
  };

  if (!repository) return null;

  return (
    <Combobox.Root<BranchInfo>
      value={currentBranch ?? null}
      onValueChange={handleSelect}
      inputValue={inputValue}
      onInputValueChange={(val) => setInputValue(val)}
      itemToStringLabel={(branch) => branch?.name ?? ''}
      isItemEqualToValue={(a, b) => a.name === b.name}
      open={open}
      onOpenChange={handleOpenChange}
    >
      <Combobox.Trigger
        className="flex items-center gap-1.5 px-2 py-0.5 text-accent-green hover:bg-bg-hover rounded transition-colors cursor-pointer"
        aria-label="Switch branch"
      >
        <GitBranch size={12} weight="bold" />
        <span className="max-w-[150px] truncate">{repository.headBranch ?? 'detached'}</span>
        <CaretUpDown size={10} className="text-text-muted" />
      </Combobox.Trigger>

      <Combobox.Portal keepMounted>
        <Combobox.Positioner sideOffset={4} className="z-50">
          <Combobox.Popup className="min-w-[200px] max-w-[300px] max-h-[350px] overflow-hidden rounded-md border border-border-primary bg-bg-secondary shadow-lg outline-none">
            {showCreateForm ? (
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-text-primary">Create New Branch</div>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="text-xs text-text-muted hover:text-text-primary"
                  >
                    Back
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Branch name..."
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateBranch();
                    } else if (e.key === 'Escape') {
                      setShowCreateForm(false);
                    }
                  }}
                  className="w-full px-2 py-1.5 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-none"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary rounded border border-border-primary hover:bg-bg-hover transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateBranch}
                    disabled={!newBranchName.trim() || createBranchMutation.isPending}
                    className="px-3 py-1.5 text-xs text-white bg-accent-blue hover:bg-accent-blue/90 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Create & Checkout
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-2 border-b border-border-primary">
                  <Combobox.Input
                    placeholder="Search branches..."
                    autoFocus
                    className="w-full px-2 py-1.5 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-none"
                  />
                </div>

                <div className="p-1 border-b border-border-primary">
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-text-primary hover:bg-bg-hover rounded transition-colors"
                  >
                    <Plus size={14} weight="bold" />
                    <span>Create new branch</span>
                  </button>
                </div>

                <Combobox.List className="p-1 overflow-y-auto max-h-[200px]">
                  {filteredBranches.map((branch) => (
                    <Combobox.Item
                      key={branch.name}
                      value={branch}
                      className="flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer text-text-primary data-[highlighted]:bg-bg-hover data-[selected]:bg-bg-selected"
                    >
                      <Combobox.ItemIndicator className="w-4">
                        <Check size={14} weight="bold" className="text-accent-green" />
                      </Combobox.ItemIndicator>
                      <span className="truncate">{branch.name}</span>
                    </Combobox.Item>
                  ))}
                </Combobox.List>

                {filteredBranches.length === 0 && (
                  <div className="p-4 text-sm text-text-muted text-center">
                    No branches found
                  </div>
                )}
              </>
            )}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
