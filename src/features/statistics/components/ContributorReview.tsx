import {
  Sparkle,
  Star,
  CircleNotch,
  Warning,
  CheckCircle,
  Lightbulb,
  Users,
} from "@phosphor-icons/react";
import type { ContributorReviewData } from "../../../lib/tauri";

interface ContributorReviewProps {
  /** Name to display - can be a contributor name or "Team" */
  contributorName: string;
  review: ContributorReviewData | null;
  isGenerating: boolean;
  error: Error | null;
  onGenerate: () => void;
  onClear: () => void;
  /** Whether this is a team review (no specific contributor selected) */
  isTeamReview?: boolean;
}

/**
 * Get color class for grade
 */
function getGradeColor(grade: string): string {
  if (grade.startsWith("A")) return "text-accent-green";
  if (grade.startsWith("B")) return "text-accent-blue";
  if (grade.startsWith("C")) return "text-accent-yellow";
  return "text-accent-red";
}

/**
 * Get background color class for grade badge
 */
function getGradeBgColor(grade: string): string {
  if (grade.startsWith("A")) return "bg-accent-green/20 border-accent-green/40";
  if (grade.startsWith("B")) return "bg-accent-blue/20 border-accent-blue/40";
  if (grade.startsWith("C")) return "bg-accent-yellow/20 border-accent-yellow/40";
  return "bg-accent-red/20 border-accent-red/40";
}

/**
 * AI-generated contributor or team review card
 */
export function ContributorReview({
  contributorName,
  review,
  isGenerating,
  error,
  onGenerate,
  onClear,
  isTeamReview = false,
}: ContributorReviewProps) {
  const Icon = isTeamReview ? Users : Sparkle;
  const title = isTeamReview ? "Team Activity Review" : "AI Review";

  // Empty state - no review yet
  if (!review && !isGenerating && !error) {
    return (
      <div className="bg-bg-secondary rounded-lg p-6 border border-border-primary">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon size={16} weight="bold" className="text-accent-purple" />
            <span className="text-sm font-medium text-text-primary">
              {title}
            </span>
          </div>
          <button
            onClick={onGenerate}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-bg-primary bg-accent-purple rounded-md hover:bg-accent-purple/90 transition-colors"
          >
            <Sparkle size={14} weight="bold" />
            Generate Review
          </button>
        </div>
        <p className="mt-3 text-sm text-text-muted">
          {isTeamReview
            ? "Get an AI-generated assessment of the team's overall commit activity and patterns."
            : `Get an AI-generated performance assessment for ${contributorName} based on their commit activity.`}
        </p>
      </div>
    );
  }

  // Loading state
  if (isGenerating) {
    return (
      <div className="bg-bg-secondary rounded-lg p-6 border border-border-primary">
        <div className="flex items-center gap-3">
          <CircleNotch
            size={20}
            weight="bold"
            className="text-accent-purple animate-spin"
          />
          <div>
            <p className="text-sm font-medium text-text-primary">
              {isTeamReview
                ? "Analyzing team activity..."
                : `Analyzing ${contributorName}'s contributions...`}
            </p>
            <p className="text-xs text-text-muted mt-1">
              This may take a few seconds
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-bg-secondary rounded-lg p-6 border border-border-primary">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Warning size={16} weight="bold" className="text-accent-red" />
            <span className="text-sm font-medium text-text-primary">
              Review Failed
            </span>
          </div>
          <button
            onClick={onGenerate}
            className="text-sm text-accent-blue hover:underline"
          >
            Try Again
          </button>
        </div>
        <p className="mt-2 text-sm text-text-muted">{error.message}</p>
      </div>
    );
  }

  // Review display
  if (!review) return null;

  return (
    <div className="bg-bg-secondary rounded-lg p-6 border border-border-primary">
      {/* Header with grade */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Icon size={16} weight="bold" className="text-accent-purple" />
          <span className="text-sm font-medium text-text-primary">
            {isTeamReview ? "Team Activity Review" : `AI Review for ${contributorName}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClear}
            className="text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            Clear
          </button>
          <button
            onClick={onGenerate}
            className="text-xs text-accent-blue hover:underline"
          >
            Regenerate
          </button>
        </div>
      </div>

      {/* Grade badge */}
      <div className="flex items-center gap-4 mb-4">
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${getGradeBgColor(review.grade)}`}
        >
          <Star size={20} weight="fill" className={getGradeColor(review.grade)} />
          <span className={`text-2xl font-bold ${getGradeColor(review.grade)}`}>
            {review.grade}
          </span>
        </div>
      </div>

      {/* Commentary */}
      <p className="text-sm text-text-primary leading-relaxed mb-4">
        {review.commentary}
      </p>

      {/* Highlights */}
      {review.highlights.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-text-muted">
            <Lightbulb size={14} weight="bold" />
            <span className="text-xs uppercase tracking-wide">Highlights</span>
          </div>
          <ul className="space-y-1.5">
            {review.highlights.map((highlight, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-text-secondary"
              >
                <CheckCircle
                  size={14}
                  weight="bold"
                  className="text-accent-green mt-0.5 shrink-0"
                />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Timestamp */}
      <p className="mt-4 text-xs text-text-muted">
        Generated{" "}
        {new Date(review.generatedAt * 1000).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}
