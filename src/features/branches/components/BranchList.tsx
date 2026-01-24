import { useMemo, useState, useCallback, useEffect, memo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { VList } from "virtua";
import type { VListHandle } from "virtua";
import { GitMerge, GitFork, Rows } from "@phosphor-icons/react";
import {
  listBranches,
  checkoutBranch,
  mergeBranch,
  getMergeStatus,
  parseFileConflicts,
  getStatus,
  rebaseOnto,
  getRebaseStatus,
} from "../../../lib/tauri";
import {
  useTabsStore,
  useActiveTabState,
  useActiveTabPanels,
} from "../../../stores/tabs-store";
import {
  useActivePanel,
  usePanelFontSize,
  getDockviewApi,
} from "../../../stores/ui-store";
import { useMergeConflictStore } from "../../../stores/merge-conflict-store";
import { LoadingSpinner, SkeletonList, Input } from "../../../components/ui";
import { Button } from "../../../components/ui/Button";
import { useToast } from "../../../components/ui/Toast";
import { getErrorMessage } from "../../../lib/errors";
import { applyLayout } from "../../../lib/layouts";
import type { BranchInfo } from "../../../types/git";
import { InteractiveRebaseDialog } from "../../commits/components/InteractiveRebaseDialog";

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
  fontSize,
}: {
  branch: BranchInfo;
  isSelected: boolean;
  isFocused: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  fontSize: number;
}) {
  const isHead = branch.isHead;

  return (
    <div
      className={`flex items-center px-2 py-1 cursor-pointer ${
        isFocused
          ? "bg-bg-selected"
          : isSelected
            ? "bg-bg-hover"
            : "hover:bg-bg-hover"
      }`}
      style={{ fontSize: `${fontSize}px` }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <span
        className={`mr-2 ${isHead ? "text-accent-green" : "text-text-muted"}`}
      >
        {isHead ? "●" : "○"}
      </span>
      <span
        className={`truncate ${
          isHead ? "text-accent-green font-medium" : "text-text-primary"
        }`}
      >
        {branch.isRemote ? branch.name.replace(/^[^/]+\//, "") : branch.name}
      </span>
    </div>
  );
});

export function BranchList() {
  const { repository } = useTabsStore();
  const {
    branchFilter,
    setBranchFilter,
    selectedBranch,
    setSelectedBranch,
    setSelectedCommit,
  } = useActiveTabState();
  // Use focused hooks - avoids re-render when unrelated state changes
  const { activePanel } = useActivePanel();
  const { setShowMergeConflictPanel } = useActiveTabPanels();
  const panelFontSize = usePanelFontSize();
  const { enterMergeMode, enterConflictMode } = useMergeConflictStore();
  const queryClient = useQueryClient();
  const toast = useToast();
  const listRef = useRef<VListHandle>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isRebasing, setIsRebasing] = useState(false);
  const [showInteractiveRebaseDialog, setShowInteractiveRebaseDialog] =
    useState(false);

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches", repository?.path],
    queryFn: () => listBranches(repository!.path),
    enabled: !!repository?.path,
    staleTime: 30000,
  });

  const checkoutMutation = useMutation({
    mutationFn: ({ branch }: { branch: string }) =>
      checkoutBranch(repository!.path, branch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["commits"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: ({ branch }: { branch: string }) =>
      mergeBranch(repository!.path, branch),
    onSuccess: () => {
      toast.success(
        "Merge successful",
        `Merged ${selectedBranch} into current branch`,
      );
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["commits"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });
    },
    onError: async (error) => {
      const errorMsg = getErrorMessage(error);
      if (errorMsg.includes("conflicts")) {
        // Merge created conflicts - open the conflict resolution panel
        toast.warning(
          "Merge conflicts",
          "The merge has conflicts that need to be resolved",
        );
        try {
          const mergeStatus = await getMergeStatus(repository!.path);
          if (mergeStatus.conflictingFiles.length > 0) {
            const fileInfos = await Promise.all(
              mergeStatus.conflictingFiles.map((filePath) =>
                parseFileConflicts(repository!.path, filePath),
              ),
            );
            enterMergeMode(fileInfos, mergeStatus.theirBranch);
            setShowMergeConflictPanel(true);
            // Switch to merge conflict layout
            const api = getDockviewApi();
            if (api) {
              applyLayout(api, "merge-conflict");
            }
          }
        } catch (e) {
          console.error("Failed to load conflict info:", e);
        }
        queryClient.invalidateQueries({ queryKey: ["merge-status"] });
      } else {
        toast.error("Merge failed", errorMsg);
      }
    },
  });

  const handleMerge = useCallback(() => {
    if (!selectedBranch || !repository) return;

    // Find the selected branch info
    const branch = branches.find((b) => b.name === selectedBranch);
    if (!branch) return;

    // Don't merge if it's the current branch
    if (branch.isHead) {
      toast.warning("Cannot merge", "Cannot merge a branch into itself");
      return;
    }

    mergeMutation.mutate({ branch: selectedBranch });
  }, [selectedBranch, repository, branches, mergeMutation, toast]);

  const handleRebase = useCallback(async () => {
    if (!selectedBranch || !repository || isRebasing) return;

    // Find the selected branch info
    const branch = branches.find((b) => b.name === selectedBranch);
    if (!branch) return;

    // Don't rebase onto the current branch
    if (branch.isHead) {
      toast.warning("Cannot rebase", "Cannot rebase onto the current branch");
      return;
    }

    setIsRebasing(true);

    // Preflight check: ensure clean working tree
    try {
      const status = await getStatus(repository.path);
      const hasChanges =
        status.staged.length > 0 ||
        status.unstaged.length > 0 ||
        status.untracked.length > 0;

      if (hasChanges) {
        toast.error(
          "Cannot rebase with uncommitted changes",
          "Please commit or stash your changes before rebasing",
        );
        setIsRebasing(false);
        return;
      }
    } catch (error) {
      toast.error("Failed to check status", getErrorMessage(error));
      setIsRebasing(false);
      return;
    }

    // Perform the rebase
    try {
      await rebaseOnto(repository.path, selectedBranch);
      toast.success(
        "Rebase successful",
        `Rebased current branch onto ${selectedBranch}`,
      );
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["commits"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });
      queryClient.invalidateQueries({ queryKey: ["aheadBehind"] });
      queryClient.invalidateQueries({ queryKey: ["graph-commits"] });
      queryClient.invalidateQueries({ queryKey: ["graphTableGraph"] });
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      if (errorMsg.includes("conflict") || errorMsg.includes("CONFLICT")) {
        toast.warning(
          "Rebase conflicts",
          "The rebase has conflicts that need to be resolved",
        );
        // Open the conflict panel
        try {
          const rebaseStatus = await getRebaseStatus(repository.path);
          if (rebaseStatus.conflictingFiles.length > 0) {
            const fileInfos = await Promise.all(
              rebaseStatus.conflictingFiles.map((filePath) =>
                parseFileConflicts(repository.path, filePath),
              ),
            );
            enterConflictMode(fileInfos, rebaseStatus.ontoRef, "rebase");
            setShowMergeConflictPanel(true);
            // Switch to merge conflict layout
            const api = getDockviewApi();
            if (api) {
              applyLayout(api, "merge-conflict");
            }
          }
        } catch (e) {
          console.error("Failed to load conflict info:", e);
        }
        queryClient.invalidateQueries({ queryKey: ["rebase-status"] });
      } else {
        toast.error("Rebase failed", errorMsg);
      }
    } finally {
      setIsRebasing(false);
    }
  }, [
    selectedBranch,
    repository,
    isRebasing,
    branches,
    toast,
    queryClient,
    enterConflictMode,
    setShowMergeConflictPanel,
  ]);

  // Filter branches
  const filteredBranches = useMemo(() => {
    if (!branchFilter) return branches;
    const lower = branchFilter.toLowerCase();
    return branches.filter((b) => b.name.toLowerCase().includes(lower));
  }, [branches, branchFilter]);

  // Group by local/remote
  const groupedBranches = useMemo(() => {
    const local = filteredBranches.filter((b) => !b.isRemote);
    const remote = filteredBranches.filter((b) => b.isRemote);
    return { local, remote };
  }, [filteredBranches]);

  // Flat list for navigation
  const flatList = useMemo(() => {
    const items: Array<{
      type: "header" | "branch";
      data: string | BranchInfo;
    }> = [];
    if (groupedBranches.local.length > 0) {
      items.push({ type: "header", data: "Local" });
      groupedBranches.local.forEach((b) =>
        items.push({ type: "branch", data: b }),
      );
    }
    if (groupedBranches.remote.length > 0) {
      items.push({ type: "header", data: "Remote" });
      groupedBranches.remote.forEach((b) =>
        items.push({ type: "branch", data: b }),
      );
    }
    return items;
  }, [groupedBranches]);

  // Keyboard navigation
  useEffect(() => {
    if (activePanel !== "branches") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = prev + 1;
          // Skip headers
          while (next < flatList.length && flatList[next].type === "header") {
            next++;
          }
          return Math.min(next, flatList.length - 1);
        });
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = prev - 1;
          // Skip headers
          while (next >= 0 && flatList[next].type === "header") {
            next--;
          }
          return Math.max(next, 0);
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flatList[focusedIndex];
        if (item && item.type === "branch") {
          const branch = item.data as BranchInfo;
          setSelectedBranch(branch.name);
          setSelectedCommit(null);
          if (!branch.isRemote) {
            checkoutMutation.mutate({ branch: branch.name });
          }
        }
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        handleMerge();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        handleRebase();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activePanel,
    flatList,
    focusedIndex,
    setSelectedBranch,
    setSelectedCommit,
    checkoutMutation,
    handleMerge,
    handleRebase,
  ]);

  // Scroll focused item into view
  useEffect(() => {
    listRef.current?.scrollToIndex(focusedIndex, { align: "center" });
  }, [focusedIndex]);

  const handleBranchClick = useCallback(
    (branch: BranchInfo, index: number) => {
      setFocusedIndex(index);
      setSelectedBranch(branch.name);
      setSelectedCommit(null);
    },
    [setSelectedBranch, setSelectedCommit],
  );

  const handleBranchDoubleClick = useCallback(
    (branch: BranchInfo) => {
      if (!branch.isRemote) {
        checkoutMutation.mutate({ branch: branch.name });
      }
    },
    [checkoutMutation],
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

  // Check if selected branch can be merged (not the current branch)
  const canMerge = useMemo(() => {
    if (!selectedBranch) return false;
    const branch = branches.find((b) => b.name === selectedBranch);
    return branch && !branch.isHead;
  }, [selectedBranch, branches]);

  return (
    <div className="flex flex-col h-full">
      {/* Filter input and merge button */}
      <div className="px-2 py-1.5 border-b border-border-primary space-y-1.5">
        <Input
          placeholder="Filter branches..."
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          size="sm"
          style={{ fontSize: `${panelFontSize}px` }}
        />
        {canMerge && (
          <div className="flex flex-col gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleMerge}
              loading={mergeMutation.isPending}
              leftIcon={<GitMerge size={12} weight="bold" />}
              className="w-full"
            >
              Merge "{selectedBranch?.replace(/^[^/]+\//, "")}" into current
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRebase}
              loading={isRebasing}
              leftIcon={<GitFork size={12} weight="bold" />}
              className="w-full text-text-muted hover:text-text-primary"
            >
              Rebase current onto "{selectedBranch?.replace(/^[^/]+\//, "")}"
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInteractiveRebaseDialog(true)}
              leftIcon={<Rows size={12} weight="bold" />}
              className="w-full text-accent-purple hover:text-accent-purple/80"
            >
              Interactive rebase onto "{selectedBranch?.replace(/^[^/]+\//, "")}
              "
            </Button>
          </div>
        )}
      </div>

      {/* Branch list */}
      <VList ref={listRef} className="flex-1">
        {flatList.map((item, index) => {
          if (item.type === "header") {
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
              fontSize={panelFontSize}
            />
          );
        })}
      </VList>

      {/* Interactive Rebase Dialog */}
      {showInteractiveRebaseDialog && repository && selectedBranch && (
        <InteractiveRebaseDialog
          repoPath={repository.path}
          ontoRef={selectedBranch}
          onClose={() => setShowInteractiveRebaseDialog(false)}
          onSuccess={() => {
            setShowInteractiveRebaseDialog(false);
            queryClient.invalidateQueries({ queryKey: ["branches"] });
            queryClient.invalidateQueries({ queryKey: ["commits"] });
          }}
        />
      )}
    </div>
  );
}
