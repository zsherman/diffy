import { GitBranch, ArrowRight, CheckCircle, ArrowCounterClockwise } from '@phosphor-icons/react';
import { ConflictEditor } from './ConflictEditor';
import { Button } from '../../../components/ui/Button';

interface ConflictPanelProps {
  type: 'ours' | 'theirs' | 'resolved';
  title: string;
  subtitle?: string;
  content: string;
  filePath: string;
  onChange?: (value: string) => void;
  onChoose?: () => void;
  onReset?: () => void;
  highlightLines?: { start: number; end: number } | null;
}

export function ConflictPanel({
  type,
  title,
  subtitle,
  content,
  filePath,
  onChange,
  onChoose,
  onReset,
  highlightLines,
}: ConflictPanelProps) {
  const isReadOnly = type !== 'resolved';

  const headerColors = {
    ours: 'bg-accent-blue/10 border-accent-blue/30',
    theirs: 'bg-accent-purple/10 border-accent-purple/30',
    resolved: 'bg-accent-green/10 border-accent-green/30',
  };

  const iconColors = {
    ours: 'text-accent-blue',
    theirs: 'text-accent-purple',
    resolved: 'text-accent-green',
  };

  return (
    <div className="flex flex-col h-full border border-border-primary rounded-md overflow-hidden">
      {/* Header */}
      <div
        className={`flex items-center justify-between px-3 py-1.5 border-b ${headerColors[type]}`}
      >
        <div className="flex items-center gap-2">
          {type === 'resolved' ? (
            <CheckCircle size={16} weight="fill" className={iconColors[type]} />
          ) : type === 'theirs' ? (
            <ArrowRight size={16} weight="bold" className={iconColors[type]} />
          ) : (
            <GitBranch size={16} weight="bold" className={iconColors[type]} />
          )}
          <span className={`text-sm font-medium ${iconColors[type]}`}>{title}</span>
          {subtitle && (
            <span className="text-xs text-text-muted">({subtitle})</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {onReset && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              leftIcon={<ArrowCounterClockwise size={12} weight="bold" />}
              className="text-text-muted hover:text-text-primary hover:bg-bg-tertiary"
            >
              Reset
            </Button>
          )}
          {onChoose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onChoose}
              className={
                type === 'ours'
                  ? 'text-accent-blue hover:bg-accent-blue/20'
                  : 'text-accent-purple hover:bg-accent-purple/20'
              }
            >
              Use This
            </Button>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        {content ? (
          <ConflictEditor
            value={content}
            onChange={onChange}
            readOnly={isReadOnly}
            filePath={filePath}
            highlightLines={highlightLines}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            No content available
          </div>
        )}
      </div>
    </div>
  );
}
