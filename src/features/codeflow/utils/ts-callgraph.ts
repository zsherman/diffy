import * as ts from "typescript";
import type {
  FunctionSymbol,
  CallSite,
  LineRange,
  GraphBuildOptions,
} from "../types";
import { rangeIntersectsChanges } from "./diff-to-changed-ranges";

/**
 * Parse TypeScript/JavaScript source code and extract function symbols
 */
export function extractFunctions(
  source: string,
  filePath: string,
  changedRanges: LineRange[],
  options: Pick<GraphBuildOptions, "maxSnippetLines"> = { maxSnippetLines: 20 },
): FunctionSymbol[] {
  const functions: FunctionSymbol[] = [];
  
  // Determine script kind from file extension
  const ext = filePath.split(".").pop()?.toLowerCase() || "ts";
  const scriptKind = ext === "tsx" || ext === "jsx"
    ? ts.ScriptKind.TSX
    : ext === "js" || ext === "mjs" || ext === "cjs"
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
  
  // Parse the source
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  
  const lines = source.split("\n");
  
  function getLineRange(node: ts.Node): LineRange {
    const startPos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const endPos = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    return {
      start: startPos.line + 1, // 1-indexed
      end: endPos.line + 1,
    };
  }
  
  function getSnippet(range: LineRange): string {
    const startIdx = Math.max(0, range.start - 1);
    const endIdx = Math.min(lines.length, range.end);
    const snippetLines = lines.slice(startIdx, endIdx);
    
    if (snippetLines.length > options.maxSnippetLines) {
      const half = Math.floor(options.maxSnippetLines / 2);
      return [
        ...snippetLines.slice(0, half),
        "  // ... truncated ...",
        ...snippetLines.slice(-half),
      ].join("\n");
    }
    
    return snippetLines.join("\n");
  }
  
  function getSignature(node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression, name: string): string {
    // Get parameters
    const params = node.parameters
      .map((p) => p.getText(sourceFile))
      .join(", ");
    
    // Get return type if present
    const returnType = node.type ? `: ${node.type.getText(sourceFile)}` : "";
    
    return `${name}(${params})${returnType}`;
  }
  
  function makeId(name: string, range: LineRange): string {
    return `${filePath}:${name}:${range.start}`;
  }
  
  function visitNode(node: ts.Node, className?: string) {
    // Function declaration: function foo() {}
    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.getText(sourceFile);
      const range = getLineRange(node);
      const isChanged = rangeIntersectsChanges(range, changedRanges);
      
      functions.push({
        id: makeId(name, range),
        name,
        signature: getSignature(node, name),
        filePath,
        range,
        isChanged,
        kind: "function",
        snippet: getSnippet(range),
      });
    }
    
    // Method declaration: class Foo { bar() {} }
    if (ts.isMethodDeclaration(node) && node.name) {
      const name = node.name.getText(sourceFile);
      const range = getLineRange(node);
      const isChanged = rangeIntersectsChanges(range, changedRanges);
      const fullName = className ? `${className}.${name}` : name;
      
      functions.push({
        id: makeId(fullName, range),
        name: fullName,
        signature: getSignature(node, name),
        filePath,
        range,
        isChanged,
        kind: "method",
        snippet: getSnippet(range),
        className,
      });
    }
    
    // Variable declaration with arrow function: const foo = () => {}
    if (ts.isVariableDeclaration(node) && node.initializer) {
      if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) {
        const name = node.name.getText(sourceFile);
        const range = getLineRange(node);
        const isChanged = rangeIntersectsChanges(range, changedRanges);
        
        functions.push({
          id: makeId(name, range),
          name,
          signature: getSignature(node.initializer, name),
          filePath,
          range,
          isChanged,
          kind: "arrow",
          snippet: getSnippet(range),
        });
      }
    }
    
    // Class declaration - recurse into methods
    if (ts.isClassDeclaration(node) && node.name) {
      const name = node.name.getText(sourceFile);
      node.members.forEach((member) => visitNode(member, name));
      return; // Don't recurse further for class - we handled members
    }
    
    // Recurse into children
    ts.forEachChild(node, (child) => visitNode(child, className));
  }
  
  visitNode(sourceFile);
  
  return functions;
}

/**
 * Extract call sites from a function's body
 */
export function extractCallSites(
  source: string,
  filePath: string,
  functionRange: LineRange,
): CallSite[] {
  const callSites: CallSite[] = [];
  
  const ext = filePath.split(".").pop()?.toLowerCase() || "ts";
  const scriptKind = ext === "tsx" || ext === "jsx"
    ? ts.ScriptKind.TSX
    : ext === "js" || ext === "mjs" || ext === "cjs"
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
  
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  
  function getLineNumber(node: ts.Node): { line: number; column: number } {
    const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    return { line: pos.line + 1, column: pos.character + 1 };
  }
  
  function isInRange(node: ts.Node): boolean {
    const pos = getLineNumber(node);
    return pos.line >= functionRange.start && pos.line <= functionRange.end;
  }
  
  function getCalleeName(node: ts.CallExpression): string | null {
    const expr = node.expression;
    
    // Simple identifier: foo()
    if (ts.isIdentifier(expr)) {
      return expr.getText(sourceFile);
    }
    
    // Property access: obj.foo() or this.foo()
    if (ts.isPropertyAccessExpression(expr)) {
      const propName = expr.name.getText(sourceFile);
      const obj = expr.expression;
      
      // this.foo() -> foo
      if (obj.kind === ts.SyntaxKind.ThisKeyword) {
        return propName;
      }
      
      // obj.foo() -> obj.foo
      if (ts.isIdentifier(obj)) {
        return `${obj.getText(sourceFile)}.${propName}`;
      }
      
      // Just return the property name for complex expressions
      return propName;
    }
    
    return null;
  }
  
  function visitNode(node: ts.Node) {
    if (ts.isCallExpression(node) && isInRange(node)) {
      const callee = getCalleeName(node);
      if (callee) {
        const pos = getLineNumber(node);
        callSites.push({
          callee,
          line: pos.line,
          column: pos.column,
          resolved: false,
        });
      }
    }
    
    ts.forEachChild(node, visitNode);
  }
  
  visitNode(sourceFile);
  
  return callSites;
}

/**
 * Build a name lookup map for resolving call targets
 */
export function buildNameLookup(
  functions: FunctionSymbol[],
): Map<string, FunctionSymbol[]> {
  const lookup = new Map<string, FunctionSymbol[]>();
  
  for (const fn of functions) {
    // Add by simple name
    const existing = lookup.get(fn.name) || [];
    existing.push(fn);
    lookup.set(fn.name, existing);
    
    // Also add by just the method name (without class prefix) for this.method() calls
    if (fn.className && fn.name.includes(".")) {
      const methodName = fn.name.split(".").pop()!;
      const methodExisting = lookup.get(methodName) || [];
      methodExisting.push(fn);
      lookup.set(methodName, methodExisting);
    }
  }
  
  return lookup;
}

/**
 * Resolve a call site to a target function
 */
export function resolveCallTarget(
  callSite: CallSite,
  callerFilePath: string,
  nameLookup: Map<string, FunctionSymbol[]>,
): FunctionSymbol | null {
  const candidates = nameLookup.get(callSite.callee);
  if (!candidates || candidates.length === 0) return null;
  
  // Prefer same-file matches
  const sameFile = candidates.find((c) => c.filePath === callerFilePath);
  if (sameFile) return sameFile;
  
  // Otherwise return the first match (could improve with import analysis later)
  return candidates[0];
}
