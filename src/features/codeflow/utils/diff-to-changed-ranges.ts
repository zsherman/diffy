import type { FileChangedRanges, LineRange } from "../types";

/**
 * Parse a @pierre/diffs hunk to extract changed line ranges.
 * Hunks have structure like:
 * {
 *   newStart: number,
 *   newLineCount: number,
 *   changes: Array<{ type: 'insert' | 'delete' | 'context', ... }>
 * }
 */
interface DiffHunk {
  newStart: number;
  newLineCount: number;
  changes?: Array<{
    type: "insert" | "delete" | "context" | string;
    newLineNumber?: number;
  }>;
}

interface ParsedFileDiff {
  name?: string;
  prevName?: string;
  hunks?: DiffHunk[];
}

/**
 * Extract changed line ranges from a parsed file diff.
 * @pierre/diffs hunk structure:
 * - collapsedBefore: lines before hunk in file
 * - additionStart: line number where additions begin
 * - additionCount: number of addition entries
 * - unifiedLineCount: total lines in unified view
 */
export function extractChangedRanges(fileDiff: ParsedFileDiff): LineRange[] {
  const ranges: LineRange[] = [];
  
  if (!fileDiff.hunks) return ranges;
  
  for (const hunk of fileDiff.hunks) {
    const hunkAny = hunk as any;
    
    // @pierre/diffs structure: use additionStart as the starting line
    // and compute end from the hunk size
    const start = hunkAny.additionStart || hunkAny.collapsedBefore + 1 || 0;
    const lineCount = hunkAny.unifiedLineCount || hunkAny.additionCount || 0;
    
    if (start > 0 && lineCount > 0) {
      ranges.push({
        start: start,
        end: start + lineCount - 1,
      });
    }
  }
  
  return mergeOverlappingRanges(ranges);
}

/**
 * Merge overlapping or adjacent ranges
 */
function mergeOverlappingRanges(ranges: LineRange[]): LineRange[] {
  if (ranges.length === 0) return [];
  
  // Sort by start
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: LineRange[] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];
    
    // Merge if overlapping or adjacent (within 1 line)
    if (current.start <= last.end + 1) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }
  
  return merged;
}

/**
 * Check if a line range intersects with any changed ranges
 */
export function rangeIntersectsChanges(
  range: LineRange,
  changedRanges: LineRange[],
): boolean {
  return changedRanges.some(
    (changed) => range.start <= changed.end && range.end >= changed.start,
  );
}

/**
 * Convert an array of parsed file diffs to FileChangedRanges
 */
export function diffsToChangedRanges(
  parsedFiles: ParsedFileDiff[],
): FileChangedRanges[] {
  const result: FileChangedRanges[] = [];
  
  for (const fileDiff of parsedFiles) {
    // Get the file path - prefer name over prevName (for new/modified files)
    const rawPath = fileDiff.name || fileDiff.prevName || "";
    // Strip a/ or b/ prefix if present
    const filePath = rawPath.replace(/^[ab]\//, "");
    
    if (!filePath) continue;
    
    const changedRanges = extractChangedRanges(fileDiff);
    if (changedRanges.length > 0) {
      result.push({ filePath, changedRanges });
    }
  }
  
  return result;
}

/**
 * Get the set of file paths that have changes
 */
export function getChangedFilePaths(changedFiles: FileChangedRanges[]): Set<string> {
  return new Set(changedFiles.map((f) => f.filePath));
}

/**
 * Check if a file is a TypeScript/JavaScript file we can parse
 */
export function isParseableFile(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase();
  return ["ts", "tsx", "js", "jsx", "mts", "mjs", "cts", "cjs"].includes(ext || "");
}
