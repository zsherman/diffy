/**
 * Performance tracking utilities for debugging tab switch performance.
 * All output is gated behind the `diffy-perf-tracing` localStorage flag.
 */

import { isPerfTracingEnabled } from '../stores/ui-store';

// Mount counters for tracking component lifecycle
const mountCounts: Record<string, number> = {};

/**
 * Log a component mount event (call in useEffect with empty deps)
 */
export function logMount(componentName: string): void {
  if (!isPerfTracingEnabled()) return;
  mountCounts[componentName] = (mountCounts[componentName] || 0) + 1;
  console.log(`[perf] ${componentName} MOUNTED (count: ${mountCounts[componentName]})`);
}

/**
 * Log a component unmount event (call in useEffect cleanup)
 */
export function logUnmount(componentName: string): void {
  if (!isPerfTracingEnabled()) return;
  console.log(`[perf] ${componentName} UNMOUNTED`);
}

/**
 * Create a mount/unmount effect hook body.
 * Usage: useEffect(() => createMountLogger('MyComponent'), []);
 */
export function createMountLogger(componentName: string): () => void {
  logMount(componentName);
  return () => logUnmount(componentName);
}

/**
 * Mark the start of an operation and return a function to mark completion
 */
export function perfStart(label: string): () => void {
  if (!isPerfTracingEnabled()) return () => {};
  const start = performance.now();
  console.log(`[perf] ${label} started`);
  return () => {
    const elapsed = performance.now() - start;
    console.log(`[perf] ${label} completed: ${elapsed.toFixed(2)}ms`);
  };
}

/**
 * Measure time until next paint (double rAF)
 */
export function measureUntilPaint(label: string): void {
  if (!isPerfTracingEnabled()) return;
  const start = performance.now();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const elapsed = performance.now() - start;
      console.log(`[perf] ${label} -> paint: ${elapsed.toFixed(2)}ms`);
    });
  });
}

/**
 * Get current mount counts (for debugging)
 */
export function getMountCounts(): Record<string, number> {
  return { ...mountCounts };
}
