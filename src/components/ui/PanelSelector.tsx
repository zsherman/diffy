import { useState, useRef, useEffect, useCallback } from "react";
import { Menu } from "@base-ui/react/menu";
import { Dialog } from "@base-ui/react/dialog";
import { Input } from "./Input";
import {
  SquaresFour,
  Check,
  GitCommit,
  Files,
  GitDiff,
  Tray,
  Graph,
  Robot,
  TreeStructure,
  Layout,
  FloppyDisk,
  Trash,
  BookmarkSimple,
  GitFork,
  ClockCounterClockwise,
  FlowArrow,
  ShareNetwork,
} from "@phosphor-icons/react";
import { useActiveTabPanels } from "../../stores/tabs-store";
import { applyLayout } from "../../lib/layouts";
import { getDockviewApi } from "../../stores/ui-store";

const SAVED_LAYOUTS_KEY = "diffy-saved-layouts";

interface SavedLayout {
  id: string;
  name: string;
  layout: unknown;
  createdAt: number;
}

function loadSavedLayouts(): SavedLayout[] {
  try {
    const saved = localStorage.getItem(SAVED_LAYOUTS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveSavedLayouts(layouts: SavedLayout[]) {
  localStorage.setItem(SAVED_LAYOUTS_KEY, JSON.stringify(layouts));
}

interface PanelOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  toggle: () => void;
  keywords?: string[];
}

interface LayoutShortcut {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  keywords?: string[];
}

const layoutShortcuts: LayoutShortcut[] = [
  {
    id: "standard",
    label: "Standard",
    description: "Commits + Files + Diff",
    icon: <Layout size={15} />,
    keywords: ["default", "normal", "history"],
  },
  {
    id: "changes",
    label: "Changes",
    description: "Local Changes + Diff",
    icon: <Tray size={15} />,
    keywords: ["stage", "commit", "working", "local"],
  },
  {
    id: "ai-review",
    label: "AI Review",
    description: "Files + Diff + AI",
    icon: <Robot size={15} />,
    keywords: ["ai", "review", "assistant"],
  },
  {
    id: "graph-view",
    label: "Graph View",
    description: "Graph + Files + Diff",
    icon: <TreeStructure size={15} />,
    keywords: ["tree", "branches", "visual"],
  },
];

export function PanelSelector() {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [layoutName, setLayoutName] = useState("");
  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);

  const {
    showCommitsPanel,
    showFilesPanel,
    showFileTreePanel,
    showDiffPanel,
    showStagingSidebar,
    showGraphPanel,
    showWorktreesPanel,
    showReflogPanel,
    showMermaidChangesPanel,
    showCodeFlowPanel,
    toggleCommitsPanel,
    toggleGraphPanel,
    setShowFilesPanel,
    setShowFileTreePanel,
    setShowDiffPanel,
    toggleStagingSidebar,
    toggleWorktreesPanel,
    toggleReflogPanel,
    toggleMermaidChangesPanel,
    toggleCodeFlowPanel,
  } = useActiveTabPanels();

  // Load saved layouts on mount
  useEffect(() => {
    setSavedLayouts(loadSavedLayouts());
  }, []);

  const panels: PanelOption[] = [
    {
      id: "commits",
      label: "Commits",
      icon: <GitCommit size={15} />,
      isActive: showCommitsPanel,
      toggle: toggleCommitsPanel,
      keywords: ["history", "log"],
    },
    {
      id: "files",
      label: "Files",
      icon: <Files size={15} />,
      isActive: showFilesPanel,
      toggle: () => setShowFilesPanel(!showFilesPanel),
      keywords: ["list"],
    },
    {
      id: "file-tree",
      label: "File Tree",
      icon: <TreeStructure size={15} />,
      isActive: showFileTreePanel,
      toggle: () => setShowFileTreePanel(!showFileTreePanel),
      keywords: ["tree", "folder", "hierarchy"],
    },
    {
      id: "diff",
      label: "Diff",
      icon: <GitDiff size={15} />,
      isActive: showDiffPanel,
      toggle: () => setShowDiffPanel(!showDiffPanel),
      keywords: ["changes", "compare"],
    },
    {
      id: "staging",
      label: "Local Changes",
      icon: <Tray size={15} />,
      isActive: showStagingSidebar,
      toggle: toggleStagingSidebar,
      keywords: ["stage", "unstage", "commit", "staging", "local"],
    },
    {
      id: "graph",
      label: "Graph",
      icon: <Graph size={15} />,
      isActive: showGraphPanel,
      toggle: toggleGraphPanel,
      keywords: ["tree", "visual", "branches"],
    },
    {
      id: "worktrees",
      label: "Worktrees",
      icon: <GitFork size={15} />,
      isActive: showWorktreesPanel,
      toggle: toggleWorktreesPanel,
      keywords: ["workspace", "parallel", "checkout"],
    },
    {
      id: "reflog",
      label: "Reflog",
      icon: <ClockCounterClockwise size={15} />,
      isActive: showReflogPanel,
      toggle: toggleReflogPanel,
      keywords: ["history", "undo", "timeline", "log"],
    },
    {
      id: "mermaid-changes",
      label: "Changes Diagram",
      icon: <FlowArrow size={15} />,
      isActive: showMermaidChangesPanel,
      toggle: toggleMermaidChangesPanel,
      keywords: [
        "mermaid",
        "diagram",
        "flowchart",
        "mindmap",
        "visual",
        "changes",
      ],
    },
    {
      id: "codeflow",
      label: "Code Flow",
      icon: <ShareNetwork size={15} />,
      isActive: showCodeFlowPanel,
      toggle: toggleCodeFlowPanel,
      keywords: [
        "call",
        "graph",
        "flow",
        "function",
        "method",
        "code",
        "hierarchy",
      ],
    },
  ];

  const activeCount = panels.filter((p) => p.isActive).length;

  const handleApplyLayout = (layoutId: string) => {
    const api = getDockviewApi();
    if (api) {
      applyLayout(api, layoutId);
    }
  };

  const handleApplySavedLayout = useCallback((layout: SavedLayout) => {
    const api = getDockviewApi();
    if (api && layout.layout) {
      try {
        api.fromJSON(layout.layout as Parameters<typeof api.fromJSON>[0]);
        api.groups.forEach((g) => {
          g.locked = false;
        });
      } catch (e) {
        console.error("Failed to apply saved layout:", e);
      }
    }
    setIsOpen(false);
  }, []);

  const handleSaveLayout = useCallback(() => {
    const api = getDockviewApi();
    if (!api || !layoutName.trim()) return;

    const newLayout: SavedLayout = {
      id: `custom-${Date.now()}`,
      name: layoutName.trim(),
      layout: api.toJSON(),
      createdAt: Date.now(),
    };

    const updated = [...savedLayouts, newLayout];
    setSavedLayouts(updated);
    saveSavedLayouts(updated);
    setLayoutName("");
    setShowSaveDialog(false);
  }, [layoutName, savedLayouts]);

  const handleDeleteLayout = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updated = savedLayouts.filter((l) => l.id !== id);
      setSavedLayouts(updated);
      saveSavedLayouts(updated);
    },
    [savedLayouts],
  );

  // Filter items based on search
  const searchLower = search.toLowerCase();
  const filteredPanels = panels.filter(
    (p) =>
      p.label.toLowerCase().includes(searchLower) ||
      p.keywords?.some((k) => k.includes(searchLower)),
  );
  const filteredLayouts = layoutShortcuts.filter(
    (l) =>
      l.label.toLowerCase().includes(searchLower) ||
      l.description.toLowerCase().includes(searchLower) ||
      l.keywords?.some((k) => k.includes(searchLower)),
  );
  const filteredSavedLayouts = savedLayouts.filter((l) =>
    l.name.toLowerCase().includes(searchLower),
  );

  // Focus input when menu opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the input is mounted
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  // Focus save dialog input when it opens
  useEffect(() => {
    if (showSaveDialog) {
      setTimeout(() => saveInputRef.current?.focus(), 10);
    }
  }, [showSaveDialog]);

  return (
    <Menu.Root open={isOpen} onOpenChange={setIsOpen}>
      <Menu.Trigger className="flex items-center gap-1.5 px-2 py-1 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-sm transition-colors cursor-pointer text-xs">
        <SquaresFour size={14} weight="bold" />
        <span>View</span>
        <span className="px-1.5 py-0.5 bg-bg-hover text-text-muted text-[10px] rounded-full leading-none">
          {activeCount}
        </span>
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner sideOffset={4} className="z-50">
          <Menu.Popup className="w-[300px] overflow-hidden rounded-lg border border-border-primary bg-bg-secondary shadow-xl outline-hidden">
            {/* Search input */}
            <div className="p-1.5">
              <Input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                size="sm"
                variant="ghost"
              />
            </div>

            {/* Quick layouts */}
            {filteredLayouts.length > 0 && (
              <div className="py-0.5">
                {filteredLayouts.map((layout) => (
                  <Menu.Item
                    key={layout.id}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 cursor-pointer text-text-primary data-highlighted:bg-bg-hover outline-hidden mx-1 rounded-sm"
                    onClick={() => handleApplyLayout(layout.id)}
                  >
                    <span className="text-text-muted">{layout.icon}</span>
                    <span className="flex-1 text-[13px]">{layout.label}</span>
                    <span className="text-[11px] text-text-muted">
                      {layout.description}
                    </span>
                  </Menu.Item>
                ))}
              </div>
            )}

            {/* Saved layouts */}
            {filteredSavedLayouts.length > 0 && (
              <>
                <div className="h-px bg-border-primary mx-2 my-1.5" />
                <div className="py-0.5">
                  {filteredSavedLayouts.map((layout) => (
                    <Menu.Item
                      key={layout.id}
                      className="flex items-center gap-2.5 px-2.5 py-1.5 cursor-pointer text-text-primary data-highlighted:bg-bg-hover outline-hidden mx-1 rounded-sm group"
                      onClick={() => handleApplySavedLayout(layout)}
                    >
                      <span className="text-text-muted">
                        <BookmarkSimple size={15} />
                      </span>
                      <span className="flex-1 text-[13px]">{layout.name}</span>
                      <button
                        onClick={(e) => handleDeleteLayout(layout.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-text-muted hover:text-accent-red transition-opacity cursor-pointer"
                        title="Delete layout"
                      >
                        <Trash size={13} />
                      </button>
                    </Menu.Item>
                  ))}
                </div>
              </>
            )}

            {/* Save current layout button */}
            {!search && (
              <div className="py-0.5">
                <Menu.Item
                  className="flex items-center gap-2.5 px-2.5 py-1.5 cursor-pointer text-text-primary data-highlighted:bg-bg-hover outline-hidden mx-1 rounded-sm"
                  onClick={() => {
                    setIsOpen(false);
                    setShowSaveDialog(true);
                  }}
                >
                  <span className="text-text-muted">
                    <FloppyDisk size={15} />
                  </span>
                  <span className="flex-1 text-[13px]">
                    Save current layout...
                  </span>
                </Menu.Item>
              </div>
            )}

            {/* Divider between layouts and panels */}
            {(filteredLayouts.length > 0 ||
              filteredSavedLayouts.length > 0 ||
              !search) &&
              filteredPanels.length > 0 && (
                <div className="h-px bg-border-primary mx-2 my-1.5" />
              )}

            {/* Panel toggles */}
            {filteredPanels.length > 0 && (
              <div className="py-0.5 pb-1.5">
                {filteredPanels.map((panel) => (
                  <Menu.Item
                    key={panel.id}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 cursor-pointer text-text-primary data-highlighted:bg-bg-hover outline-hidden mx-1 rounded-sm"
                    onClick={(e) => {
                      e.preventDefault();
                      panel.toggle();
                    }}
                    closeOnClick={false}
                  >
                    <span className="text-text-muted">{panel.icon}</span>
                    <span className="flex-1 text-[13px]">{panel.label}</span>
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        panel.isActive
                          ? "bg-accent-blue border-accent-blue"
                          : "border-border-primary"
                      }`}
                    >
                      {panel.isActive && (
                        <Check size={10} weight="bold" className="text-white" />
                      )}
                    </span>
                  </Menu.Item>
                ))}
              </div>
            )}

            {/* Empty state */}
            {filteredPanels.length === 0 &&
              filteredLayouts.length === 0 &&
              filteredSavedLayouts.length === 0 && (
                <div className="px-2.5 py-4 text-center text-xs text-text-muted">
                  No results found
                </div>
              )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>

      {/* Save Layout Dialog */}
      <Dialog.Root open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] bg-bg-secondary border border-border-primary rounded-lg shadow-xl z-50 outline-hidden">
            <div className="p-4">
              <Dialog.Title className="text-sm font-medium text-text-primary mb-3">
                Save Layout
              </Dialog.Title>
              <Input
                ref={saveInputRef}
                value={layoutName}
                onChange={(e) => setLayoutName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && layoutName.trim()) {
                    handleSaveLayout();
                  }
                }}
                placeholder="Layout name..."
                variant="ghost"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setLayoutName("");
                  }}
                  className="px-3 py-1.5 text-sm text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveLayout}
                  disabled={!layoutName.trim()}
                  className="px-3 py-1.5 text-sm bg-accent-blue text-white rounded-md hover:bg-accent-blue/90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </Menu.Root>
  );
}
