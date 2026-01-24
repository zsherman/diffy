import type { FileStatus, DiffFile } from "../types/git";

/**
 * Represents a file node in the tree with its status and optional diff stats
 */
export interface FileTreeNode {
  type: "file";
  name: string;
  path: string;
  status: string;
  /** Section the file belongs to (for working dir) */
  section?: "staged" | "unstaged" | "untracked";
  /** Number of lines added (from DiffFile) */
  additions?: number;
  /** Number of lines deleted (from DiffFile) */
  deletions?: number;
  /** Old path for renames */
  oldPath?: string | null;
}

/**
 * Represents a folder node in the tree containing children
 */
export interface FolderTreeNode {
  type: "folder";
  name: string;
  path: string;
  children: TreeNode[];
}

export type TreeNode = FileTreeNode | FolderTreeNode;

/**
 * Normalizes a FileStatus or DiffFile into a common format for tree building
 */
interface NormalizedFile {
  path: string;
  status: string;
  section?: "staged" | "unstaged" | "untracked";
  additions?: number;
  deletions?: number;
  oldPath?: string | null;
}

function normalizeFileStatus(
  file: FileStatus,
  section: "staged" | "unstaged" | "untracked"
): NormalizedFile {
  return {
    path: file.path,
    status: file.status,
    section,
  };
}

function normalizeDiffFile(file: DiffFile): NormalizedFile {
  return {
    path: file.path,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    oldPath: file.oldPath,
  };
}

/**
 * Builds a hierarchical tree from a flat list of file paths
 */
export function buildFileTree(files: NormalizedFile[]): TreeNode[] {
  // Use a nested map structure for easy lookup during building
  // Each folder stores its children in a Map for O(1) lookup
  interface FolderData {
    node: FolderTreeNode;
    childrenMap: Map<string, TreeNode | FolderData>;
  }

  const root = new Map<string, TreeNode | FolderData>();

  // Helper to get or create a folder at a given path
  function getOrCreateFolder(
    parentMap: Map<string, TreeNode | FolderData>,
    name: string,
    path: string
  ): FolderData {
    let existing = parentMap.get(name);
    if (existing && "node" in existing) {
      return existing as FolderData;
    }
    const folderData: FolderData = {
      node: {
        type: "folder",
        name,
        path,
        children: [],
      },
      childrenMap: new Map(),
    };
    parentMap.set(name, folderData);
    return folderData;
  }

  // Process each file
  for (const file of files) {
    const parts = file.path.split("/");
    const fileName = parts[parts.length - 1];
    const dirParts = parts.slice(0, -1);

    // Navigate to the correct folder, creating folders as needed
    let currentMap = root;
    let currentPath = "";

    for (const folderName of dirParts) {
      currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;
      const folderData = getOrCreateFolder(currentMap, folderName, currentPath);
      currentMap = folderData.childrenMap;
    }

    // Add the file to the current folder (or root)
    const fileNode: FileTreeNode = {
      type: "file",
      name: fileName,
      path: file.path,
      status: file.status,
      section: file.section,
      additions: file.additions,
      deletions: file.deletions,
      oldPath: file.oldPath,
    };
    currentMap.set(fileName, fileNode);
  }

  // Convert the nested map structure to the final tree
  function convertToTree(map: Map<string, TreeNode | FolderData>): TreeNode[] {
    const nodes: TreeNode[] = [];
    for (const value of map.values()) {
      if ("node" in value) {
        // It's a FolderData
        const folderData = value as FolderData;
        folderData.node.children = convertToTree(folderData.childrenMap);
        nodes.push(folderData.node);
      } else {
        // It's a file node
        nodes.push(value as TreeNode);
      }
    }
    return nodes;
  }

  // Sort the tree: folders first, then files, both alphabetically
  function sortTree(nodes: TreeNode[]): TreeNode[] {
    return nodes
      .sort((a, b) => {
        // Folders before files
        if (a.type !== b.type) {
          return a.type === "folder" ? -1 : 1;
        }
        // Alphabetical within same type
        return a.name.localeCompare(b.name);
      })
      .map((node) => {
        if (node.type === "folder") {
          return {
            ...node,
            children: sortTree(node.children),
          };
        }
        return node;
      });
  }

  return sortTree(convertToTree(root));
}

/**
 * Converts working directory status (staged/unstaged/untracked) into a tree
 */
export function buildTreeFromStatus(
  staged: FileStatus[],
  unstaged: FileStatus[],
  untracked: FileStatus[]
): TreeNode[] {
  const normalizedFiles: NormalizedFile[] = [
    ...staged.map((f) => normalizeFileStatus(f, "staged")),
    ...unstaged.map((f) => normalizeFileStatus(f, "unstaged")),
    ...untracked.map((f) => normalizeFileStatus(f, "untracked")),
  ];

  return buildFileTree(normalizedFiles);
}

/**
 * Converts commit diff files into a tree
 */
export function buildTreeFromDiffFiles(files: DiffFile[]): TreeNode[] {
  const normalizedFiles = files.map(normalizeDiffFile);
  return buildFileTree(normalizedFiles);
}

/**
 * Gets all folder paths from a tree (useful for default expansion)
 */
export function getAllFolderPaths(nodes: TreeNode[]): string[] {
  const paths: string[] = [];

  function traverse(nodeList: TreeNode[]) {
    for (const node of nodeList) {
      if (node.type === "folder") {
        paths.push(node.path);
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return paths;
}

/**
 * Counts total files in the tree
 */
export function countFiles(nodes: TreeNode[]): number {
  let count = 0;

  function traverse(nodeList: TreeNode[]) {
    for (const node of nodeList) {
      if (node.type === "file") {
        count++;
      } else {
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return count;
}
