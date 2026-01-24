import { Select } from "@base-ui/react/select";
import { Check, CaretUpDown, Users } from "@phosphor-icons/react";
import type { Contributor } from "../hooks/useContributionData";

interface ContributorFilterProps {
  contributors: Contributor[];
  selectedEmail: string | null;
  onSelect: (email: string | null) => void;
}

/**
 * Dropdown filter for selecting a contributor to filter the calendar by
 */
export function ContributorFilter({
  contributors,
  selectedEmail,
  onSelect,
}: ContributorFilterProps) {
  const selectedContributor = contributors.find(
    (c) => c.email === selectedEmail,
  );

  const handleValueChange = (value: string | null) => {
    // "all" maps to null (show all contributors)
    onSelect(value === "all" ? null : value);
  };

  return (
    <Select.Root
      value={selectedEmail ?? "all"}
      onValueChange={handleValueChange}
    >
      <Select.Trigger className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-primary bg-bg-secondary border border-border-primary rounded-md hover:bg-bg-hover transition-colors cursor-pointer min-w-[200px]">
        <Users size={14} weight="bold" className="text-text-muted" />
        <span className="flex-1 text-left truncate">
          {selectedContributor?.name ?? "All contributors"}
        </span>
        <CaretUpDown size={12} className="text-text-muted" />
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner sideOffset={4} className="z-50">
          <Select.Popup className="min-w-[220px] max-w-[320px] max-h-[300px] overflow-y-auto rounded-md border border-border-primary bg-bg-secondary shadow-lg outline-hidden">
            {/* All contributors option */}
            <Select.Item
              value="all"
              className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer text-text-primary data-highlighted:bg-bg-hover outline-hidden"
            >
              <Select.ItemIndicator className="w-4">
                <Check
                  size={14}
                  weight="bold"
                  className="text-accent-green"
                />
              </Select.ItemIndicator>
              <div className="flex flex-col flex-1 min-w-0">
                <span>All contributors</span>
                <span className="text-xs text-text-muted">
                  {contributors.reduce((sum, c) => sum + c.commitCount, 0)}{" "}
                  commits
                </span>
              </div>
            </Select.Item>

            {/* Separator */}
            {contributors.length > 0 && (
              <div className="h-px bg-border-primary my-1" />
            )}

            {/* Individual contributors */}
            {contributors.map((contributor) => (
              <Select.Item
                key={contributor.email}
                value={contributor.email}
                className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer text-text-primary data-highlighted:bg-bg-hover outline-hidden"
              >
                <Select.ItemIndicator className="w-4">
                  <Check
                    size={14}
                    weight="bold"
                    className="text-accent-green"
                  />
                </Select.ItemIndicator>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="truncate">{contributor.name}</span>
                  <span className="text-xs text-text-muted truncate">
                    {contributor.email} · {contributor.commitCount} commits
                  </span>
                </div>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

