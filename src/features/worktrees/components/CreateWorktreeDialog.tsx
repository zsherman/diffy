import { useState, useMemo } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useQuery, useMutation } from '@tanstack/react-query';
import { X, FolderOpen, GitBranch } from '@phosphor-icons/react';
import { createWorktree, listBranches } from '../../../lib/tauri';
import { useTabsStore } from '../../../stores/tabs-store';
import { useToast } from '../../../components/ui/Toast';

interface CreateWorktreeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type BranchMode = 'existing' | 'new';

export function CreateWorktreeDialog({ open, onOpenChange, onSuccess }: CreateWorktreeDialogProps) {
  const { repository } = useTabsStore();
  const toast = useToast();

  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [branchMode, setBranchMode] = useState<BranchMode>('existing');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [newBranchName, setNewBranchName] = useState('');

  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: ['branches', repository?.path],
    queryFn: () => listBranches(repository!.path),
    enabled: !!repository?.path && open,
  });

  // Filter to local branches only
  const localBranches = useMemo(
    () => branches.filter((b) => !b.isRemote),
    [branches]
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!repository) throw new Error('No repository open');

      const options = {
        name: name || path.split('/').pop() || 'worktree',
        path,
        branch: branchMode === 'existing' ? selectedBranch : undefined,
        newBranch: branchMode === 'new' ? newBranchName : undefined,
      };

      return createWorktree(repository.path, options);
    },
    onSuccess: () => {
      toast.success('Worktree created', 'Successfully created new worktree');
      onSuccess();
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error('Failed to create worktree', error.message);
    },
  });

  const resetForm = () => {
    setName('');
    setPath('');
    setBranchMode('existing');
    setSelectedBranch('');
    setNewBranchName('');
  };

  const handleSelectPath = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: 'Select worktree location',
      });
      if (selected && typeof selected === 'string') {
        setPath(selected);
        // Auto-fill name from folder name if empty
        if (!name) {
          const folderName = selected.split('/').pop();
          if (folderName) setName(folderName);
        }
      }
    } catch (error) {
      console.error('Failed to open folder dialog:', error);
    }
  };

  const canSubmit = useMemo(() => {
    if (!path) return false;
    if (branchMode === 'existing' && !selectedBranch) return false;
    if (branchMode === 'new' && !newBranchName) return false;
    return true;
  }, [path, branchMode, selectedBranch, newBranchName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) {
      createMutation.mutate();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[480px] max-w-[90vw] bg-bg-secondary rounded-lg shadow-xl border border-border-primary flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
            <Dialog.Title className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <FolderOpen size={16} weight="bold" />
              Create New Worktree
            </Dialog.Title>
            <Dialog.Close className="p-1 rounded hover:bg-bg-hover transition-colors text-text-muted hover:text-text-primary">
              <X size={16} weight="bold" />
            </Dialog.Close>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm text-text-primary mb-1.5">
                Worktree Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., feature-work"
                className="w-full px-3 py-2 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-none"
              />
              <p className="text-xs text-text-muted mt-1">
                Optional. Will be derived from path if empty.
              </p>
            </div>

            {/* Path */}
            <div>
              <label className="block text-sm text-text-primary mb-1.5">
                Location
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/path/to/worktree"
                  className="flex-1 px-3 py-2 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSelectPath}
                  className="px-3 py-2 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary hover:bg-bg-hover flex items-center gap-1"
                >
                  <FolderOpen size={14} />
                  Browse
                </button>
              </div>
            </div>

            {/* Branch mode */}
            <div>
              <label className="block text-sm text-text-primary mb-1.5">
                Branch
              </label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setBranchMode('existing')}
                  className={`flex-1 px-3 py-2 text-sm rounded border transition-colors ${
                    branchMode === 'existing'
                      ? 'bg-accent-blue/20 border-accent-blue text-accent-blue'
                      : 'bg-bg-tertiary border-border-primary text-text-muted hover:text-text-primary'
                  }`}
                >
                  Existing Branch
                </button>
                <button
                  type="button"
                  onClick={() => setBranchMode('new')}
                  className={`flex-1 px-3 py-2 text-sm rounded border transition-colors ${
                    branchMode === 'new'
                      ? 'bg-accent-blue/20 border-accent-blue text-accent-blue'
                      : 'bg-bg-tertiary border-border-primary text-text-muted hover:text-text-primary'
                  }`}
                >
                  New Branch
                </button>
              </div>

              {branchMode === 'existing' ? (
                <div className="relative">
                  <GitBranch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary focus:border-accent-blue focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="">Select a branch...</option>
                    {localBranches.map((branch) => (
                      <option key={branch.name} value={branch.name}>
                        {branch.name} {branch.isHead ? '(current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="New branch name"
                  className="w-full px-3 py-2 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-none"
                />
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary hover:bg-bg-hover transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit || createMutation.isPending}
                className="px-4 py-2 text-sm bg-accent-blue text-white rounded hover:bg-accent-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Worktree'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
