import React, { useEffect, useState } from 'react';
import ContentLoader from 'react-content-loader';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

// Braille spinner inspired by cli-spinners "dots"
export function LoadingSpinner({ size = 'md', message }: LoadingSpinnerProps) {
  const [frame, setFrame] = useState(0);

  // cli-spinners "dots" pattern
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, 80);
    return () => clearInterval(interval);
  }, [frames.length]);

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <div className="flex items-center justify-center gap-2">
      <span
        className={`${sizeClasses[size]} text-accent-blue font-mono`}
        style={{ lineHeight: 1 }}
      >
        {frames[frame]}
      </span>
      {message && (
        <span className="text-text-muted text-sm">{message}</span>
      )}
    </div>
  );
}

export function LoadingDots() {
  return (
    <div className="flex items-center gap-1">
      <div className="w-1.5 h-1.5 bg-accent-blue rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-1.5 h-1.5 bg-accent-blue rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-1.5 h-1.5 bg-accent-blue rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

// Skeleton for list items (branches, files)
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <ContentLoader
      speed={2}
      width="100%"
      height={rows * 32}
      backgroundColor="#2a2a3a"
      foregroundColor="#3a3a4a"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <React.Fragment key={i}>
          <circle cx="16" cy={16 + i * 32} r="6" />
          <rect x="32" y={10 + i * 32} rx="3" ry="3" width={`${60 + (i % 3) * 15}%`} height="12" />
        </React.Fragment>
      ))}
    </ContentLoader>
  );
}

// Skeleton for commit list with graph
export function SkeletonCommits({ rows = 6 }: { rows?: number }) {
  return (
    <ContentLoader
      speed={2}
      width="100%"
      height={rows * 48}
      backgroundColor="#2a2a3a"
      foregroundColor="#3a3a4a"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <React.Fragment key={i}>
          {/* Graph line */}
          <rect x="36" y={i * 48} rx="0" ry="0" width="2" height="48" />
          {/* Graph node */}
          <circle cx="37" cy={24 + i * 48} r="5" />
          {/* Commit hash */}
          <rect x="80" y={12 + i * 48} rx="2" ry="2" width="50" height="10" />
          {/* Commit message */}
          <rect x="140" y={12 + i * 48} rx="2" ry="2" width={`${40 + (i % 4) * 10}%`} height="10" />
          {/* Author & time */}
          <rect x="80" y={28 + i * 48} rx="2" ry="2" width="80" height="8" />
          <rect x="170" y={28 + i * 48} rx="2" ry="2" width="40" height="8" />
        </React.Fragment>
      ))}
    </ContentLoader>
  );
}

// Skeleton for diff content
export function SkeletonDiff({ lines = 8 }: { lines?: number }) {
  return (
    <ContentLoader
      speed={2}
      width="100%"
      height={lines * 24 + 40}
      backgroundColor="#2a2a3a"
      foregroundColor="#3a3a4a"
    >
      {/* File header */}
      <rect x="12" y="8" rx="3" ry="3" width="200" height="16" />
      {/* Diff lines */}
      {Array.from({ length: lines }).map((_, i) => (
        <React.Fragment key={i}>
          {/* Line number */}
          <rect x="12" y={40 + i * 24} rx="2" ry="2" width="24" height="12" />
          {/* Code content */}
          <rect x="48" y={40 + i * 24} rx="2" ry="2" width={`${30 + (i % 5) * 12}%`} height="12" />
        </React.Fragment>
      ))}
    </ContentLoader>
  );
}

// Generic skeleton block (backwards compatible)
export function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return <SkeletonList rows={lines} />;
}

export function SkeletonLine({ width = '100%' }: { width?: string }) {
  return (
    <ContentLoader
      speed={2}
      width={width}
      height={16}
      backgroundColor="#2a2a3a"
      foregroundColor="#3a3a4a"
    >
      <rect x="0" y="2" rx="3" ry="3" width="100%" height="12" />
    </ContentLoader>
  );
}
