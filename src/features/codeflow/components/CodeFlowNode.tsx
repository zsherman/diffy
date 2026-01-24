import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CaretDown, CaretRight, Function, Cube, Lightning } from "@phosphor-icons/react";
import type { CodeFlowNodeData } from "../types";

const kindIcons = {
  function: Function,
  method: Cube,
  arrow: Lightning,
  class: Cube,
  external: Function,
};

export const CodeFlowNode = memo(function CodeFlowNode({
  data,
  selected,
}: NodeProps<CodeFlowNodeData>) {
  const [expanded, setExpanded] = useState(false);
  const { symbol } = data;
  const Icon = kindIcons[symbol.kind] || Function;
  
  const maxCollapsedLines = 6;
  const snippetLines = symbol.snippet.split("\n");
  const shouldTruncate = snippetLines.length > maxCollapsedLines;
  const displaySnippet = expanded || !shouldTruncate
    ? symbol.snippet
    : snippetLines.slice(0, maxCollapsedLines).join("\n") + "\n...";
  
  return (
    <div
      className={`
        rounded-lg border shadow-lg overflow-hidden min-w-[280px] max-w-[400px]
        ${symbol.isChanged
          ? "border-accent-blue bg-bg-secondary"
          : symbol.kind === "external"
            ? "border-border-primary bg-bg-tertiary opacity-75"
            : "border-border-primary bg-bg-secondary"
        }
        ${selected ? "ring-2 ring-accent-blue" : ""}
      `}
    >
      {/* Header */}
      <div
        className={`
          px-3 py-2 flex items-center gap-2 cursor-pointer
          ${symbol.isChanged ? "bg-accent-blue/10" : "bg-bg-tertiary"}
        `}
        onClick={() => setExpanded(!expanded)}
      >
        <Icon
          size={14}
          weight="bold"
          className={symbol.isChanged ? "text-accent-blue" : "text-text-muted"}
        />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-text-primary truncate">
            {symbol.name}
          </div>
          <div className="text-[10px] text-text-muted truncate">
            {symbol.filePath}:{symbol.range.start}
          </div>
        </div>
        {shouldTruncate && (
          <button className="text-text-muted hover:text-text-primary">
            {expanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
          </button>
        )}
        {symbol.isChanged && (
          <span className="text-[9px] px-1.5 py-0.5 bg-accent-blue/20 text-accent-blue rounded-full">
            changed
          </span>
        )}
      </div>
      
      {/* Code snippet */}
      <div className="p-2 border-t border-border-primary bg-bg-primary">
        <pre className="text-[10px] font-mono text-text-secondary overflow-x-auto whitespace-pre">
          {displaySnippet}
        </pre>
      </div>
      
      {/* Handles for connections */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-accent-blue !border-accent-blue !w-2 !h-2"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-accent-green !border-accent-green !w-2 !h-2"
      />
    </div>
  );
});

export default CodeFlowNode;
