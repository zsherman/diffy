import { useState, useMemo, useCallback } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  X,
  GitFork,
  Warning,
  DotsSixVertical,
  ArrowUp,
  ArrowDown,
  CaretDown,
} from "@phosphor-icons/react";
import { Menu } from "@base-ui/react/menu";
import {
  getInteractiveRebaseCommits,
  startInteractiveRebase,
  getStatus,
  getInteractiveRebaseState,
  parseFileConflicts,
} from "../../../lib/tauri";
import { useToast } from "../../../components/ui/Toast";
import { getErrorMessage } from "../../../lib/errors";
import { useMergeConflictStore } from "../../../stores/merge-conflict-store";
import { useUIStore, getDockviewApi } from "../../../stores/ui-store";
import { applyLayout } from "../../../lib/layouts";
import type {
  InteractiveRebaseCommit,
  InteractiveRebasePlanEntry,
  RebaseTodoAction,
} from "../../merge-conflict/types";

interface InteractiveRebaseDialogProps {
  repoPath: string;
  ontoRef: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface RebasePlanItem {
  commit: InteractiveRebaseCommit;
  action: RebaseTodoAction;
}

const ACTION_LABELS: Record<RebaseTodoAction, string> = {
  pick: "Pick",
  reword: "Reword",
  edit: "Edit",
  squash: "Squash",
  fixup: "Fixup",
  drop: "Drop",
};

const ACTION_DESCRIPTIONS: Record<RebaseTodoAction, string> = {
  pick: "Use commit as-is",
  reword: "Edit commit message",
  edit: "Stop to amend commit",
  squash: "Combine with previous, edit message",
  fixup: "Combine with previous, discard message",
  drop: "Remove commit",
};

const ACTION_COLORS: Record<RebaseTodoAction, string> = {
  pick: "text-text-primary",
  reword: "text-accent-blue",
  edit: "text-accent-purple",
  squash: "text-accent-amber",
  fixup: "text-accent-amber",
  drop: "text-accent-red line-through",
};

export function InteractiveRebaseDialog({
  repoPath,
  ontoRef,
  onClose,
  onSuccess,
}: InteractiveRebaseDialogProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { enterConflictMode } = useMergeConflictStore();
  const { setShowMergeConflictPanel } = useUIStore();

  // Fetch commits that would be rebased
  const { data: commits = [], isLoading } = useQuery({
    queryKey: ["interactive-rebase-commits", repoPath, ontoRef],
    queryFn: () => getInteractiveRebaseCommits(repoPath, ontoRef),
    staleTime: 0,
  });

  // Initialize plan from commits
  const [plan, setPlan] = useState<RebasePlanItem[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Initialize plan when commits load
  useMemo(() => {
    if (commits.length > 0 && plan.length === 0) {
      setPlan(
        commits.map((commit) => ({
          commit,
          action: "pick" as RebaseTodoAction,
        })),
      );
    }
  }, [commits, plan.length]);

  // Validation: first commit can't be squash/fixup
  const validationError = useMemo(() => {
    if (plan.length === 0) return null;
    const firstAction = plan[0]?.action;
    if (firstAction === "squash" || firstAction === "fixup") {
      return "First commit cannot be squash or fixup";
    }
    // Check for squash/fixup after drop
    for (let i = 1; i < plan.length; i++) {
      const action = plan[i].action;
      const prevAction = plan[i - 1].action;
      if (
        (action === "squash" || action === "fixup") &&
        prevAction === "drop"
      ) {
        return `Cannot ${action} after a dropped commit`;
      }
    }
    return null;
  }, [plan]);

  // Check if all commits are dropped
  const allDropped = useMemo(() => {
    return plan.length > 0 && plan.every((item) => item.action === "drop");
  }, [plan]);

  const setAction = useCallback((index: number, action: RebaseTodoAction) => {
    setPlan((prev) => {
      const newPlan = [...prev];
      newPlan[index] = { ...newPlan[index], action };
      return newPlan;
    });
  }, []);

  const moveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setPlan((prev) => {
      const newPlan = [...prev];
      [newPlan[index - 1], newPlan[index]] = [
        newPlan[index],
        newPlan[index - 1],
      ];
      return newPlan;
    });
  }, []);

  const moveDown = useCallback((index: number) => {
    setPlan((prev) => {
      if (index >= prev.length - 1) return prev;
      const newPlan = [...prev];
      [newPlan[index], newPlan[index + 1]] = [
        newPlan[index + 1],
        newPlan[index],
      ];
      return newPlan;
    });
  }, []);

  // Drag and drop handlers
  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === index) return;

      setPlan((prev) => {
        const newPlan = [...prev];
        const [dragged] = newPlan.splice(draggedIndex, 1);
        newPlan.splice(index, 0, dragged);
        return newPlan;
      });
      setDraggedIndex(index);
    },
    [draggedIndex],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  // Start rebase mutation
  const startRebaseMutation = useMutation({
    mutationFn: async () => {
      // Check for uncommitted changes first
      const status = await getStatus(repoPath);
      const hasChanges =
        status.staged.length > 0 ||
        status.unstaged.length > 0 ||
        status.untracked.length > 0;

      if (hasChanges) {
        throw new Error(
          "Cannot rebase with uncommitted changes. Please commit or stash your changes first.",
        );
      }

      // Build the plan entries
      const planEntries: InteractiveRebasePlanEntry[] = plan.map((item) => ({
        commitId: item.commit.id,
        action: item.action,
      }));

      return startInteractiveRebase(repoPath, ontoRef, planEntries);
    },
    onSuccess: async () => {
      // Check if we stopped for conflicts or editing
      try {
        const state = await getInteractiveRebaseState(repoPath);
        if (state.inRebase && state.conflictingFiles.length > 0) {
          // Handle conflicts
          toast.warning(
            "Rebase conflicts",
            "The rebase has conflicts that need to be resolved",
          );
          const fileInfos = await Promise.all(
            state.conflictingFiles.map((filePath) =>
              parseFileConflicts(repoPath, filePath),
            ),
          );
          enterConflictMode(fileInfos, state.ontoRef, "rebase");
          setShowMergeConflictPanel(true);
          const api = getDockviewApi();
          if (api) {
            applyLayout(api, "merge-conflict");
          }
          queryClient.invalidateQueries({ queryKey: ["rebase-status"] });
          onSuccess();
          return;
        }

        if (state.inRebase && state.stopReason !== "none") {
          // Stopped for edit/reword - handled by the caller
          toast.info(
            "Rebase in progress",
            `Stopped for ${state.stopReason}. Use Continue/Abort to proceed.`,
          );
        } else {
          toast.success(
            "Rebase successful",
            `Rebased ${plan.filter((p) => p.action !== "drop").length} commits onto ${ontoRef}`,
          );
        }
      } catch {
        toast.success("Rebase started", "Interactive rebase is in progress");
      }

      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["commits"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });
      queryClient.invalidateQueries({ queryKey: ["aheadBehind"] });
      // Reset infinite queries to force refetch from scratch (not just invalidate)
      queryClient.resetQueries({ queryKey: ["graph-commits"] });
      queryClient.resetQueries({ queryKey: ["graphTableGraph"] });
      onSuccess();
    },
    onError: async (error: Error) => {
      const errorMsg = getErrorMessage(error);
      if (errorMsg.includes("conflict") || errorMsg.includes("CONFLICT")) {
        toast.warning(
          "Rebase conflicts",
          "The rebase has conflicts that need to be resolved",
        );
        // Try to load conflict info
        try {
          const state = await getInteractiveRebaseState(repoPath);
          if (state.conflictingFiles.length > 0) {
            const fileInfos = await Promise.all(
              state.conflictingFiles.map((filePath) =>
                parseFileConflicts(repoPath, filePath),
              ),
            );
            enterConflictMode(fileInfos, state.ontoRef, "rebase");
            setShowMergeConflictPanel(true);
            const api = getDockviewApi();
            if (api) {
              applyLayout(api, "merge-conflict");
            }
          }
        } catch (e) {
          console.error("Failed to load conflict info:", e);
        }
        queryClient.invalidateQueries({ queryKey: ["rebase-status"] });
        queryClient.resetQueries({ queryKey: ["graph-commits"] });
        queryClient.resetQueries({ queryKey: ["graphTableGraph"] });
        onSuccess();
      } else {
        toast.error("Rebase failed", errorMsg);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError || allDropped || plan.length === 0) return;
    startRebaseMutation.mutate();
  };

  const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;

    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return `${Math.floor(diff / 604800)}w ago`;
  };

  return (
    <Dialog.Root open={true} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[700px] max-w-[90vw] max-h-[85vh] bg-bg-secondary rounded-lg shadow-xl border border-border-primary flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
            <Dialog.Title className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <GitFork size={16} weight="bold" />
              Interactive Rebase onto {ontoRef}
            </Dialog.Title>
            <Dialog.Close className="p-1 rounded-sm hover:bg-bg-hover transition-colors text-text-muted hover:text-text-primary">
              <X size={16} weight="bold" />
            </Dialog.Close>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Instructions */}
            <div className="px-4 py-2 bg-bg-tertiary border-b border-border-primary text-xs text-text-muted flex items-center justify-between">
              <span>Drag to reorder commits. Click action to change.</span>
              <span className="text-text-muted/60">
                oldest → newest (top to bottom)
              </span>
            </div>

            {/* Warning notice */}
            {(validationError || allDropped) && (
              <div className="mx-4 mt-3 flex items-start gap-2 p-3 bg-accent-red/10 border border-accent-red/30 rounded text-sm">
                <Warning
                  size={16}
                  weight="bold"
                  className="text-accent-red shrink-0 mt-0.5"
                />
                <div className="text-text-primary">
                  {validationError || "Cannot drop all commits"}
                </div>
              </div>
            )}

            {/* Commit list */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-32 text-text-muted text-sm">
                  Loading commits...
                </div>
              ) : commits.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-text-muted text-sm">
                  No commits to rebase. The branch is already up to date with{" "}
                  {ontoRef}.
                </div>
              ) : (
                <div className="space-y-1">
                  {plan.map((item, index) => (
                    <div
                      key={item.commit.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-2 p-2 rounded-md border transition-colors ${
                        draggedIndex === index
                          ? "bg-bg-hover border-accent-blue"
                          : "bg-bg-tertiary border-border-primary hover:border-border-secondary"
                      } ${item.action === "drop" ? "opacity-50" : ""}`}
                    >
                      {/* Order indicator */}
                      <span className="w-5 text-center text-xs text-text-muted/50 font-mono">
                        {index + 1}
                      </span>
                      {/* Drag handle */}
                      <div className="cursor-grab text-text-muted hover:text-text-primary">
                        <DotsSixVertical size={16} weight="bold" />
                      </div>

                      {/* Action dropdown */}
                      <Menu.Root>
                        <Menu.Trigger className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-bg-secondary border border-border-primary rounded hover:bg-bg-hover transition-colors min-w-[80px]">
                          <span className={ACTION_COLORS[item.action]}>
                            {ACTION_LABELS[item.action]}
                          </span>
                          <CaretDown size={12} className="text-text-muted" />
                        </Menu.Trigger>
                        <Menu.Portal>
                          <Menu.Positioner className="z-[60]">
                            <Menu.Popup className="min-w-[180px] overflow-hidden rounded-lg border border-border-primary bg-bg-secondary shadow-xl py-1">
                              {(
                                Object.keys(ACTION_LABELS) as RebaseTodoAction[]
                              ).map((action) => (
                                <Menu.Item
                                  key={action}
                                  className={`flex flex-col px-3 py-2 cursor-pointer data-highlighted:bg-bg-hover outline-hidden ${ACTION_COLORS[action]}`}
                                  onClick={() => setAction(index, action)}
                                >
                                  <span className="text-sm font-medium">
                                    {ACTION_LABELS[action]}
                                  </span>
                                  <span className="text-xs text-text-muted">
                                    {ACTION_DESCRIPTIONS[action]}
                                  </span>
                                </Menu.Item>
                              ))}
                            </Menu.Popup>
                          </Menu.Positioner>
                        </Menu.Portal>
                      </Menu.Root>

                      {/* Commit info */}
                      <div className="flex-1 min-w-0">
                        <div
                          className={`flex items-center gap-2 ${item.action === "drop" ? "line-through text-text-muted" : ""}`}
                        >
                          <span className="font-mono text-xs text-text-muted">
                            {item.commit.shortId}
                          </span>
                          <span className="text-sm text-text-primary truncate">
                            {item.commit.summary}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                          <span>{item.commit.authorName}</span>
                          <span>•</span>
                          <span>{formatTimeAgo(item.commit.time)}</span>
                        </div>
                      </div>

                      {/* Move buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveUp(index)}
                          disabled={index === 0}
                          className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDown(index)}
                          disabled={index === plan.length - 1}
                          className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between px-4 py-3 bg-bg-tertiary border-t border-border-primary">
              <div className="text-xs text-text-muted">
                {plan.filter((p) => p.action !== "drop").length} of{" "}
                {plan.length} commits will be applied
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm bg-bg-secondary border border-border-primary rounded text-text-primary hover:bg-bg-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isLoading ||
                    commits.length === 0 ||
                    !!validationError ||
                    allDropped ||
                    startRebaseMutation.isPending
                  }
                  className="px-4 py-2 text-sm bg-accent-blue text-white rounded hover:bg-accent-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {startRebaseMutation.isPending
                    ? "Starting..."
                    : "Start Rebase"}
                </button>
              </div>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
