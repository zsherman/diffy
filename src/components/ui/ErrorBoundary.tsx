import { Component, type ReactNode } from "react";
import {
  WarningCircle,
  ArrowClockwise,
  Copy,
  Check,
} from "@phosphor-icons/react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  copied: boolean;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  resetKeys?: unknown[];
}

/**
 * Base error boundary class with reset capability.
 * Used for both global and panel-level error handling.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset when resetKeys change
    if (this.state.hasError && this.props.resetKeys) {
      const prevKeys = prevProps.resetKeys ?? [];
      const currKeys = this.props.resetKeys;
      const hasChanged = currKeys.some((key, i) => key !== prevKeys[i]);
      if (hasChanged) {
        this.reset();
      }
    }
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    });
    this.props.onReset?.();
  };

  copyError = async () => {
    const { error, errorInfo } = this.state;
    const text = [
      `Error: ${error?.message ?? "Unknown error"}`,
      "",
      "Stack:",
      error?.stack ?? "No stack trace",
      "",
      "Component Stack:",
      errorInfo?.componentStack ?? "No component stack",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          onReset={this.reset}
          onCopy={this.copyError}
          copied={this.state.copied}
        />
      );
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
  onCopy: () => void;
  copied: boolean;
}

function DefaultErrorFallback({
  error,
  onReset,
  onCopy,
  copied,
}: DefaultErrorFallbackProps) {
  return (
    <div className="flex items-center justify-center h-full w-full p-4">
      <div className="text-center max-w-md">
        <WarningCircle
          size={48}
          weight="duotone"
          className="mx-auto text-status-error mb-3"
        />
        <h3 className="text-text-primary font-medium mb-1">
          Something went wrong
        </h3>
        <p className="text-text-muted text-sm mb-4">
          {error?.message ?? "An unexpected error occurred"}
        </p>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-accent-blue text-bg-primary font-medium rounded-md hover:bg-accent-blue/90 transition-colors"
          >
            <ArrowClockwise size={14} weight="bold" />
            Retry
          </button>
          <button
            onClick={onCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-bg-tertiary text-text-secondary font-medium rounded-md hover:bg-bg-hover transition-colors"
          >
            {copied ? (
              <>
                <Check
                  size={14}
                  weight="bold"
                  className="text-status-success"
                />
                Copied
              </>
            ) : (
              <>
                <Copy size={14} />
                Copy Error
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Global error boundary for the entire app.
 * Shows a full-screen error state with retry capability.
 */
interface GlobalErrorBoundaryProps {
  children: ReactNode;
  resetKeys?: unknown[];
}

export function GlobalErrorBoundary({
  children,
  resetKeys,
}: GlobalErrorBoundaryProps) {
  return (
    <ErrorBoundary
      resetKeys={resetKeys}
      fallback={undefined} // Uses default fallback
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Panel-level error boundary with compact fallback UI.
 * Designed to fit within Dockview panels without disrupting layout.
 */
interface PanelErrorBoundaryProps {
  children: ReactNode;
  panelId: string;
  resetKeys?: unknown[];
}

interface PanelErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

export class PanelErrorBoundary extends Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  constructor(props: PanelErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, copied: false };
  }

  static getDerivedStateFromError(
    error: Error,
  ): Partial<PanelErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Panel "${this.props.panelId}" error:`, error, errorInfo);
  }

  componentDidUpdate(prevProps: PanelErrorBoundaryProps) {
    // Reset when resetKeys change (e.g., repository path, panelId)
    if (this.state.hasError && this.props.resetKeys) {
      const prevKeys = prevProps.resetKeys ?? [];
      const currKeys = this.props.resetKeys;
      const hasChanged = currKeys.some((key, i) => key !== prevKeys[i]);
      if (hasChanged) {
        this.reset();
      }
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null, copied: false });
  };

  copyError = async () => {
    const { error } = this.state;
    const text = `Panel: ${this.props.panelId}\nError: ${error?.message ?? "Unknown"}\n\nStack:\n${error?.stack ?? "No stack"}`;

    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full w-full p-3">
          <div className="text-center">
            <WarningCircle
              size={32}
              weight="duotone"
              className="mx-auto text-status-error mb-2"
            />
            <p className="text-text-muted text-xs mb-3 max-w-48">
              {this.state.error?.message ?? "Panel error"}
            </p>
            <div className="flex items-center justify-center gap-1.5">
              <button
                onClick={this.reset}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-accent-blue text-bg-primary font-medium rounded-sm hover:bg-accent-blue/90 transition-colors"
              >
                <ArrowClockwise size={12} weight="bold" />
                Retry
              </button>
              <button
                onClick={this.copyError}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-bg-tertiary text-text-secondary font-medium rounded-sm hover:bg-bg-hover transition-colors"
                title="Copy error details"
              >
                {this.state.copied ? (
                  <Check size={12} className="text-status-success" />
                ) : (
                  <Copy size={12} />
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
