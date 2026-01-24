import { useState, useEffect } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X,
  PencilSimple,
  GitCommit,
  Warning,
  ArrowRight,
  FastForward,
  XCircle,
} from "@phosphor-icons/react";
import {
  continueInteractiveRebase,
  abortRebase,
  skipRebase,
  getInteractiveRebaseState,
  parseFileConflicts,
} from "../../../lib/tauri";
import { useToast } from "../../../components/ui/Toast";
import { getErrorMessage } from "../../../lib/errors";
import { useMergeConflictStore } from "../../../stores/merge-conflict-store";
import { useUIStore, getDockviewApi } from "../../../stores/ui-store";
import { applyLayout } from "../../../lib/layouts";
import type { InteractiveRebaseState, RebaseStopReason } from "../types";

interface RebaseStopDialogProps {
  repoPath: string;
  state: InteractiveRebaseState;
  onClose: () => void;
  onComplete: () => void;
}

const STOP_TITLES: Record<RebaseStopReason, string> = {
  none: "",
  conflict: "Resolve Conflicts",
  edit: "Edit Mode",
  reword: "Edit Commit Message",
  squashMessage: "Edit Squash Message",
  other: "Rebase Paused",
};

const STOP_DESCRIPTIONS: Record<RebaseStopReason, string> = {
  none: "",
  conflict: "The rebase has conflicts that need to be resolved",
  edit: "Make any changes you need, stage them, then continue",
  reword: "Edit the commit message below, then continue",
  squashMessage: "Edit the combined commit message below, then continue",
  other: "The rebase is paused. Continue when ready.",
};

export function RebaseStopDialog({
  repoPath,
  state,
  onClose,
  onComplete,
}: RebaseStopDialogProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { enterConflictMode } = useMergeConflictStore();
  const { setShowMergeConflictPanel } = useUIStore();

  const [message, setMessage] = useState(state.currentMessage || "");
  const showMessageEditor =
    state.stopReason === "reword" || state.stopReason === "squashMessage";

  // Update message when state changes
  useEffect(() => {
    if (state.currentMessage) {
      setMessage(state.currentMessage);
    }
  }, [state.currentMessage]);

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["branches"] });
    queryClient.invalidateQueries({ queryKey: ["commits"] });
    queryClient.invalidateQueries({ queryKey: ["status"] });
    queryClient.invalidateQueries({ queryKey: ["rebase-status"] });
    queryClient.invalidateQueries({ queryKey: ["interactive-rebase-state"] });
    queryClient.invalidateQueries({ queryKey: ["graph-commits"] });
    queryClient.invalidateQueries({ queryKey: ["graphTableGraph"] });
  };

  const continueMutation = useMutation({
    mutationFn: async () => {
      const msgToSend = showMessageEditor ? message : undefined;
      return continueInteractiveRebase(repoPath, msgToSend);
    },
    onSuccess: async () => {
      // Check if there are more stops
      try {
        const newState = await getInteractiveRebaseState(repoPath);
        if (newState.inRebase) {
          if (newState.conflictingFiles.length > 0) {
            // More conflicts
            toast.warning("More conflicts", "The next commit has conflicts");
            const fileInfos = await Promise.all(
              newState.conflictingFiles.map((filePath) =>
                parseFileConflicts(repoPath, filePath),
              ),
            );
            enterConflictMode(fileInfos, newState.ontoRef, "rebase");
            setShowMergeConflictPanel(true);
            const api = getDockviewApi();
            if (api) {
              applyLayout(api, "merge-conflict");
            }
            onComplete();
          } else if (newState.stopReason !== "none") {
            // More edit/reword stops - will be handled by the new dialog
            toast.info(
              "Rebase in progress",
              `Stopped for ${newState.stopReason}`,
            );
          }
        } else {
          toast.success(
            "Rebase complete",
            "Interactive rebase finished successfully",
          );
          onComplete();
        }
      } catch {
        toast.success("Rebase continued", "Continuing interactive rebase");
        onComplete();
      }
      invalidateQueries();
    },
    onError: async (error: Error) => {
      const errorMsg = getErrorMessage(error);
      if (errorMsg.includes("conflict") || errorMsg.includes("CONFLICT")) {
        toast.warning("Rebase conflicts", "The next commit has conflicts");
        try {
          const newState = await getInteractiveRebaseState(repoPath);
          if (newState.conflictingFiles.length > 0) {
            const fileInfos = await Promise.all(
              newState.conflictingFiles.map((filePath) =>
                parseFileConflicts(repoPath, filePath),
              ),
            );
            enterConflictMode(fileInfos, newState.ontoRef, "rebase");
            setShowMergeConflictPanel(true);
            const api = getDockviewApi();
            if (api) {
              applyLayout(api, "merge-conflict");
            }
            onComplete();
          }
        } catch (e) {
          console.error("Failed to load conflict info:", e);
        }
        invalidateQueries();
      } else {
        toast.error("Continue failed", errorMsg);
      }
    },
  });

  const skipMutation = useMutation({
    mutationFn: () => skipRebase(repoPath),
    onSuccess: async () => {
      toast.success("Commit skipped", "Skipped to the next commit");
      // Check state after skip
      try {
        const newState = await getInteractiveRebaseState(repoPath);
        if (!newState.inRebase) {
          onComplete();
        } else if (newState.conflictingFiles.length > 0) {
          toast.warning("More conflicts", "The next commit has conflicts");
          const fileInfos = await Promise.all(
            newState.conflictingFiles.map((filePath) =>
              parseFileConflicts(repoPath, filePath),
            ),
          );
          enterConflictMode(fileInfos, newState.ontoRef, "rebase");
          setShowMergeConflictPanel(true);
          const api = getDockviewApi();
          if (api) {
            applyLayout(api, "merge-conflict");
          }
          onComplete();
        }
      } catch {
        // Continue without state check
      }
      invalidateQueries();
    },
    onError: (error: Error) => {
      toast.error("Skip failed", getErrorMessage(error));
    },
  });

  const abortMutation = useMutation({
    mutationFn: () => abortRebase(repoPath),
    onSuccess: () => {
      toast.success("Rebase aborted", "Returned to previous state");
      invalidateQueries();
      onComplete();
    },
    onError: (error: Error) => {
      toast.error("Abort failed", getErrorMessage(error));
    },
  });

  const isLoading =
    continueMutation.isPending ||
    skipMutation.isPending ||
    abortMutation.isPending;

  // Don't show for conflicts - those are handled by MergeConflictView
  if (state.stopReason === "conflict") {
    return null;
  }

  return (
    <Dialog.Root open={true} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[500px] max-w-[90vw] bg-bg-secondary rounded-lg shadow-xl border border-border-primary flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
            <Dialog.Title className="flex items-center gap-2 text-sm font-medium text-text-primary">
              {state.stopReason === "edit" ? (
                <GitCommit
                  size={16}
                  weight="bold"
                  className="text-accent-purple"
                />
              ) : (
                <PencilSimple
                  size={16}
                  weight="bold"
                  className="text-accent-blue"
                />
              )}
              {STOP_TITLES[state.stopReason]}
            </Dialog.Title>
            <Dialog.Close className="p-1 rounded-sm hover:bg-bg-hover transition-colors text-text-muted hover:text-text-primary">
              <X size={16} weight="bold" />
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Progress */}
            {state.currentStep && state.totalSteps && (
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span>
                  Step {state.currentStep} of {state.totalSteps}
                </span>
                <div className="flex-1 h-1 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-blue rounded-full transition-all"
                    style={{
                      width: `${(state.currentStep / state.totalSteps) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Description */}
            <div className="flex items-start gap-2 p-3 bg-bg-tertiary rounded text-sm">
              <Warning
                size={16}
                weight="bold"
                className="text-accent-amber shrink-0 mt-0.5"
              />
              <div>
                <p className="text-text-primary">
                  {STOP_DESCRIPTIONS[state.stopReason]}
                </p>
                {state.stoppedCommitId && (
                  <p className="text-text-muted mt-1">
                    Commit:{" "}
                    <code className="px-1 bg-bg-secondary rounded">
                      {state.stoppedCommitId.slice(0, 7)}
                    </code>
                  </p>
                )}
              </div>
            </div>

            {/* Message editor for reword/squash */}
            {showMessageEditor && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-muted">
                  Commit Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full h-32 px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-hidden resize-none font-mono"
                  placeholder="Enter commit message..."
                  autoFocus
                />
              </div>
            )}

            {/* Edit mode instructions */}
            {state.stopReason === "edit" && (
              <div className="text-xs text-text-muted space-y-1">
                <p>1. Make changes to the files as needed</p>
                <p>2. Stage your changes using the Staging panel</p>
                <p>3. Click "Continue" to commit and proceed with the rebase</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between px-4 py-3 bg-bg-tertiary border-t border-border-primary">
            <button
              type="button"
              onClick={() => abortMutation.mutate()}
              disabled={isLoading}
              className="flex items-center gap-1 px-3 py-2 text-sm text-accent-red hover:bg-accent-red/10 rounded transition-colors disabled:opacity-50"
            >
              <XCircle size={14} />
              Abort
            </button>
            <div className="flex items-center gap-2">
              {state.stopReason === "edit" && (
                <button
                  type="button"
                  onClick={() => skipMutation.mutate()}
                  disabled={isLoading}
                  className="flex items-center gap-1 px-3 py-2 text-sm bg-bg-secondary border border-border-primary rounded text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
                >
                  <FastForward size={14} />
                  Skip
                </button>
              )}
              <button
                type="button"
                onClick={() => continueMutation.mutate()}
                disabled={isLoading || (showMessageEditor && !message.trim())}
                className="flex items-center gap-1 px-4 py-2 text-sm bg-accent-blue text-white rounded hover:bg-accent-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowRight size={14} />
                {continueMutation.isPending ? "Continuing..." : "Continue"}
              </button>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
