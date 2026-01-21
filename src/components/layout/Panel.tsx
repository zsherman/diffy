import React from 'react';
import { X } from '@phosphor-icons/react';
import type { PanelId } from '../../types/git';
import { useUIStore } from '../../stores/ui-store';

interface PanelProps {
  id: PanelId;
  title: string;
  children: React.ReactNode;
  className?: string;
  headerExtra?: React.ReactNode;
  onClose?: () => void;
}

export function Panel({ id, title, children, className = '', headerExtra, onClose }: PanelProps) {
  const { activePanel, setActivePanel } = useUIStore();
  const isActive = activePanel === id;

  return (
    <div
      className={`flex flex-col h-full bg-bg-secondary border-r border-border-primary ${className}`}
      onClick={() => setActivePanel(id)}
    >
      {/* Panel Header */}
      <div
        className={`flex items-center justify-between px-3 py-2 border-b ${
          isActive ? 'border-accent-blue bg-bg-hover' : 'border-border-primary'
        }`}
      >
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${
            isActive ? 'text-accent-blue' : 'text-text-muted'
          }`}
        >
          {title}
        </span>
        <div className="flex items-center gap-1">
          {headerExtra}
          {onClose && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors"
              title={`Close ${title}`}
            >
              <X size={14} weight="bold" />
            </button>
          )}
        </div>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
