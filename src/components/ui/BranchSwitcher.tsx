import { useMemo, useState } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GitBranch, CaretUpDown, Check } from '@phosphor-icons/react';
import { listBranches, checkoutBranch } from '../../lib/tauri';
import { useGitStore } from '../../stores/git-store';
import { useToast } from './Toast';
import type { BranchInfo } from '../../types/git';

export function BranchSwitcher() {
  const { repository } = useGitStore();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [inputValue, setInputValue] = useState('');
  const [open, setOpen] = useState(false);

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
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
      queryClient.invalidateQueries({ queryKey: ['repository'] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.error('Checkout failed', message);
    },
  });

  // Only show local branches for switching
  const localBranches = useMemo(
    () => branches.filter((b) => !b.is_remote),
    [branches]
  );

  // Filter branches based on input
  const filteredBranches = useMemo(() => {
    if (!inputValue) return localBranches;
    const lower = inputValue.toLowerCase();
    return localBranches.filter((b) => b.name.toLowerCase().includes(lower));
  }, [localBranches, inputValue]);

  const currentBranch = useMemo(
    () => localBranches.find((b) => b.is_head),
    [localBranches]
  );

  const handleSelect = (value: BranchInfo | null) => {
    if (value && !value.is_head) {
      checkoutMutation.mutate(value.name);
    }
    setOpen(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setInputValue('');
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
        <span className="max-w-[150px] truncate">{repository.head_branch ?? 'detached'}</span>
        <CaretUpDown size={10} className="text-text-muted" />
      </Combobox.Trigger>

      <Combobox.Portal keepMounted>
        <Combobox.Positioner sideOffset={4} className="z-50">
          <Combobox.Popup className="min-w-[200px] max-w-[300px] max-h-[300px] overflow-hidden rounded-md border border-border-primary bg-bg-secondary shadow-lg outline-none">
            <div className="p-2 border-b border-border-primary">
              <Combobox.Input
                placeholder="Search branches..."
                autoFocus
                className="w-full px-2 py-1.5 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-none"
              />
            </div>

            <Combobox.List className="p-1 overflow-y-auto max-h-[250px]">
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
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
