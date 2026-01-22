/**
 * Extract a human-readable error message from an unknown error type.
 * Handles Tauri errors (which are strings), Error objects, and objects with message property.
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'An unknown error occurred';
}
