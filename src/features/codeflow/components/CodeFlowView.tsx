import { useCallback, useMemo, useEffect, useState } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
} from "@xyflow/react";
import dagre from "dagre";
import {
  CircleNotch,
  TreeStructure,
  Warning,
  ArrowsOutCardinal,
  Eye,
  EyeSlash,
  Info,
} from "@phosphor-icons/react";
import { useTabsStore, useActiveTabSelection } from "../../../stores/tabs-store";
import { usePanelFontSize } from "../../../stores/ui-store";
import { useCodeFlowGraph } from "../hooks/useCodeFlowGraph";
import { CodeFlowNode } from "./CodeFlowNode";
import type { CodeFlowNode as CodeFlowNodeType, CodeFlowEdge } from "../types";

import "@xyflow/react/dist/style.css";

// Node types for React Flow
const nodeTypes = {
  codeflow: CodeFlowNode,
};

// Dagre layout configuration
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const NODE_WIDTH = 320;
const NODE_HEIGHT = 180;

function getLayoutedElements(
  nodes: CodeFlowNodeType[],
  edges: CodeFlowEdge[],
  direction = "LR",
): { nodes: CodeFlowNodeType[]; edges: CodeFlowEdge[] } {
  dagreGraph.setGraph({ rankdir: direction, nodesep: 80, ranksep: 120 });

  // Clear previous layout
  dagreGraph.nodes().forEach((n) => dagreGraph.removeNode(n));

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

function CodeFlowCanvas() {
  const { repository } = useTabsStore();
  const { selectedCommit, setSelectedFileWithLine } = useActiveTabSelection();
  const panelFontSize = usePanelFontSize();
  const { fitView } = useReactFlow();
  
  // Local state for toggle
  const [showExternal, setShowExternal] = useState(true);

  const { graph, isLoading, changedFilesCount, parseableFilesCount, error } =
    useCodeFlowGraph({
      repoPath: repository?.path,
      commitId: selectedCommit,
      options: { showExternal },
    });

  // Apply layout to nodes
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    if (graph.nodes.length === 0) {
      return { nodes: [], edges: [] };
    }
    return getLayoutedElements(graph.nodes, graph.edges, "LR");
  }, [graph.nodes, graph.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Update nodes/edges when graph changes
  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  // Fit view after layout
  useEffect(() => {
    if (nodes.length > 0) {
      // Small delay to ensure nodes are rendered
      const timer = setTimeout(() => fitView({ padding: 0.2 }), 100);
      return () => clearTimeout(timer);
    }
  }, [nodes.length, fitView]);

  // Handle node click - navigate to file and line
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const data = node.data as CodeFlowNodeType["data"];
      if (data.symbol.filePath && data.symbol.filePath !== "(external)") {
        // Navigate to file at the function's start line
        setSelectedFileWithLine(data.symbol.filePath, data.symbol.range.start);
      }
    },
    [setSelectedFileWithLine],
  );

  // Handle fit view button
  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2 });
  }, [fitView]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.key === "f" || e.key === "F") {
        handleFitView();
      }
      if (e.key === "e" || e.key === "E") {
        setShowExternal((prev) => !prev);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFitView]);

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
          Analyzing code flow...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted gap-3">
        <Warning size={48} weight="thin" className="opacity-50 text-accent-red" />
        <p style={{ fontSize: `${panelFontSize}px` }}>Error loading diffs</p>
        <p className="text-xs text-text-muted max-w-xs text-center">
          {error}
        </p>
      </div>
    );
  }

  if (changedFilesCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted gap-3">
        <TreeStructure size={48} weight="thin" className="opacity-50" />
        <p style={{ fontSize: `${panelFontSize}px` }}>No changes to analyze</p>
        <p className="text-xs text-text-muted">
          Make some changes to see the code flow graph
        </p>
      </div>
    );
  }

  if (parseableFilesCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted gap-3">
        <TreeStructure size={48} weight="thin" className="opacity-50" />
        <p style={{ fontSize: `${panelFontSize}px` }}>
          No TypeScript/JavaScript files changed
        </p>
        <p className="text-xs text-text-muted">
          Code flow currently supports .ts, .tsx, .js, .jsx files
        </p>
      </div>
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted gap-3">
        <TreeStructure size={48} weight="thin" className="opacity-50" />
        <p style={{ fontSize: `${panelFontSize}px` }}>No functions found</p>
        <p className="text-xs text-text-muted max-w-xs text-center">
          No functions or methods were detected in the changed code regions.
          Try making changes inside a function body.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary bg-bg-tertiary">
        <div className="flex items-center gap-2">
          <TreeStructure
            size={16}
            weight="bold"
            className="text-accent-blue"
          />
          <span className="text-sm font-medium text-text-primary">
            Code Flow
          </span>
          <span className="text-xs text-text-muted">
            {graph.nodes.length} nodes · {graph.edges.length} edges
          </span>
        </div>

        <div className="flex items-center gap-2">
          {graph.wasCapped && (
            <span
              className="flex items-center gap-1 text-xs text-accent-yellow cursor-help"
              title={`Graph limited to ${graph.nodes.length} nodes for performance. Try filtering to specific files.`}
            >
              <Warning size={12} weight="bold" />
              Capped
            </span>
          )}
          <button
            onClick={() => setShowExternal(!showExternal)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-sm transition-colors cursor-pointer ${
              showExternal
                ? "text-text-primary bg-bg-hover"
                : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
            }`}
            title={showExternal ? "Hide external references" : "Show external references"}
          >
            {showExternal ? <Eye size={14} /> : <EyeSlash size={14} />}
            <span>External</span>
          </button>
          <button
            onClick={handleFitView}
            className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-sm transition-colors cursor-pointer"
            title="Fit to view (keyboard: F)"
          >
            <ArrowsOutCardinal size={14} />
            <span>Fit</span>
          </button>
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 min-h-0 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{
            type: "smoothstep",
            style: { stroke: "var(--text-muted)", strokeWidth: 1.5 },
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Controls
            showInteractive={false}
            className="!bg-bg-secondary !border-border-primary !shadow-lg"
          />
          <MiniMap
            nodeColor={(node) => {
              const data = node.data as CodeFlowNodeType["data"];
              if (data.symbol.isChanged) return "var(--accent-blue)";
              if (data.symbol.kind === "external") return "var(--text-muted)";
              return "var(--bg-tertiary)";
            }}
            className="!bg-bg-secondary !border-border-primary"
            maskColor="rgba(0,0,0,0.2)"
          />
          <Background color="var(--border-primary)" gap={20} />
        </ReactFlow>
        
        {/* Help hint */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-[10px] text-text-muted/60">
          <Info size={12} />
          <span>Click node to view file • Scroll to zoom • Drag to pan • F to fit • E toggle external</span>
        </div>
      </div>
    </div>
  );
}

/**
 * CodeFlowView - Interactive call-flow graph visualization
 */
export function CodeFlowView() {
  return (
    <ReactFlowProvider>
      <CodeFlowCanvas />
    </ReactFlowProvider>
  );
}

export default CodeFlowView;
