import { useMemo, useCallback, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileTree,
  FileTreeFolder,
  FileTreeFile,
  FileTreeIcon,
  FileTreeName,
  FileTreeActions,
} from "@/components/ai-elements/file-tree";
import { getStatus, getCommitDiff } from "../../../lib/tauri";
import {
  StatusIcon,
  getStatusColor,
  SkeletonList,
} from "../../../components/ui";
import {
  useTabsStore,
  useActiveTabState,
  useActiveTabPanels,
} from "../../../stores/tabs-store";
import { usePanelFontSize } from "../../../stores/ui-store";
import {
  buildTreeFromStatus,
  buildTreeFromDiffFiles,
  getAllFolderPaths,
  type TreeNode,
  type FileTreeNode,
} from "../../../lib/file-tree";
import type { CommitInfo } from "../../../types/git";

interface FileTreeViewProps {
  className?: string;
}

/**
 * Renders a recursive file tree with git status indicators
 */
function TreeNodeRenderer({
  node,
  expandedPaths,
}: {
  node: TreeNode;
  expandedPaths: Set<string>;
}) {
  if (node.type === "folder") {
    return (
      <FileTreeFolder path={node.path} name={node.name}>
        {node.children.map((child) => (
          <TreeNodeRenderer
            key={child.path}
            node={child}
            expandedPaths={expandedPaths}
          />
        ))}
      </FileTreeFolder>
    );
  }

  // File node
  const fileNode = node as FileTreeNode;
  const statusColor = getStatusColor(fileNode.status);

  return (
    <FileTreeFile
      path={fileNode.path}
      name={fileNode.name}
      className="group"
    >
      <span className="size-4" /> {/* Spacer for alignment with folders */}
      <FileTreeIcon>
        <StatusIcon status={fileNode.status} size={14} />
      </FileTreeIcon>
      <FileTreeName className={statusColor}>{fileNode.name}</FileTreeName>
      <FileTreeActions>
        {fileNode.additions !== undefined && fileNode.additions > 0 && (
          <span className="text-xs text-accent-green">+{fileNode.additions}</span>
        )}
        {fileNode.deletions !== undefined && fileNode.deletions > 0 && (
          <span className="text-xs text-accent-red">-{fileNode.deletions}</span>
        )}
        {fileNode.section && (
          <span className="text-xs text-text-muted opacity-0 group-hover:opacity-100">
            {fileNode.section === "staged"
              ? "S"
              : fileNode.section === "unstaged"
                ? "U"
                : "?"}
          </span>
        )}
      </FileTreeActions>
    </FileTreeFile>
  );
}

export function FileTreeView({ className }: FileTreeViewProps) {
  const { repository } = useTabsStore();
  const { selectedCommit, selectedFile, setSelectedFile, selectedBranch } =
    useActiveTabState();
  const { setShowDiffPanel } = useActiveTabPanels();
  const panelFontSize = usePanelFontSize();
  const queryClient = useQueryClient();

  // Get commit info from cache for display
  const commitInfo = useMemo(() => {
    if (!selectedCommit || !repository?.path) return null;
    const commits = queryClient.getQueryData<CommitInfo[]>([
      "commits",
      repository.path,
      selectedBranch,
    ]);
    return commits?.find((c) => c.id === selectedCommit) ?? null;
  }, [selectedCommit, repository?.path, selectedBranch, queryClient]);

  // Fetch working directory status
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["status", repository?.path],
    queryFn: () => getStatus(repository!.path),
    enabled: !!repository?.path && !selectedCommit,
    staleTime: 30000,
    refetchOnMount: false,
  });

  // Fetch commit files when a commit is selected
  const { data: commitFiles, isLoading: commitLoading } = useQuery({
    queryKey: ["commit-files", repository?.path, selectedCommit],
    queryFn: async () => {
      const diff = await getCommitDiff(repository!.path, selectedCommit!);
      return diff.files;
    },
    enabled: !!repository?.path && !!selectedCommit,
    staleTime: 60000,
  });

  // Build tree from data
  const tree = useMemo<TreeNode[]>(() => {
    if (selectedCommit && commitFiles) {
      return buildTreeFromDiffFiles(commitFiles);
    }
    if (status) {
      return buildTreeFromStatus(
        status.staged,
        status.unstaged,
        status.untracked
      );
    }
    return [];
  }, [selectedCommit, commitFiles, status]);

  // Controlled expanded state - start with all folders expanded
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // Update expanded paths when tree changes (e.g., data loads)
  useEffect(() => {
    const allFolders = getAllFolderPaths(tree);
    if (allFolders.length > 0) {
      setExpandedPaths((prev) => {
        // Merge new folders into existing expanded paths
        const merged = new Set(prev);
        for (const path of allFolders) {
          merged.add(path);
        }
        return merged;
      });
    }
  }, [tree]);

  // Handle file selection
  const handleSelect = useCallback(
    (path: string) => {
      // Check if path is a file (not a folder)
      const findNode = (nodes: TreeNode[], targetPath: string): TreeNode | null => {
        for (const node of nodes) {
          if (node.path === targetPath) return node;
          if (node.type === "folder") {
            const found = findNode(node.children, targetPath);
            if (found) return found;
          }
        }
        return null;
      };

      const node = findNode(tree, path);
      if (node && node.type === "file") {
        setSelectedFile(path);
        setShowDiffPanel(true);
      }
    },
    [tree, setSelectedFile, setShowDiffPanel]
  );

  const isLoading = statusLoading || commitLoading;

  if (isLoading && tree.length === 0) {
    return (
      <div className="flex flex-col h-full p-2">
        <SkeletonList rows={8} />
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        No changes
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full overflow-auto ${className ?? ""}`}>
      {/* Commit header when viewing a commit */}
      {commitInfo && (
        <div className="px-3 py-2 border-b border-border-primary bg-bg-tertiary shrink-0">
          <div
            className="text-text-primary font-medium mb-1 truncate"
            style={{ fontSize: `${panelFontSize}px` }}
          >
            {commitInfo.summary}
          </div>
          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span className="font-mono text-accent-blue">{commitInfo.shortId}</span>
            <span>{commitInfo.authorName}</span>
          </div>
        </div>
      )}

      {/* File tree */}
      <div className="flex-1 overflow-auto p-2">
        <FileTree
          expanded={expandedPaths}
          onExpandedChange={setExpandedPaths}
          selectedPath={selectedFile ?? undefined}
          onSelect={handleSelect}
          className="border-none bg-transparent"
        >
          {tree.map((node) => (
            <TreeNodeRenderer
              key={node.path}
              node={node}
              expandedPaths={expandedPaths}
            />
          ))}
        </FileTree>
      </div>
    </div>
  );
}
