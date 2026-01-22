import { memo } from 'react';
import type { CommitInfo, CommitGraph, RefInfo, BranchInfo } from '../../../types/git';
import { BranchTagCell } from './BranchTagCell';
import { GraphCell } from './GraphCell';
import { CommitMessageCell } from './CommitMessageCell';

interface GraphTableRowProps {
  commit: CommitInfo;
  graph: CommitGraph;
  rowIndex: number;
  rowHeight: number;
  refs: RefInfo[];
  branches: BranchInfo[];
  branchTagWidth: number;
  graphWidth: number;
  isSelected: boolean;
  isFocused: boolean;
  onClick: () => void;
}

export const GraphTableRow = memo(function GraphTableRow({
  commit,
  graph,
  rowIndex,
  rowHeight,
  refs,
  branches,
  branchTagWidth,
  graphWidth,
  isSelected,
  isFocused,
  onClick,
}: GraphTableRowProps) {
  const node = graph.nodes[rowIndex];

  return (
    <div
      className={`flex items-center cursor-pointer ${
        isFocused ? 'bg-bg-selected' : isSelected ? 'bg-bg-hover' : 'hover:bg-bg-hover'
      }`}
      style={{ height: rowHeight }}
      onClick={onClick}
    >
      <BranchTagCell refs={refs} branches={branches} width={branchTagWidth} />
      <GraphCell
        node={node}
        graph={graph}
        rowIndex={rowIndex}
        rowHeight={rowHeight}
        width={graphWidth}
        authorEmail={commit.author_email}
      />
      <CommitMessageCell commit={commit} />
    </div>
  );
});
