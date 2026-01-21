import React from 'react';
import type { PanelId } from '../../types/git';
import { useUIStore } from '../../stores/ui-store';

interface PanelProps {
  id: PanelId;
  title: string;
  children: React.ReactNode;
  className?: string;
  headerExtra?: React.ReactNode;
}

export function Panel({ id, title, children, className = '', headerExtra }: PanelProps) {
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
        {headerExtra}
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
