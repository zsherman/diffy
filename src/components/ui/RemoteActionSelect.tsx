import { useState, useMemo } from 'react';
import { Menu } from '@base-ui/react/menu';
import { ArrowDown, CaretDown, Check, CloudArrowDown, ArrowsClockwise } from '@phosphor-icons/react';
import {
  useDefaultRemoteAction,
  REMOTE_ACTION_OPTIONS,
  type RemoteActionType,
} from '../../stores/ui-store';

interface RemoteActionSelectProps {
  isLoading?: boolean;
  onExecute: () => void;
  disabled?: boolean;
}

export function RemoteActionSelect({ isLoading, onExecute, disabled }: RemoteActionSelectProps) {
  const { defaultRemoteAction, setDefaultRemoteAction } = useDefaultRemoteAction();
  const [open, setOpen] = useState(false);

  const selectedOption = useMemo(
    () => REMOTE_ACTION_OPTIONS.find((opt) => opt.id === defaultRemoteAction) ?? REMOTE_ACTION_OPTIONS[1],
    [defaultRemoteAction]
  );

  const handleSelect = (action: RemoteActionType) => {
    setDefaultRemoteAction(action);
    setOpen(false);
  };

  // Determine icon based on selected action
  const ActionIcon = selectedOption.id === 'fetch_all' ? CloudArrowDown : ArrowDown;

  // Short label for the button
  const shortLabel = selectedOption.id === 'fetch_all' ? 'Fetch' : 'Pull';

  return (
    <div className="flex items-center">
      {/* Action button - executes the selected operation */}
      <button
        onClick={onExecute}
        disabled={isLoading || disabled}
        className="flex items-center gap-1.5 px-2 py-1 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-blue"
        title={selectedOption.label}
      >
        {isLoading ? (
          <ArrowsClockwise size={14} weight="bold" className="animate-spin" />
        ) : (
          <ActionIcon size={14} weight="bold" />
        )}
        <span className="hidden sm:inline">{shortLabel}</span>
      </button>

      {/* Dropdown trigger - changes the default action */}
      <Menu.Root open={open} onOpenChange={setOpen}>
        <Menu.Trigger
          disabled={disabled}
          className="flex items-center px-1 py-1 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-blue"
          aria-label="Select default pull/fetch operation"
        >
          <CaretDown size={10} />
        </Menu.Trigger>

        <Menu.Portal>
          <Menu.Positioner sideOffset={4} align="start" className="z-50">
            <Menu.Popup className="rounded-md border border-border-primary bg-bg-secondary shadow-lg outline-none p-1">
              {REMOTE_ACTION_OPTIONS.map((option) => (
                <Menu.Item
                  key={option.id}
                  onClick={() => handleSelect(option.id)}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer text-text-primary data-[highlighted]:bg-bg-hover outline-none"
                >
                  <span className="w-4 flex items-center justify-center">
                    {defaultRemoteAction === option.id && (
                      <Check size={14} weight="bold" className="text-accent-blue" />
                    )}
                  </span>
                  <span>{option.label}</span>
                </Menu.Item>
              ))}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
