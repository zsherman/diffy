import type { Node, Edge } from "@xyflow/react";

/**
 * Line range for a code symbol (1-indexed, inclusive)
 */
export interface LineRange {
  start: number;
  end: number;
}

/**
 * Changed line ranges per file from diff
 */
export interface FileChangedRanges {
  filePath: string;
  changedRanges: LineRange[];
}

/**
 * A function or method extracted from the AST
 */
export interface FunctionSymbol {
  /** Unique ID: filePath:name:startLine */
  id: string;
  /** Function/method name */
  name: string;
  /** Full signature for display */
  signature: string;
  /** File path relative to repo root */
  filePath: string;
  /** Line range of the function body */
  range: LineRange;
  /** Whether this function was changed */
  isChanged: boolean;
  /** Kind of function (function, method, arrow, etc.) */
  kind: "function" | "method" | "arrow" | "class" | "external";
  /** Source code snippet (truncated) */
  snippet: string;
  /** Class name if this is a method */
  className?: string;
}

/**
 * A call site within a function
 */
export interface CallSite {
  /** Callee name */
  callee: string;
  /** Line number of the call */
  line: number;
  /** Column of the call */
  column: number;
  /** Whether callee was resolved to a known symbol */
  resolved: boolean;
  /** ID of the resolved target symbol (if any) */
  targetId?: string;
}

/**
 * Node data for the React Flow graph
 */
export interface CodeFlowNodeData {
  symbol: FunctionSymbol;
  calls: CallSite[];
  calledBy: string[]; // IDs of callers
}

/**
 * Edge data for React Flow
 */
export interface CodeFlowEdgeData {
  callSite?: CallSite;
  isExternal?: boolean;
}

/**
 * React Flow node type
 */
export type CodeFlowNode = Node<CodeFlowNodeData, "codeflow">;

/**
 * React Flow edge type
 */
export type CodeFlowEdge = Edge<CodeFlowEdgeData>;

/**
 * The complete call graph
 */
export interface CallGraph {
  nodes: CodeFlowNode[];
  edges: CodeFlowEdge[];
  /** Total functions found before filtering */
  totalFunctions: number;
  /** Whether the graph was capped */
  wasCapped: boolean;
}

/**
 * Graph building options
 */
export interface GraphBuildOptions {
  /** Maximum nodes to show */
  maxNodes: number;
  /** Maximum edges to show */
  maxEdges: number;
  /** Whether to include external reference nodes */
  showExternal: boolean;
  /** Maximum lines in snippet */
  maxSnippetLines: number;
}

export const DEFAULT_GRAPH_OPTIONS: GraphBuildOptions = {
  maxNodes: 80,
  maxEdges: 150,
  showExternal: true,
  maxSnippetLines: 20,
};
