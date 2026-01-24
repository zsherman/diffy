import { ContextMenu } from "@base-ui/react/context-menu";
import {
  Copy,
  File,
  Folder,
  Tray,
  ArrowLineUp,
  Trash,
} from "@phosphor-icons/react";
import { useToast } from "./Toast";

export interface FileContextMenuProps {
  /** Relative path from repo root (e.g. "src/App.tsx") */
  relativePath: string;
  /** Absolute path to the repository root */
  repoPath: string;
  /** For renames: previous relative path (optional) */
  previousPath?: string;
  /** Staging actions (only for Local Changes) */
  stagingActions?: {
    isStaged: boolean;
    onStage: () => void;
    onUnstage: () => void;
    onDiscard: () => void;
  };
  children: React.ReactNode;
}

/**
 * Computes file metadata from a relative path.
 */
function getFileInfo(relativePath: string, repoPath: string) {
  // Handle both Unix and Windows path separators
  const separator = repoPath.includes("\\") ? "\\" : "/";
  const absolutePath = repoPath + separator + relativePath;

  const parts = relativePath.split(/[/\\]/);
  const fileName = parts[parts.length - 1] || relativePath;
  const directoryPath = parts.slice(0, -1).join(separator) || ".";

  return { absolutePath, fileName, directoryPath };
}

export function FileContextMenu({
  relativePath,
  repoPath,
  previousPath,
  stagingActions,
  children,
}: FileContextMenuProps) {
  const toast = useToast();
  const { absolutePath, fileName, directoryPath } = getFileInfo(
    relativePath,
    repoPath,
  );

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
            {/* Copy actions */}
            <ContextMenu.Item
              className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-text-primary data-highlighted:bg-bg-hover outline-hidden mx-1 rounded-sm text-[13px]"
              onClick={() => copyToClipboard(relativePath, "Relative path")}
            >
              <Copy size={14} className="text-text-muted" />
              Copy relative path
            </ContextMenu.Item>

            <ContextMenu.Item
              className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-text-primary data-highlighted:bg-bg-hover outline-hidden mx-1 rounded-sm text-[13px]"
              onClick={() => copyToClipboard(absolutePath, "Absolute path")}
            >
              <Copy size={14} className="text-text-muted" />
              Copy absolute path
            </ContextMenu.Item>

            <ContextMenu.Item
              className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-text-primary data-highlighted:bg-bg-hover outline-hidden mx-1 rounded-sm text-[13px]"
              onClick={() => copyToClipboard(fileName, "File name")}
            >
              <File size={14} className="text-text-muted" />
              Copy file name
            </ContextMenu.Item>

            <ContextMenu.Item
              className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-text-primary data-highlighted:bg-bg-hover outline-hidden mx-1 rounded-sm text-[13px]"
              onClick={() => copyToClipboard(directoryPath, "Directory path")}
            >
              <Folder size={14} className="text-text-muted" />
              Copy directory path
            </ContextMenu.Item>

            {/* Previous path for renames */}
            {previousPath && previousPath !== relativePath && (
              <>
                <ContextMenu.Separator className="h-px bg-border-primary mx-2 my-1" />
                <ContextMenu.Item
                  className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-text-primary data-highlighted:bg-bg-hover outline-hidden mx-1 rounded-sm text-[13px]"
                  onClick={() =>
                    copyToClipboard(previousPath, "Previous path")
                  }
                >
                  <Copy size={14} className="text-text-muted" />
                  Copy previous path
                </ContextMenu.Item>
              </>
            )}

            {/* Staging actions (Local Changes only) */}
            {stagingActions && (
              <>
                <ContextMenu.Separator className="h-px bg-border-primary mx-2 my-1" />

                {stagingActions.isStaged ? (
                  <ContextMenu.Item
                    className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-text-primary data-highlighted:bg-bg-hover outline-hidden mx-1 rounded-sm text-[13px]"
                    onClick={stagingActions.onUnstage}
                  >
                    <ArrowLineUp size={14} className="text-text-muted" />
                    Unstage
                  </ContextMenu.Item>
                ) : (
                  <ContextMenu.Item
                    className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-text-primary data-highlighted:bg-bg-hover outline-hidden mx-1 rounded-sm text-[13px]"
                    onClick={stagingActions.onStage}
                  >
                    <Tray size={14} className="text-text-muted" />
                    Stage
                  </ContextMenu.Item>
                )}

                <ContextMenu.Item
                  className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-accent-red data-highlighted:bg-bg-hover outline-hidden mx-1 rounded-sm text-[13px]"
                  onClick={stagingActions.onDiscard}
                >
                  <Trash size={14} />
                  Discard changes
                </ContextMenu.Item>
              </>
            )}
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
