import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { parsePatchFiles } from "@pierre/diffs";
import { getWorkingDiff, getCommitDiff, readRepoFile } from "../../../lib/tauri";
import {
  diffsToChangedRanges,
  isParseableFile,
} from "../utils/diff-to-changed-ranges";
import {
  extractFunctions,
  extractCallSites,
  buildNameLookup,
  resolveCallTarget,
} from "../utils/ts-callgraph";
import type {
  CallGraph,
  CodeFlowNode,
  CodeFlowEdge,
  FunctionSymbol,
  CallSite,
  GraphBuildOptions,
  FileChangedRanges,
} from "../types";

interface UseCodeFlowGraphParams {
  repoPath: string | undefined;
  commitId: string | null;
  options?: Partial<GraphBuildOptions>;
}

const defaultOptions: GraphBuildOptions = {
  maxNodes: 80,
  maxEdges: 150,
  showExternal: true,
  maxSnippetLines: 20,
};

/**
 * Hook to build the code flow graph from diffs
 */
export function useCodeFlowGraph({
  repoPath,
  commitId,
  options: optionsOverride,
}: UseCodeFlowGraphParams) {
  // Memoize merged options to prevent infinite re-renders
  const options = useMemo(
    () => ({ ...defaultOptions, ...optionsOverride }),
    [optionsOverride?.maxNodes, optionsOverride?.maxEdges, optionsOverride?.showExternal, optionsOverride?.maxSnippetLines]
  );
  
  // Fetch diff data
  const { data: stagedDiff, isLoading: stagedLoading, error: stagedError } = useQuery({
    queryKey: ["working-diff-staged", repoPath],
    queryFn: () => getWorkingDiff(repoPath!, true),
    enabled: !!repoPath && !commitId,
    staleTime: 30000,
  });
  
  const { data: unstagedDiff, isLoading: unstagedLoading, error: unstagedError } = useQuery({
    queryKey: ["working-diff-unstaged", repoPath],
    queryFn: () => getWorkingDiff(repoPath!, false),
    enabled: !!repoPath && !commitId,
    staleTime: 30000,
  });
  
  const { data: commitDiff, isLoading: commitLoading, error: commitError } = useQuery({
    queryKey: ["commit-diff-codeflow", repoPath, commitId],
    queryFn: () => getCommitDiff(repoPath!, commitId!),
    enabled: !!repoPath && !!commitId,
    staleTime: 60000,
  });
  
  // Parse diffs to get changed ranges
  const changedFiles = useMemo(() => {
    let patches: string[] = [];
    
    if (commitId && commitDiff?.patch) {
      patches = [commitDiff.patch];
    } else {
      if (stagedDiff?.patch) patches.push(stagedDiff.patch);
      if (unstagedDiff?.patch) patches.push(unstagedDiff.patch);
    }
    
    if (patches.length === 0) return [];
    
    try {
      const parsed = parsePatchFiles(patches.join("\n"));
      const files = parsed.flatMap((p) => p.files);
      return diffsToChangedRanges(files);
    } catch (e) {
      console.error("Failed to parse diffs:", e);
      return [];
    }
  }, [commitId, commitDiff, stagedDiff, unstagedDiff]);
  
  // Get parseable files (TS/JS only for MVP)
  const parseableFiles = useMemo(() => {
    return changedFiles.filter((f) => isParseableFile(f.filePath));
  }, [changedFiles]);
  
  // Fetch file contents for all parseable files
  const { data: fileContents, isLoading: filesLoading } = useQuery({
    queryKey: ["codeflow-files", repoPath, commitId, parseableFiles.map((f) => f.filePath)],
    queryFn: async () => {
      const contents = new Map<string, string>();
      
      await Promise.all(
        parseableFiles.map(async (file) => {
          try {
            const content = await readRepoFile(
              repoPath!,
              file.filePath,
              commitId || undefined,
            );
            contents.set(file.filePath, content);
          } catch (e) {
            console.warn(`Failed to read ${file.filePath}:`, e);
          }
        }),
      );
      
      return contents;
    },
    enabled: !!repoPath && parseableFiles.length > 0,
    staleTime: 30000,
  });
  
  // Build the graph
  const graph = useMemo((): CallGraph => {
    if (!fileContents || fileContents.size === 0) {
      return { nodes: [], edges: [], totalFunctions: 0, wasCapped: false };
    }
    
    // Step 1: Extract all functions from all files
    const allFunctions: FunctionSymbol[] = [];
    const fileChangedMap = new Map<string, FileChangedRanges>();
    
    for (const changedFile of parseableFiles) {
      fileChangedMap.set(changedFile.filePath, changedFile);
    }
    
    for (const [filePath, source] of fileContents.entries()) {
      const changedFile = fileChangedMap.get(filePath);
      const changedRanges = changedFile?.changedRanges || [];
      
      const functions = extractFunctions(source, filePath, changedRanges, {
        maxSnippetLines: options.maxSnippetLines,
      });
      allFunctions.push(...functions);
    }
    
    // Step 2: Build name lookup for resolution
    const nameLookup = buildNameLookup(allFunctions);
    
    // Step 3: Extract call sites and build edges
    const changedFunctions = allFunctions.filter((f) => f.isChanged);
    const neighborIds = new Set<string>();
    const edges: CodeFlowEdge[] = [];
    const callsByFunction = new Map<string, CallSite[]>();
    const calledByFunction = new Map<string, string[]>();
    
    // For each changed function, find its outgoing calls
    for (const fn of changedFunctions) {
      const source = fileContents.get(fn.filePath);
      if (!source) continue;
      
      const callSites = extractCallSites(source, fn.filePath, fn.range);
      const resolvedCalls: CallSite[] = [];
      
      for (const call of callSites) {
        const target = resolveCallTarget(call, fn.filePath, nameLookup);
        
        if (target) {
          call.resolved = true;
          call.targetId = target.id;
          neighborIds.add(target.id);
          
          // Track calledBy
          const callers = calledByFunction.get(target.id) || [];
          callers.push(fn.id);
          calledByFunction.set(target.id, callers);
          
          edges.push({
            id: `${fn.id}->${target.id}:${call.line}`,
            source: fn.id,
            target: target.id,
            data: { callSite: call },
            animated: fn.isChanged,
          });
        } else if (options.showExternal) {
          // Create external reference
          const externalId = `external:${call.callee}`;
          call.resolved = false;
          call.targetId = externalId;
          neighborIds.add(externalId);
          
          edges.push({
            id: `${fn.id}->${externalId}:${call.line}`,
            source: fn.id,
            target: externalId,
            data: { callSite: call, isExternal: true },
            style: { strokeDasharray: "5,5" },
          });
        }
        
        resolvedCalls.push(call);
      }
      
      callsByFunction.set(fn.id, resolvedCalls);
    }
    
    // Step 4: Find callers of changed functions (1-hop incoming)
    for (const fn of allFunctions) {
      if (fn.isChanged) continue; // Already processed
      
      const source = fileContents.get(fn.filePath);
      if (!source) continue;
      
      const callSites = extractCallSites(source, fn.filePath, fn.range);
      
      for (const call of callSites) {
        const target = resolveCallTarget(call, fn.filePath, nameLookup);
        
        if (target && target.isChanged) {
          // This function calls a changed function - it's a 1-hop neighbor
          call.resolved = true;
          call.targetId = target.id;
          neighborIds.add(fn.id);
          
          const callers = calledByFunction.get(target.id) || [];
          callers.push(fn.id);
          calledByFunction.set(target.id, callers);
          
          edges.push({
            id: `${fn.id}->${target.id}:${call.line}`,
            source: fn.id,
            target: target.id,
            data: { callSite: call },
          });
          
          // Track calls for this function too
          const existingCalls = callsByFunction.get(fn.id) || [];
          existingCalls.push(call);
          callsByFunction.set(fn.id, existingCalls);
        }
      }
    }
    
    // Step 5: Build nodes - changed functions + 1-hop neighbors
    const includedIds = new Set<string>();
    
    // Add all changed functions
    for (const fn of changedFunctions) {
      includedIds.add(fn.id);
    }
    
    // Add 1-hop neighbors (callers and callees)
    for (const id of neighborIds) {
      includedIds.add(id);
    }
    
    // Step 6: Create React Flow nodes
    const nodes: CodeFlowNode[] = [];
    const externalNodes = new Map<string, boolean>();
    
    // Check for caps
    let wasCapped = false;
    const totalFunctions = includedIds.size;
    
    let nodeCount = 0;
    for (const fn of allFunctions) {
      if (!includedIds.has(fn.id)) continue;
      if (nodeCount >= options.maxNodes) {
        wasCapped = true;
        break;
      }
      
      nodes.push({
        id: fn.id,
        type: "codeflow",
        position: { x: 0, y: 0 }, // Will be set by layout
        data: {
          symbol: fn,
          calls: callsByFunction.get(fn.id) || [],
          calledBy: calledByFunction.get(fn.id) || [],
        },
      });
      nodeCount++;
    }
    
    // Add external nodes
    if (options.showExternal) {
      for (const edge of edges) {
        if (edge.data?.isExternal && edge.target.startsWith("external:")) {
          if (externalNodes.has(edge.target)) continue;
          if (nodeCount >= options.maxNodes) {
            wasCapped = true;
            break;
          }
          
          const callee = edge.target.replace("external:", "");
          externalNodes.set(edge.target, true);
          
          nodes.push({
            id: edge.target,
            type: "codeflow",
            position: { x: 0, y: 0 },
            data: {
              symbol: {
                id: edge.target,
                name: callee,
                signature: `${callee}()`,
                filePath: "(external)",
                range: { start: 0, end: 0 },
                isChanged: false,
                kind: "external",
                snippet: "// External function\n// Not in changed files",
              },
              calls: [],
              calledBy: [],
            },
          });
          nodeCount++;
        }
      }
    }
    
    // Filter edges to only include nodes we have
    const nodeIds = new Set(nodes.map((n) => n.id));
    const filteredEdges = edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .slice(0, options.maxEdges);
    
    if (filteredEdges.length < edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)).length) {
      wasCapped = true;
    }
    
    return {
      nodes,
      edges: filteredEdges,
      totalFunctions,
      wasCapped,
    };
  }, [fileContents, parseableFiles, options]);
  
  const isLoading = commitId
    ? commitLoading || filesLoading
    : stagedLoading || unstagedLoading || filesLoading;
  
  const error = stagedError || unstagedError || commitError;
  
  return {
    graph,
    isLoading,
    changedFilesCount: changedFiles.length,
    parseableFilesCount: parseableFiles.length,
    error: error ? String(error) : null,
  };
}
