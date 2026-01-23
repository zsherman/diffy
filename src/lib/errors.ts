import { normalizeError, isAppError, type AppError, type ErrorCode } from './tauri';

// Re-export error types and utilities from tauri.ts
export { normalizeError, isAppError, type AppError, type ErrorCode };

/**
 * Extract a human-readable error message from an unknown error type.
 * Handles Tauri structured errors, plain strings, Error objects, and objects with message property.
 */
export function getErrorMessage(error: unknown): string {
  // Use normalizeError to handle structured errors
  const normalized = normalizeError(error);
  return normalized.message;
}

/**
 * Check if an error matches a specific error code.
 */
export function hasErrorCode(error: unknown, code: ErrorCode): boolean {
  if (isAppError(error)) {
    return error.code === code;
  }
  return false;
}

/**
 * Check if an error is a "repo not found" error.
 */
export function isRepoNotFoundError(error: unknown): boolean {
  return hasErrorCode(error, 'errors.repo_not_found');
}

/**
 * Check if an error is an authentication error.
 */
export function isAuthError(error: unknown): boolean {
  return hasErrorCode(error, 'errors.git_auth');
}

/**
 * Check if an error is a validation error.
 */
export function isValidationError(error: unknown): boolean {
  return hasErrorCode(error, 'errors.validation');
}
