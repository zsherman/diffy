import { ContextMenu } from "@base-ui/react/context-menu";
import {
  Copy,
  FolderOpen,
  Lock,
  LockOpen,
  Trash,
  GitBranch,
} from "@phosphor-icons/react";
import { useToast } from "./Toast";
import type { WorktreeInfo } from "../../types/git";

export interface WorktreeContextMenuProps {
  /** The worktree to show actions for */
  worktree: WorktreeInfo;
  /** Called when user clicks "Open worktree" */
  onOpen: () => void;
  /** Called when user clicks "Lock" or "Unlock" */
  onToggleLock: () => void;
  /** Called when user clicks "Remove" */
  onRemove: () => void;
  children: React.ReactNode;
}

export function WorktreeContextMenu({
  worktree,
  onOpen,
  onToggleLock,
  onRemove,
  children,
}: WorktreeContextMenuProps) {
  const toast = useToast();

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied", `${label} copied to clipboard`);
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error("Copy failed", "Could not copy to clipboard");
    }
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger render={children as React.ReactElement} />
      <ContextMenu.Portal>
        <ContextMenu.Positioner className="z-50">
          <ContextMenu.Popup className="min-w-[200px] overflow-hidden rounded-lg border border-border-primary bg-bg-secondary shadow-xl outline-hidden py-1">
            {/* Open action */}
            <ContextMenu.Item
              className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-text-primary data-highlighted:bg-bg-hover outline-hidden mx-1 rounded-sm text-[13px]"
              onClick={onOpen}
            >
              <FolderOpen size={14} className="text-text-muted" />
              Open worktree
            </ContextMenu.Item>

            <ContextMenu.Separator className="h-px bg-border-primary mx-2 my-1" />

            {/* Copy actions */}
            <ContextMenu.Item
              className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-text-primary data-highlighted:bg-bg-hover outline-hidden mx-1 rounded-sm text-[13px]"
              onClick={() => copyToClipboard(worktree.name, "Worktree name")}
            >
              <Copy size={14} className="text-text-muted" />
              Copy name
            </ContextMenu.Item>

            <ContextMenu.Item
              className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-text-primary data-highlighted:bg-bg-hover outline-hidden mx-1 rounded-sm text-[13px]"
              onClick={() => copyToClipboard(worktree.path, "Worktree path")}
            >
              <Copy size={14} className="text-text-muted" />
              Copy path
            </ContextMenu.Item>

            {worktree.headBranch && (
              <ContextMenu.Item
                className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-text-primary data-highlighted:bg-bg-hover outline-hidden mx-1 rounded-sm text-[13px]"
                onClick={() =>
                  copyToClipboard(worktree.headBranch!, "Branch name")
                }
              >
                <GitBranch size={14} className="text-text-muted" />
                Copy branch name
              </ContextMenu.Item>
            )}

            {/* Lock/Unlock (not available for main worktree) */}
            {!worktree.isMain && (
              <>
                <ContextMenu.Separator className="h-px bg-border-primary mx-2 my-1" />

                <ContextMenu.Item
                  className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-text-primary data-highlighted:bg-bg-hover outline-hidden mx-1 rounded-sm text-[13px]"
                  onClick={onToggleLock}
                >
                  {worktree.isLocked ? (
                    <>
                      <LockOpen size={14} className="text-text-muted" />
                      Unlock worktree
                    </>
                  ) : (
                    <>
                      <Lock size={14} className="text-text-muted" />
                      Lock worktree
                    </>
                  )}
                </ContextMenu.Item>
              </>
            )}

            {/* Remove (not available for main worktree) */}
            {!worktree.isMain && (
              <>
                <ContextMenu.Separator className="h-px bg-border-primary mx-2 my-1" />

                <ContextMenu.Item
                  className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-accent-red data-highlighted:bg-bg-hover outline-hidden mx-1 rounded-sm text-[13px]"
                  onClick={onRemove}
                >
                  <Trash size={14} />
                  Remove worktree
                </ContextMenu.Item>
              </>
            )}
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
