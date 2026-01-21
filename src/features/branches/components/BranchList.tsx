import { useMemo, useState, useCallback, useEffect, memo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { VList } from 'virtua';
import type { VListHandle } from 'virtua';
import { listBranches, checkoutBranch } from '../../../lib/tauri';
import { useGitStore } from '../../../stores/git-store';
import { useUIStore } from '../../../stores/ui-store';
import { LoadingSpinner, SkeletonList } from '../../../components/ui';
import type { BranchInfo } from '../../../types/git';

// Memoized header row
const BranchHeaderRow = memo(function BranchHeaderRow({
  text,
}: {
  text: string;
}) {
  return (
    <div className="px-2 py-1 text-xs font-semibold text-text-muted bg-bg-tertiary uppercase tracking-wider">
      {text}
    </div>
  );
});

// Memoized branch row
const BranchRow = memo(function BranchRow({
  branch,
  isSelected,
  isFocused,
  onClick,
  onDoubleClick,
}: {
  branch: BranchInfo;
  isSelected: boolean;
  isFocused: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  const isHead = branch.is_head;

  return (
    <div
      className={`flex items-center px-2 py-1 cursor-pointer text-sm ${
        isFocused ? 'bg-bg-selected' : isSelected ? 'bg-bg-hover' : 'hover:bg-bg-hover'
      }`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <span className={`mr-2 ${isHead ? 'text-accent-green' : 'text-text-muted'}`}>
        {isHead ? '●' : '○'}
      </span>
      <span
        className={`truncate ${
          isHead ? 'text-accent-green font-medium' : 'text-text-primary'
        }`}
      >
        {branch.is_remote ? branch.name.replace(/^[^/]+\//, '') : branch.name}
      </span>
    </div>
  );
});

export function BranchList() {
  const { repository } = useGitStore();
  const {
    branchFilter,
    setBranchFilter,
    selectedBranch,
    setSelectedBranch,
    activePanel,
    setSelectedCommit
  } = useUIStore();
  const queryClient = useQueryClient();
  const listRef = useRef<VListHandle>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches', repository?.path],
    queryFn: () => listBranches(repository!.path),
    enabled: !!repository?.path,
    staleTime: 30000,
  });

  const checkoutMutation = useMutation({
    mutationFn: ({ branch }: { branch: string }) =>
      checkoutBranch(repository!.path, branch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
    },
  });

  // Filter branches
  const filteredBranches = useMemo(() => {
    if (!branchFilter) return branches;
    const lower = branchFilter.toLowerCase();
    return branches.filter((b) => b.name.toLowerCase().includes(lower));
  }, [branches, branchFilter]);

  // Group by local/remote
  const groupedBranches = useMemo(() => {
    const local = filteredBranches.filter((b) => !b.is_remote);
    const remote = filteredBranches.filter((b) => b.is_remote);
    return { local, remote };
  }, [filteredBranches]);

  // Flat list for navigation
  const flatList = useMemo(() => {
    const items: Array<{ type: 'header' | 'branch'; data: string | BranchInfo }> = [];
    if (groupedBranches.local.length > 0) {
      items.push({ type: 'header', data: 'Local' });
      groupedBranches.local.forEach((b) => items.push({ type: 'branch', data: b }));
    }
    if (groupedBranches.remote.length > 0) {
      items.push({ type: 'header', data: 'Remote' });
      groupedBranches.remote.forEach((b) => items.push({ type: 'branch', data: b }));
    }
    return items;
  }, [groupedBranches]);

  // Keyboard navigation
  useEffect(() => {
    if (activePanel !== 'branches') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = prev + 1;
          // Skip headers
          while (next < flatList.length && flatList[next].type === 'header') {
            next++;
          }
          return Math.min(next, flatList.length - 1);
        });
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = prev - 1;
          // Skip headers
          while (next >= 0 && flatList[next].type === 'header') {
            next--;
          }
          return Math.max(next, 0);
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = flatList[focusedIndex];
        if (item && item.type === 'branch') {
          const branch = item.data as BranchInfo;
          setSelectedBranch(branch.name);
          setSelectedCommit(null);
          if (!branch.is_remote) {
            checkoutMutation.mutate({ branch: branch.name });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePanel, flatList, focusedIndex, setSelectedBranch, setSelectedCommit, checkoutMutation]);

  // Scroll focused item into view
  useEffect(() => {
    listRef.current?.scrollToIndex(focusedIndex, { align: 'center' });
  }, [focusedIndex]);

  const handleBranchClick = useCallback(
    (branch: BranchInfo, index: number) => {
      setFocusedIndex(index);
      setSelectedBranch(branch.name);
      setSelectedCommit(null);
    },
    [setSelectedBranch, setSelectedCommit]
  );

  const handleBranchDoubleClick = useCallback(
    (branch: BranchInfo) => {
      if (!branch.is_remote) {
        checkoutMutation.mutate({ branch: branch.name });
      }
    },
    [checkoutMutation]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center py-3 px-2">
          <LoadingSpinner size="sm" message="Loading branches..." />
        </div>
        <div className="flex-1 px-2 overflow-hidden">
          <SkeletonList rows={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter input */}
      <div className="px-2 py-1.5 border-b border-border-primary">
        <input
          type="text"
          placeholder="Filter branches..."
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="w-full px-2 py-1 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-none"
        />
      </div>

      {/* Branch list */}
      <VList ref={listRef} className="flex-1">
        {flatList.map((item, index) => {
          if (item.type === 'header') {
            return (
              <BranchHeaderRow
                key={`header-${item.data}`}
                text={item.data as string}
              />
            );
          }

          const branch = item.data as BranchInfo;
          return (
            <BranchRow
              key={branch.name}
              branch={branch}
              isSelected={selectedBranch === branch.name}
              isFocused={index === focusedIndex}
              onClick={() => handleBranchClick(branch, index)}
              onDoubleClick={() => handleBranchDoubleClick(branch)}
            />
          );
        })}
      </VList>
    </div>
  );
}
