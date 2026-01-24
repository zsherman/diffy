import { useState, useMemo } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, GitCommit, Warning } from "@phosphor-icons/react";
import { squashCommits } from "../../../lib/tauri";
import { useToast } from "../../../components/ui/Toast";
import { useUndoStore } from "../../../stores/undo-store";
import type { CommitInfo } from "../../../types/git";

interface SquashDialogProps {
  commits: CommitInfo[];
  repoPath: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function SquashDialog({
  commits,
  repoPath,
  onClose,
  onSuccess,
}: SquashDialogProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { pushUndo } = useUndoStore();

  // Sort commits from oldest to newest (based on time)
  const sortedCommits = useMemo(() => {
    return [...commits].sort((a, b) => a.time - b.time);
  }, [commits]);

  // Pre-fill message with combined commit messages
  const defaultMessage = useMemo(() => {
    return sortedCommits
      .map((c, i) => `${i === 0 ? "" : "\n"}${c.message}`)
      .join("")
      .trim();
  }, [sortedCommits]);

  const [message, setMessage] = useState(defaultMessage);

  // Check if this selection includes HEAD (most recent commits)
  // For now, we'll just check if they're contiguous - backend will validate
  const commitIds = useMemo(
    () => sortedCommits.map((c) => c.id),
    [sortedCommits],
  );

  const squashMutation = useMutation({
    mutationFn: async () => {
      return squashCommits(repoPath, commitIds, message);
    },
    onSuccess: (result) => {
      // Store undo info
      pushUndo({
        type: "squash",
        repoPath,
        previousHeadId: result.previousHeadId,
        description: `Squash ${commits.length} commits`,
        timestamp: Date.now(),
      });

      toast.success(
        "Commits squashed",
        `${commits.length} commits squashed into one`,
      );

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["commits", repoPath] });
      queryClient.invalidateQueries({ queryKey: ["status", repoPath] });

      onSuccess();
    },
    onError: (error: Error) => {
      toast.error("Failed to squash commits", error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && commits.length >= 2) {
      squashMutation.mutate();
    }
  };

  return (
    <Dialog.Root open={true} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[560px] max-w-[90vw] max-h-[80vh] bg-bg-secondary rounded-lg shadow-xl border border-border-primary flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
            <Dialog.Title className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <GitCommit size={16} weight="bold" />
              Squash {commits.length} Commits
            </Dialog.Title>
            <Dialog.Close className="p-1 rounded-sm hover:bg-bg-hover transition-colors text-text-muted hover:text-text-primary">
              <X size={16} weight="bold" />
            </Dialog.Close>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden"
          >
            {/* Warning notice */}
            <div className="flex items-start gap-2 p-3 bg-accent-amber/10 border border-accent-amber/30 rounded text-sm">
              <Warning
                size={16}
                weight="bold"
                className="text-accent-amber shrink-0 mt-0.5"
              />
              <div className="text-text-primary">
                <strong className="font-medium">Warning:</strong> Squashing
                rewrites history. If these commits have been pushed, you'll need
                to force push.
              </div>
            </div>

            {/* Commits being squashed */}
            <div>
              <label className="block text-sm text-text-primary mb-1.5">
                Commits to squash (oldest to newest)
              </label>
              <div className="max-h-32 overflow-y-auto bg-bg-tertiary border border-border-primary rounded p-2 space-y-1">
                {sortedCommits.map((commit, index) => (
                  <div
                    key={commit.id}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="font-mono text-text-muted">
                      {commit.shortId}
                    </span>
                    <span className="text-text-primary truncate flex-1">
                      {commit.summary}
                    </span>
                    {index === sortedCommits.length - 1 && (
                      <span className="text-accent-blue text-xs px-1.5 py-0.5 bg-accent-blue/10 rounded">
                        HEAD
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Commit message */}
            <div className="flex-1 flex flex-col min-h-0">
              <label className="block text-sm text-text-primary mb-1.5">
                Squashed commit message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter commit message..."
                autoFocus
                className="flex-1 min-h-[120px] px-3 py-2 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-hidden resize-none font-mono"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary hover:bg-bg-hover transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  !message.trim() ||
                  commits.length < 2 ||
                  squashMutation.isPending
                }
                className="px-4 py-2 text-sm bg-accent-blue text-white rounded hover:bg-accent-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {squashMutation.isPending ? "Squashing..." : "Squash Commits"}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
