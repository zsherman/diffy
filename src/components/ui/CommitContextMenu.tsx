import { ContextMenu } from "@base-ui/react/context-menu";
import {
  Copy,
  GitCommit,
  GitBranch,
  ArrowCounterClockwise,
  Warning,
} from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "./Toast";
import {
  checkoutCommit,
  cherryPick,
  resetHard,
  normalizeError,
  getErrorMessage,
} from "../../lib/tauri";

export interface CommitContextMenuProps {
  /** Full commit hash */
  commitId: string;
  /** Short commit hash */
  shortId: string;
  /** Commit message (full or summary) */
  message: string;
  /** Repository path */
  repoPath: string;
  children: React.ReactNode;
}

export function CommitContextMenu({
  commitId,
  shortId,
  message,
  repoPath,
  children,
}: CommitContextMenuProps) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied", `${label} copied to clipboard`);
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error("Copy failed", "Could not copy to clipboard");
    }
  };

  // Invalidate relevant queries after git operations
  const invalidateAfterGitOp = () => {
    queryClient.invalidateQueries({ queryKey: ["commits", repoPath] });
    queryClient.invalidateQueries({ queryKey: ["graph", repoPath] });
    queryClient.invalidateQueries({ queryKey: ["commitListGraph", repoPath] });
    queryClient.invalidateQueries({ queryKey: ["status", repoPath] });
    queryClient.invalidateQueries({ queryKey: ["branches", repoPath] });
    queryClient.invalidateQueries({
      queryKey: ["working-diff-staged", repoPath],
    });
    queryClient.invalidateQueries({
      queryKey: ["working-diff-unstaged", repoPath],
    });
  };

  const checkoutMutation = useMutation({
    mutationFn: () => checkoutCommit(repoPath, commitId),
    onSuccess: () => {
      invalidateAfterGitOp();
      toast.success("Checked out", `Checked out commit ${shortId}`);
    },
    onError: (error) => {
      toast.error("Checkout failed", getErrorMessage(normalizeError(error)));
    },
  });

  const cherryPickMutation = useMutation({
    mutationFn: () => cherryPick(repoPath, commitId),
    onSuccess: () => {
      invalidateAfterGitOp();
      toast.success("Cherry-picked", `Cherry-picked commit ${shortId}`);
    },
    onError: (error) => {
      toast.error("Cherry-pick failed", getErrorMessage(normalizeError(error)));
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetHard(repoPath, commitId),
    onSuccess: () => {
      invalidateAfterGitOp();
      toast.success("Reset complete", `Reset to commit ${shortId}`);
    },
    onError: (error) => {
      toast.error("Reset failed", getErrorMessage(normalizeError(error)));
    },
  });

  const handleResetHard = () => {
    if (
      confirm(
        `Reset to ${shortId}? This will discard all uncommitted changes and cannot be undone.`,
      )
    ) {
      resetMutation.mutate();
    }
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger render={children as React.ReactElement} />
      <ContextMenu.Portal>
        <ContextMenu.Positioner className="z-50">
          <ContextMenu.Popup className="min-w-[200px] overflow-hidden rounded-lg border border-border-primary bg-bg-secondary shadow-xl outline-none py-1">
            {/* Copy actions */}
            <ContextMenu.Item
              className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-text-primary data-[highlighted]:bg-bg-hover outline-none mx-1 rounded text-[13px]"
              onClick={() => copyToClipboard(commitId, "Commit hash")}
            >
              <Copy size={14} className="text-text-muted" />
              Copy commit hash
            </ContextMenu.Item>

            <ContextMenu.Item
              className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-text-primary data-[highlighted]:bg-bg-hover outline-none mx-1 rounded text-[13px]"
              onClick={() => copyToClipboard(message, "Commit message")}
            >
              <Copy size={14} className="text-text-muted" />
              Copy commit message
            </ContextMenu.Item>

            <ContextMenu.Separator className="h-px bg-border-primary mx-2 my-1" />

            {/* Git actions */}
            <ContextMenu.Item
              className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-text-primary data-[highlighted]:bg-bg-hover outline-none mx-1 rounded text-[13px]"
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
            >
              <GitBranch size={14} className="text-text-muted" />
              Checkout commit
            </ContextMenu.Item>

            <ContextMenu.Item
              className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-text-primary data-[highlighted]:bg-bg-hover outline-none mx-1 rounded text-[13px]"
              onClick={() => cherryPickMutation.mutate()}
              disabled={cherryPickMutation.isPending}
            >
              <GitCommit size={14} className="text-text-muted" />
              Cherry-pick commit
            </ContextMenu.Item>

            <ContextMenu.Separator className="h-px bg-border-primary mx-2 my-1" />

            <ContextMenu.Item
              className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-accent-red data-[highlighted]:bg-bg-hover outline-none mx-1 rounded text-[13px]"
              onClick={handleResetHard}
              disabled={resetMutation.isPending}
            >
              <ArrowCounterClockwise size={14} />
              Reset to commit (hard)
              <Warning size={12} className="ml-auto opacity-60" />
            </ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
