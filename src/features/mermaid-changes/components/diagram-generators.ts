import type { StatusInfo, FileStatus, CommitInfo } from "../../../types/git";

export type DiagramType =
  | "flowchart"
  | "mindmap"
  | "dependencies"
  | "c4-context"
  | "c4-container"
  | "gitgraph";

const MAX_FILES_PER_GROUP = 15;
const MAX_TOTAL_NODES = 50;

/**
 * Architecture layer definitions for dependency analysis
 */
interface ArchLayer {
  id: string;
  name: string;
  patterns: RegExp[];
  color: string;
}

const ARCH_LAYERS: ArchLayer[] = [
  { id: "types", name: "Types", patterns: [/\/types\//], color: "#9333ea" },
  {
    id: "lib",
    name: "Library",
    patterns: [/\/lib\//, /\/utils\//],
    color: "#3b82f6",
  },
  { id: "stores", name: "Stores", patterns: [/\/stores\//], color: "#f59e0b" },
  { id: "hooks", name: "Hooks", patterns: [/\/hooks\//], color: "#10b981" },
  {
    id: "components",
    name: "Components",
    patterns: [/\/components\//],
    color: "#06b6d4",
  },
  {
    id: "features",
    name: "Features",
    patterns: [/\/features\//],
    color: "#ec4899",
  },
  { id: "panels", name: "Panels", patterns: [/\/panels\//], color: "#8b5cf6" },
  {
    id: "config",
    name: "Config",
    patterns: [/\.config\.[jt]s/, /\.json$/],
    color: "#64748b",
  },
  {
    id: "styles",
    name: "Styles",
    patterns: [/\.css$/, /\.scss$/],
    color: "#f43f5e",
  },
  { id: "root", name: "Root", patterns: [/^[^/]+$/], color: "#71717a" },
];

/**
 * Dependency relationships between layers (from -> to)
 */
const LAYER_DEPENDENCIES: [string, string][] = [
  ["components", "stores"],
  ["components", "hooks"],
  ["components", "lib"],
  ["components", "types"],
  ["features", "stores"],
  ["features", "hooks"],
  ["features", "lib"],
  ["features", "components"],
  ["features", "types"],
  ["panels", "features"],
  ["panels", "components"],
  ["panels", "stores"],
  ["stores", "types"],
  ["stores", "lib"],
  ["hooks", "stores"],
  ["hooks", "lib"],
  ["hooks", "types"],
  ["lib", "types"],
];

/**
 * C4 Model container definitions for this codebase
 */
interface C4Container {
  id: string;
  name: string;
  description: string;
  technology: string;
  patterns: RegExp[];
}

const C4_CONTAINERS: C4Container[] = [
  {
    id: "ui_components",
    name: "UI Components",
    description: "Reusable UI elements",
    technology: "React, Tailwind",
    patterns: [/\/components\/ui\//],
  },
  {
    id: "layout",
    name: "Layout System",
    description: "Panel layout and navigation",
    technology: "Dockview, React",
    patterns: [/\/components\/layout\//, /\/panels\//],
  },
  {
    id: "features",
    name: "Feature Modules",
    description: "Domain-specific functionality",
    technology: "React, TanStack Query",
    patterns: [/\/features\//],
  },
  {
    id: "state",
    name: "State Management",
    description: "Application state",
    technology: "XState Store",
    patterns: [/\/stores\//],
  },
  {
    id: "hooks",
    name: "React Hooks",
    description: "Shared logic and side effects",
    technology: "React Hooks",
    patterns: [/\/hooks\//],
  },
  {
    id: "lib",
    name: "Core Library",
    description: "Utilities and Tauri bindings",
    technology: "TypeScript, Tauri",
    patterns: [/\/lib\//],
  },
  {
    id: "types",
    name: "Type Definitions",
    description: "Shared TypeScript types",
    technology: "TypeScript",
    patterns: [/\/types\//],
  },
  {
    id: "backend",
    name: "Tauri Backend",
    description: "Native desktop functionality",
    technology: "Rust, Tauri",
    patterns: [/src-tauri\//],
  },
  {
    id: "styles",
    name: "Styling",
    description: "CSS and themes",
    technology: "Tailwind CSS",
    patterns: [/\.css$/, /\.scss$/],
  },
  {
    id: "config",
    name: "Configuration",
    description: "Build and app config",
    technology: "Vite, TypeScript",
    patterns: [/\.config\.[jt]s/, /\.json$/, /^[^/]+\.[jt]s$/],
  },
];

/**
 * Escape special characters in Mermaid labels
 */
function escapeLabel(text: string): string {
  return text
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\(/g, "&#40;")
    .replace(/\)/g, "&#41;")
    .replace(/\[/g, "&#91;")
    .replace(/\]/g, "&#93;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");
}

/**
 * Create a safe node ID from a path
 */
function makeNodeId(prefix: string, path: string): string {
  return `${prefix}_${path.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

/**
 * Get status label and styling class
 */
function getStatusInfo(status: string): { label: string; styleClass: string } {
  switch (status) {
    case "A":
      return { label: "Added", styleClass: "added" };
    case "M":
      return { label: "Modified", styleClass: "modified" };
    case "D":
      return { label: "Deleted", styleClass: "deleted" };
    case "R":
      return { label: "Renamed", styleClass: "renamed" };
    case "?":
      return { label: "Untracked", styleClass: "untracked" };
    default:
      return { label: "Changed", styleClass: "changed" };
  }
}

/**
 * Get status icon for display
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case "A":
      return "+";
    case "M":
      return "~";
    case "D":
      return "-";
    case "R":
      return "→";
    case "?":
      return "?";
    default:
      return "•";
  }
}

/**
 * Group files by their parent directory
 */
function groupByDirectory(files: FileStatus[]): Map<string, FileStatus[]> {
  const groups = new Map<string, FileStatus[]>();

  for (const file of files) {
    const parts = file.path.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "(root)";

    if (!groups.has(dir)) {
      groups.set(dir, []);
    }
    groups.get(dir)!.push(file);
  }

  return groups;
}

/**
 * Get the filename from a path
 */
function getFilename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1];
}

/**
 * Truncate files list if too long, returning truncated list and overflow count
 */
function truncateFiles(
  files: FileStatus[],
  maxFiles: number,
): { files: FileStatus[]; overflow: number } {
  if (files.length <= maxFiles) {
    return { files, overflow: 0 };
  }
  return {
    files: files.slice(0, maxFiles),
    overflow: files.length - maxFiles,
  };
}

/**
 * Generate a Flowchart diagram from status info.
 * Groups files by status (Staged → Unstaged → Untracked), then by directory.
 */
export function generateFlowchart(status: StatusInfo): string {
  const lines: string[] = ["flowchart LR"];

  // Style definitions
  lines.push("  %% Style definitions");
  lines.push("  classDef staged fill:#00cab1,stroke:#00cab1,color:#000");
  lines.push("  classDef unstaged fill:#ffca00,stroke:#ffca00,color:#000");
  lines.push("  classDef untracked fill:#c635e4,stroke:#c635e4,color:#fff");
  lines.push("  classDef added fill:#00cab1,stroke:#00cab1,color:#000");
  lines.push("  classDef modified fill:#ffca00,stroke:#ffca00,color:#000");
  lines.push("  classDef deleted fill:#ff2e3f,stroke:#ff2e3f,color:#fff");
  lines.push("  classDef overflow fill:#84848A,stroke:#84848A,color:#fff");
  lines.push("");

  const allFiles = [...status.staged, ...status.unstaged, ...status.untracked];

  if (allFiles.length === 0) {
    lines.push('  empty["No local changes"]');
    return lines.join("\n");
  }

  // Count nodes to prevent huge diagrams
  let nodeCount = 0;
  const maxNodes = MAX_TOTAL_NODES;

  // Staged files subgraph
  if (status.staged.length > 0) {
    lines.push("  subgraph Staged[Staged Changes]");
    const { files: stagedFiles, overflow } = truncateFiles(
      status.staged,
      MAX_FILES_PER_GROUP,
    );

    for (const file of stagedFiles) {
      if (nodeCount >= maxNodes) break;
      const nodeId = makeNodeId("stg", file.path);
      const icon = getStatusIcon(file.status);
      const filename = escapeLabel(getFilename(file.path));
      lines.push(`    ${nodeId}["${icon} ${filename}"]`);
      lines.push(
        `    class ${nodeId} ${getStatusInfo(file.status).styleClass}`,
      );
      nodeCount++;
    }

    if (overflow > 0) {
      const overflowId = "stg_overflow";
      lines.push(`    ${overflowId}["+${overflow} more files"]`);
      lines.push(`    class ${overflowId} overflow`);
    }

    lines.push("  end");
    lines.push("");
  }

  // Unstaged files subgraph
  if (status.unstaged.length > 0 && nodeCount < maxNodes) {
    lines.push("  subgraph Unstaged[Unstaged Changes]");
    const { files: unstagedFiles, overflow } = truncateFiles(
      status.unstaged,
      MAX_FILES_PER_GROUP,
    );

    for (const file of unstagedFiles) {
      if (nodeCount >= maxNodes) break;
      const nodeId = makeNodeId("uns", file.path);
      const icon = getStatusIcon(file.status);
      const filename = escapeLabel(getFilename(file.path));
      lines.push(`    ${nodeId}["${icon} ${filename}"]`);
      lines.push(
        `    class ${nodeId} ${getStatusInfo(file.status).styleClass}`,
      );
      nodeCount++;
    }

    if (overflow > 0) {
      const overflowId = "uns_overflow";
      lines.push(`    ${overflowId}["+${overflow} more files"]`);
      lines.push(`    class ${overflowId} overflow`);
    }

    lines.push("  end");
    lines.push("");
  }

  // Untracked files subgraph
  if (status.untracked.length > 0 && nodeCount < maxNodes) {
    lines.push("  subgraph Untracked[Untracked Files]");
    const { files: untrackedFiles, overflow } = truncateFiles(
      status.untracked,
      MAX_FILES_PER_GROUP,
    );

    for (const file of untrackedFiles) {
      if (nodeCount >= maxNodes) break;
      const nodeId = makeNodeId("unt", file.path);
      const filename = escapeLabel(getFilename(file.path));
      lines.push(`    ${nodeId}["? ${filename}"]`);
      lines.push(`    class ${nodeId} untracked`);
      nodeCount++;
    }

    if (overflow > 0) {
      const overflowId = "unt_overflow";
      lines.push(`    ${overflowId}["+${overflow} more files"]`);
      lines.push(`    class ${overflowId} overflow`);
    }

    lines.push("  end");
    lines.push("");
  }

  // Add flow connections between groups
  if (status.staged.length > 0 && status.unstaged.length > 0) {
    lines.push("  Unstaged --> Staged");
  }
  if (status.untracked.length > 0 && status.unstaged.length > 0) {
    lines.push("  Untracked -.-> Unstaged");
  } else if (status.untracked.length > 0 && status.staged.length > 0) {
    lines.push("  Untracked -.-> Staged");
  }

  return lines.join("\n");
}

/**
 * Generate a Mindmap diagram from status info.
 * Shows: repo → categories → directories → files
 */
export function generateMindmap(status: StatusInfo): string {
  const lines: string[] = ["mindmap"];
  lines.push("  root((Local Changes))");

  const allFiles = [...status.staged, ...status.unstaged, ...status.untracked];

  if (allFiles.length === 0) {
    lines.push("    (No changes)");
    return lines.join("\n");
  }

  let nodeCount = 0;
  const maxNodes = MAX_TOTAL_NODES;

  // Staged section
  if (status.staged.length > 0) {
    lines.push(`    Staged`);
    const byDir = groupByDirectory(status.staged);

    for (const [dir, files] of byDir) {
      if (nodeCount >= maxNodes) break;

      const dirLabel = escapeLabel(dir);
      lines.push(`      ${dirLabel}`);

      const { files: truncatedFiles, overflow } = truncateFiles(
        files,
        Math.min(5, MAX_FILES_PER_GROUP),
      );

      for (const file of truncatedFiles) {
        if (nodeCount >= maxNodes) break;
        const icon = getStatusIcon(file.status);
        const filename = escapeLabel(getFilename(file.path));
        lines.push(`        ${icon} ${filename}`);
        nodeCount++;
      }

      if (overflow > 0) {
        lines.push(`        +${overflow} more`);
      }
    }
  }

  // Unstaged section
  if (status.unstaged.length > 0 && nodeCount < maxNodes) {
    lines.push(`    Unstaged`);
    const byDir = groupByDirectory(status.unstaged);

    for (const [dir, files] of byDir) {
      if (nodeCount >= maxNodes) break;

      const dirLabel = escapeLabel(dir);
      lines.push(`      ${dirLabel}`);

      const { files: truncatedFiles, overflow } = truncateFiles(
        files,
        Math.min(5, MAX_FILES_PER_GROUP),
      );

      for (const file of truncatedFiles) {
        if (nodeCount >= maxNodes) break;
        const icon = getStatusIcon(file.status);
        const filename = escapeLabel(getFilename(file.path));
        lines.push(`        ${icon} ${filename}`);
        nodeCount++;
      }

      if (overflow > 0) {
        lines.push(`        +${overflow} more`);
      }
    }
  }

  // Untracked section
  if (status.untracked.length > 0 && nodeCount < maxNodes) {
    lines.push(`    Untracked`);
    const byDir = groupByDirectory(status.untracked);

    for (const [dir, files] of byDir) {
      if (nodeCount >= maxNodes) break;

      const dirLabel = escapeLabel(dir);
      lines.push(`      ${dirLabel}`);

      const { files: truncatedFiles, overflow } = truncateFiles(
        files,
        Math.min(5, MAX_FILES_PER_GROUP),
      );

      for (const file of truncatedFiles) {
        if (nodeCount >= maxNodes) break;
        const filename = escapeLabel(getFilename(file.path));
        lines.push(`        ? ${filename}`);
        nodeCount++;
      }

      if (overflow > 0) {
        lines.push(`        +${overflow} more`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Determine which architecture layer a file belongs to
 */
function getFileLayer(path: string): ArchLayer | null {
  for (const layer of ARCH_LAYERS) {
    if (layer.patterns.some((pattern) => pattern.test(path))) {
      return layer;
    }
  }
  return ARCH_LAYERS.find((l) => l.id === "root") || null;
}

/**
 * Generate a dependency graph showing architecture layers and changed files.
 * Shows how changed files relate to each other through layer dependencies.
 */
export function generateDependencies(status: StatusInfo): string {
  const lines: string[] = ["flowchart TB"];

  // Collect all changed files
  const allFiles = [
    ...status.staged.map((f) => ({ ...f, category: "staged" as const })),
    ...status.unstaged.map((f) => ({ ...f, category: "unstaged" as const })),
    ...status.untracked.map((f) => ({ ...f, category: "untracked" as const })),
  ];

  if (allFiles.length === 0) {
    lines.push('  empty["No local changes"]');
    return lines.join("\n");
  }

  // Group files by layer
  const filesByLayer = new Map<string, typeof allFiles>();
  const activeLayers = new Set<string>();

  for (const file of allFiles) {
    const layer = getFileLayer(file.path);
    if (layer) {
      activeLayers.add(layer.id);
      if (!filesByLayer.has(layer.id)) {
        filesByLayer.set(layer.id, []);
      }
      filesByLayer.get(layer.id)!.push(file);
    }
  }

  // Style definitions
  lines.push("  %% Style definitions");
  for (const layer of ARCH_LAYERS) {
    if (activeLayers.has(layer.id)) {
      lines.push(
        `  classDef ${layer.id} fill:${layer.color},stroke:${layer.color},color:#fff`,
      );
    }
  }
  lines.push("  classDef staged stroke:#00cab1,stroke-width:3px");
  lines.push("  classDef unstaged stroke:#ffca00,stroke-width:3px");
  lines.push("  classDef untracked stroke:#c635e4,stroke-width:3px");
  lines.push("");

  // Create subgraphs for each active layer
  for (const layer of ARCH_LAYERS) {
    const files = filesByLayer.get(layer.id);
    if (!files || files.length === 0) continue;

    lines.push(`  subgraph ${layer.id}[${layer.name}]`);
    lines.push(`    direction LR`);

    const { files: truncatedFiles, overflow } = truncateFiles(files, 8);

    for (const file of truncatedFiles) {
      const nodeId = makeNodeId(layer.id, file.path);
      const filename = escapeLabel(getFilename(file.path));
      const icon = getStatusIcon(file.status);
      lines.push(`    ${nodeId}["${icon} ${filename}"]`);
      lines.push(`    class ${nodeId} ${layer.id}`);
      // Add status class for border color
      lines.push(`    class ${nodeId} ${file.category}`);
    }

    if (overflow > 0) {
      const overflowId = `${layer.id}_overflow`;
      lines.push(`    ${overflowId}(("+${overflow}"))`);
    }

    lines.push("  end");
    lines.push("");
  }

  // Add dependency arrows between layers (only for active layers)
  const addedConnections = new Set<string>();
  for (const [from, to] of LAYER_DEPENDENCIES) {
    if (activeLayers.has(from) && activeLayers.has(to)) {
      const connectionKey = `${from}->${to}`;
      if (!addedConnections.has(connectionKey)) {
        lines.push(`  ${from} --> ${to}`);
        addedConnections.add(connectionKey);
      }
    }
  }

  // Add legend
  lines.push("");
  lines.push("  subgraph legend[Legend]");
  lines.push("    direction LR");
  lines.push('    leg_staged["Staged"]:::staged');
  lines.push('    leg_unstaged["Unstaged"]:::unstaged');
  lines.push('    leg_untracked["Untracked"]:::untracked');
  lines.push("  end");

  return lines.join("\n");
}

/**
 * Get which C4 container a file belongs to
 */
function getFileContainer(path: string): C4Container | null {
  for (const container of C4_CONTAINERS) {
    if (container.patterns.some((pattern) => pattern.test(path))) {
      return container;
    }
  }
  return null;
}

/**
 * Generate a C4 System Context diagram.
 * Shows the application as a central system with users and external systems.
 */
export function generateC4Context(status: StatusInfo): string {
  const lines: string[] = ["C4Context"];
  lines.push("  title System Context - Local Changes Impact");
  lines.push("");

  // Collect all changed files
  const allFiles = [...status.staged, ...status.unstaged, ...status.untracked];

  if (allFiles.length === 0) {
    lines.push('  Person(user, "User", "No changes to show")');
    return lines.join("\n");
  }

  // Determine which major areas are affected
  const affectedAreas = new Set<string>();
  const hasBackend = allFiles.some((f) => f.path.includes("src-tauri"));
  const hasFrontend = allFiles.some(
    (f) => f.path.startsWith("src/") && !f.path.includes("src-tauri"),
  );
  const hasConfig = allFiles.some((f) =>
    f.path.match(/\.(json|config\.[jt]s)$/),
  );
  const hasStyles = allFiles.some((f) => f.path.match(/\.css$/));

  // Add user
  lines.push('  Person(user, "Developer", "Uses the Git client application")');
  lines.push("");

  // Add the main system boundary
  lines.push('  Enterprise_Boundary(app, "Diffy Application") {');

  if (hasFrontend) {
    const frontendFiles = allFiles.filter(
      (f) => f.path.startsWith("src/") && !f.path.includes("src-tauri"),
    ).length;
    lines.push(
      `    System(frontend, "Frontend", "${frontendFiles} files changed - React UI components and features")`,
    );
    affectedAreas.add("frontend");
  }

  if (hasBackend) {
    const backendFiles = allFiles.filter((f) =>
      f.path.includes("src-tauri"),
    ).length;
    lines.push(
      `    System(backend, "Backend", "${backendFiles} files changed - Rust/Tauri native functionality")`,
    );
    affectedAreas.add("backend");
  }

  if (hasConfig) {
    lines.push(
      '    System(config, "Configuration", "Build and app configuration")',
    );
    affectedAreas.add("config");
  }

  if (hasStyles) {
    lines.push('    System(styles, "Styling", "CSS and theme definitions")');
    affectedAreas.add("styles");
  }

  lines.push("  }");
  lines.push("");

  // External systems
  lines.push('  System_Ext(git, "Git", "Version control system")');
  lines.push('  System_Ext(ai, "AI Services", "Claude CLI, CodeRabbit")');
  lines.push('  System_Ext(fs, "File System", "Local repository files")');
  lines.push("");

  // Relationships
  lines.push('  Rel(user, frontend, "Interacts with")');
  if (affectedAreas.has("frontend") && affectedAreas.has("backend")) {
    lines.push('  Rel(frontend, backend, "Calls via IPC")');
  }
  if (affectedAreas.has("backend")) {
    lines.push('  Rel(backend, git, "Executes commands")');
    lines.push('  Rel(backend, ai, "Generates reviews/diagrams")');
    lines.push('  Rel(backend, fs, "Reads/writes files")');
  } else if (affectedAreas.has("frontend")) {
    lines.push('  Rel(frontend, git, "Via Tauri backend")');
  }

  return lines.join("\n");
}

/**
 * Generate a C4 Container diagram.
 * Shows the containers (deployable units) within the system.
 */
export function generateC4Container(status: StatusInfo): string {
  const lines: string[] = ["C4Container"];
  lines.push("  title Container Diagram - Changed Components");
  lines.push("");

  // Collect all changed files
  const allFiles = [
    ...status.staged.map((f) => ({ ...f, category: "staged" as const })),
    ...status.unstaged.map((f) => ({ ...f, category: "unstaged" as const })),
    ...status.untracked.map((f) => ({ ...f, category: "untracked" as const })),
  ];

  if (allFiles.length === 0) {
    lines.push('  Person(user, "User", "No changes")');
    return lines.join("\n");
  }

  // Group files by container
  const filesByContainer = new Map<string, typeof allFiles>();
  const activeContainers = new Set<string>();

  for (const file of allFiles) {
    const container = getFileContainer(file.path);
    if (container) {
      activeContainers.add(container.id);
      if (!filesByContainer.has(container.id)) {
        filesByContainer.set(container.id, []);
      }
      filesByContainer.get(container.id)!.push(file);
    }
  }

  // Add user
  lines.push('  Person(dev, "Developer", "Reviews and commits changes")');
  lines.push("");

  // System boundary
  lines.push('  Container_Boundary(diffy, "Diffy") {');

  // Add active containers
  for (const container of C4_CONTAINERS) {
    const files = filesByContainer.get(container.id);
    if (!files || files.length === 0) continue;

    const stagedCount = files.filter((f) => f.category === "staged").length;
    const unstagedCount = files.filter((f) => f.category === "unstaged").length;
    const untrackedCount = files.filter(
      (f) => f.category === "untracked",
    ).length;

    const parts: string[] = [];
    if (stagedCount > 0) parts.push(`${stagedCount} staged`);
    if (unstagedCount > 0) parts.push(`${unstagedCount} modified`);
    if (untrackedCount > 0) parts.push(`${untrackedCount} new`);

    const changeDesc = parts.join(", ");

    lines.push(
      `    Container(${container.id}, "${container.name}", "${container.technology}", "${changeDesc}")`,
    );
  }

  lines.push("  }");
  lines.push("");

  // External systems
  lines.push('  System_Ext(git, "Git Repository", "Version control")');
  lines.push('  System_Ext(claude, "Claude CLI", "AI assistance")');
  lines.push("");

  // Relationships between containers
  const containerRelationships: [string, string, string][] = [
    ["dev", "ui_components", "Uses"],
    ["dev", "layout", "Navigates"],
    ["layout", "features", "Contains"],
    ["features", "state", "Reads/Updates"],
    ["features", "hooks", "Uses"],
    ["features", "lib", "Calls"],
    ["state", "types", "Uses"],
    ["lib", "backend", "IPC calls"],
    ["backend", "git", "Executes"],
    ["backend", "claude", "Invokes"],
  ];

  for (const [from, to, label] of containerRelationships) {
    if (
      activeContainers.has(from) ||
      activeContainers.has(to) ||
      from === "dev"
    ) {
      if (
        (activeContainers.has(from) || from === "dev") &&
        (activeContainers.has(to) || to === "git" || to === "claude")
      ) {
        lines.push(`  Rel(${from}, ${to}, "${label}")`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Generate a Mermaid Git Graph from commit history.
 * Shows recent commits with branch/merge structure.
 */
export function generateGitGraph(
  commits: CommitInfo[],
  currentBranch?: string,
): string {
  if (commits.length === 0) {
    return `gitGraph
   commit id: "No commits"`;
  }

  const lines: string[] = ["gitGraph"];

  // Reverse to show oldest first (gitGraph builds from bottom up)
  const orderedCommits = [...commits].reverse();

  // Track branches we've created
  const createdBranches = new Set<string>(["main"]);

  // Detect merge commits and feature branches
  const mergeCommits = new Set<string>();
  const branchPoints = new Map<string, string>(); // commitId -> branch name

  for (const commit of orderedCommits) {
    if (commit.parentIds.length > 1) {
      mergeCommits.add(commit.id);
    }
  }

  // Simple heuristic: detect branches from commit messages
  for (const commit of orderedCommits) {
    // Check if this is a merge commit
    if (commit.parentIds.length > 1) {
      // Extract branch name from merge message if possible
      const mergeMatch = commit.summary
        .toLowerCase()
        .match(/merge (?:branch |pull request |pr )?['"]?([^'":\s]+)/i);
      if (mergeMatch) {
        const branchName = mergeMatch[1]
          .replace(/[^a-zA-Z0-9-_]/g, "-")
          .slice(0, 20);
        if (!createdBranches.has(branchName)) {
          branchPoints.set(commit.id, branchName);
        }
      }
    }
  }

  // Generate the graph
  for (let i = 0; i < orderedCommits.length && i < 20; i++) {
    const commit = orderedCommits[i];
    const shortId = commit.shortId;

    // Check if we need to create a branch before this commit
    if (branchPoints.has(commit.id)) {
      const branchName = branchPoints.get(commit.id)!;
      if (!createdBranches.has(branchName)) {
        // Find where to branch from (previous commit)
        if (i > 0) {
          lines.push(`   branch ${branchName}`);
          lines.push(`   checkout ${branchName}`);
          lines.push(`   commit id: "${shortId}" tag: "merged"`);
          createdBranches.add(branchName);
          lines.push(`   checkout main`);
          lines.push(`   merge ${branchName}`);
          continue;
        }
      }
    }

    // Check for merge commits
    if (mergeCommits.has(commit.id)) {
      const mergeMatch = commit.summary
        .toLowerCase()
        .match(/merge (?:branch |pull request |pr )?['"]?([^'":\s]+)/i);
      if (mergeMatch) {
        const branchName = mergeMatch[1]
          .replace(/[^a-zA-Z0-9-_]/g, "-")
          .slice(0, 15);
        if (!createdBranches.has(branchName)) {
          // Create the branch with a commit, then merge
          lines.push(`   branch ${branchName}`);
          lines.push(`   checkout ${branchName}`);
          lines.push(`   commit id: "${branchName}-work"`);
          createdBranches.add(branchName);
          lines.push(`   checkout main`);
          lines.push(`   merge ${branchName} id: "${shortId}"`);
          continue;
        }
      }
      // Generic merge
      lines.push(`   commit id: "${shortId}" type: HIGHLIGHT`);
    } else {
      // Regular commit
      lines.push(`   commit id: "${shortId}"`);
    }
  }

  // Add indicator for working changes if we're on a branch
  if (currentBranch) {
    lines.push(`   commit id: "HEAD" type: HIGHLIGHT tag: "${currentBranch}"`);
  }

  return lines.join("\n");
}

/**
 * Generate Mermaid diagram source based on type
 */
export function generateDiagram(status: StatusInfo, type: DiagramType): string {
  switch (type) {
    case "flowchart":
      return generateFlowchart(status);
    case "mindmap":
      return generateMindmap(status);
    case "dependencies":
      return generateDependencies(status);
    case "c4-context":
      return generateC4Context(status);
    case "c4-container":
      return generateC4Container(status);
    case "gitgraph":
      // gitgraph needs commits, not status - return placeholder
      return `gitGraph
   commit id: "Loading..."`;
    default:
      return generateFlowchart(status);
  }
}
