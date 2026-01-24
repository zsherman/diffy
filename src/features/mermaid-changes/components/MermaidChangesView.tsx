import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Copy,
  Code,
  CaretDown,
  CaretRight,
  Check,
  CircleNotch,
  Sparkle,
  UsersThree,
  Stack,
  GitBranch,
  TreeStructure,
} from "@phosphor-icons/react";
import { MermaidRenderer } from "../../../components/ui/MermaidRenderer";
import { useTabsStore } from "../../../stores/tabs-store";
import { usePanelFontSize } from "../../../stores/ui-store";
import { getStatus, getCommitHistory } from "../../../lib/tauri";
import {
  generateDiagram,
  generateGitGraph,
  type DiagramType,
} from "./diagram-generators";
import { AIDiagramView } from "./AIDiagramView";

interface ViewOption {
  id: DiagramType | "ai";
  label: string;
  icon: React.ReactNode;
  description?: string;
}

const VIEW_OPTIONS: ViewOption[] = [
  {
    id: "c4-context",
    label: "Context",
    icon: <UsersThree size={14} weight="bold" />,
    description: "C4 System Context - big picture view",
  },
  {
    id: "c4-container",
    label: "Container",
    icon: <Stack size={14} weight="bold" />,
    description: "C4 Container - changed components",
  },
  {
    id: "gitgraph",
    label: "History",
    icon: <GitBranch size={14} weight="bold" />,
    description: "Git commit history graph",
  },
  {
    id: "ai",
    label: "AI",
    icon: <Sparkle size={14} weight="bold" />,
    description: "AI-generated sequence diagram",
  },
];

export function MermaidChangesView() {
  const { repository } = useTabsStore();
  const panelFontSize = usePanelFontSize();
  const [diagramType, setDiagramType] = useState<DiagramType | "ai">(
    "c4-container",
  );
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch status data
  const { data: status, isLoading: isLoadingStatus } = useQuery({
    queryKey: ["status", repository?.path],
    queryFn: () => getStatus(repository!.path),
    enabled:
      !!repository?.path && diagramType !== "gitgraph" && diagramType !== "ai",
    staleTime: 30000,
    refetchOnMount: true,
  });

  // Fetch commit history for gitgraph
  const { data: commits, isLoading: isLoadingCommits } = useQuery({
    queryKey: ["commits-for-graph", repository?.path],
    queryFn: () => getCommitHistory(repository!.path, undefined, 20),
    enabled: !!repository?.path && diagramType === "gitgraph",
    staleTime: 30000,
  });

  const isLoading =
    diagramType === "gitgraph" ? isLoadingCommits : isLoadingStatus;

  // Generate diagram source
  const diagramSource = useMemo(() => {
    if (diagramType === "ai") return ""; // AI diagrams handled separately
    if (diagramType === "gitgraph") {
      if (!commits) return "";
      return generateGitGraph(commits, repository?.headBranch ?? undefined);
    }
    if (!status) return "";
    return generateDiagram(status, diagramType);
  }, [status, commits, diagramType, repository?.headBranch]);

  // Count total changes
  const totalChanges = useMemo(() => {
    if (!status) return 0;
    return (
      status.staged.length + status.unstaged.length + status.untracked.length
    );
  }, [status]);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!diagramSource) return;
    try {
      await navigator.clipboard.writeText(diagramSource);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [diagramSource]);

  // If AI mode is selected, render the AI diagram view
  if (diagramType === "ai") {
    return (
      <div className="flex flex-col h-full bg-bg-secondary">
        {/* Header with controls - always show */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary bg-bg-tertiary">
          {/* View type selector */}
          <div className="flex items-center gap-1 bg-bg-secondary rounded-md p-0.5 border border-border-primary">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setDiagramType(option.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium transition-colors cursor-pointer ${
                  diagramType === option.id
                    ? option.id === "ai"
                      ? "bg-accent-purple text-white"
                      : "bg-accent-blue text-white"
                    : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
                }`}
                title={option.description}
              >
                {option.icon}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* AI Diagram content */}
        <div className="flex-1 overflow-hidden">
          <AIDiagramView />
        </div>
      </div>
    );
  }

  if (!repository) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        <p style={{ fontSize: `${panelFontSize}px` }}>No repository selected</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted gap-2">
        <CircleNotch size={16} className="animate-spin" />
        <span style={{ fontSize: `${panelFontSize}px` }}>
          Loading changes...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      {/* Header with controls */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary bg-bg-tertiary">
        {/* View type selector */}
        <div className="flex items-center gap-1 bg-bg-secondary rounded-md p-0.5 border border-border-primary">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => setDiagramType(option.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium transition-colors cursor-pointer ${
                diagramType === option.id
                  ? option.id === "ai"
                    ? "bg-accent-purple text-white"
                    : "bg-accent-blue text-white"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
              }`}
              title={option.description}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          ))}
        </div>

        {/* Stats and actions */}
        <div className="flex items-center gap-2">
          <span
            className="text-text-muted"
            style={{ fontSize: `${panelFontSize}px` }}
          >
            {totalChanges} file{totalChanges !== 1 ? "s" : ""}
          </span>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            disabled={!diagramSource}
            className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Copy Mermaid source"
          >
            {copied ? (
              <>
                <Check size={14} weight="bold" className="text-accent-green" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Toggle source button */}
          <button
            onClick={() => setShowSource(!showSource)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-sm transition-colors cursor-pointer"
            title={showSource ? "Hide source" : "Show source"}
          >
            <Code size={14} />
            {showSource ? (
              <CaretDown size={12} weight="bold" />
            ) : (
              <CaretRight size={12} weight="bold" />
            )}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* Source code panel (collapsible) */}
        {showSource && (
          <div className="border-b border-border-primary bg-bg-primary">
            <pre
              className="p-3 overflow-auto max-h-48 text-text-secondary font-mono"
              style={{ fontSize: `${Math.max(panelFontSize - 2, 10)}px` }}
            >
              {diagramSource || "// No changes to display"}
            </pre>
          </div>
        )}

        {/* Diagram container */}
        <div className="flex-1 overflow-hidden p-4 min-h-0">
          {totalChanges === 0 && diagramType !== "gitgraph" ? (
            <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2">
              <TreeStructure size={48} weight="thin" className="opacity-50" />
              <p style={{ fontSize: `${panelFontSize}px` }}>No local changes</p>
              <p
                className="text-text-muted"
                style={{ fontSize: `${Math.max(panelFontSize - 2, 10)}px` }}
              >
                Make some changes to see them visualized here
              </p>
            </div>
          ) : (
            <MermaidRenderer source={diagramSource} className="w-full h-full" />
          )}
        </div>
      </div>
    </div>
  );
}

export default MermaidChangesView;
