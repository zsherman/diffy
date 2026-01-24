import { memo } from "react";
import {
  FilePlus,
  PencilSimple,
  Trash,
  ArrowRight,
  Question,
  Copy,
} from "@phosphor-icons/react";

// Git status code mappings
export const STATUS_COLORS: Record<string, string> = {
  A: "text-accent-green",
  M: "text-accent-yellow",
  D: "text-accent-red",
  R: "text-accent-purple",
  C: "text-accent-blue",
  "?": "text-text-muted",
  T: "text-accent-yellow", // Typechange
};

export const STATUS_LABELS: Record<string, string> = {
  A: "Added",
  M: "Modified",
  D: "Deleted",
  R: "Renamed",
  C: "Copied",
  "?": "Untracked",
  T: "Typechange",
};

export const STATUS_TOOLTIPS: Record<string, string> = {
  A: "Added — New file added to the repository",
  M: "Modified — File has been changed",
  D: "Deleted — File has been removed",
  R: "Renamed — File has been renamed or moved",
  C: "Copied — File has been copied from another file",
  "?": "Untracked — File is not tracked by git",
  T: "Typechange — File type has changed",
};

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || "text-text-muted";
}

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function getStatusTooltip(status: string): string {
  return STATUS_TOOLTIPS[status] ?? status;
}

interface StatusIconProps {
  status: string;
  size?: number;
  className?: string;
}

/**
 * Renders an icon representing the git status
 */
export const StatusIcon = memo(function StatusIcon({
  status,
  size = 14,
  className,
}: StatusIconProps) {
  const color = getStatusColor(status);
  const iconProps = {
    size,
    className: className ? `${color} ${className}` : color,
    weight: "bold" as const,
  };

  switch (status) {
    case "A":
    case "?":
      return <FilePlus {...iconProps} />;
    case "M":
    case "T":
      return <PencilSimple {...iconProps} />;
    case "D":
      return <Trash {...iconProps} />;
    case "R":
      return <ArrowRight {...iconProps} />;
    case "C":
      return <Copy {...iconProps} />;
    default:
      return <Question {...iconProps} />;
  }
});

interface StatusLabelProps {
  status: string;
  className?: string;
}

/**
 * Renders a text label for the git status
 */
export const StatusLabel = memo(function StatusLabel({
  status,
  className,
}: StatusLabelProps) {
  const color = getStatusColor(status);
  const label = getStatusLabel(status);
  const tooltip = getStatusTooltip(status);

  return (
    <span
      className={`font-mono text-xs ${color} ${className ?? ""}`}
      title={tooltip}
    >
      {label}
    </span>
  );
});

interface FileStatusIndicatorProps {
  status: string;
  variant?: "icon" | "label";
  size?: number;
  className?: string;
}

/**
 * A unified file status indicator that can render as either an icon or text label.
 * Use variant="icon" for compact displays, variant="label" for more descriptive displays.
 */
export const FileStatusIndicator = memo(function FileStatusIndicator({
  status,
  variant = "icon",
  size = 14,
  className,
}: FileStatusIndicatorProps) {
  if (variant === "label") {
    return <StatusLabel status={status} className={className} />;
  }
  return <StatusIcon status={status} size={size} className={className} />;
});
