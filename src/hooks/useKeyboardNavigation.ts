import { useEffect, useCallback } from 'react';
import { useUIStore, getDockviewApi } from '../stores/ui-store';
import type { PanelId } from '../types/git';

const PANELS: PanelId[] = ['branches', 'commits', 'files', 'diff', 'staging'];

interface KeyboardConfig {
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  onSelect?: () => void;
  onStage?: () => void;
  onUnstage?: () => void;
  onDiscard?: () => void;
  onRefresh?: () => void;
}

export function useKeyboardNavigation(config: KeyboardConfig = {}) {
  const {
    activePanel,
    setActivePanel,
    showHelpOverlay,
    setShowHelpOverlay,
    showCommandPalette,
    setShowCommandPalette,
    diffViewMode,
    setDiffViewMode,
    toggleStagingSidebar,
  } = useUIStore();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't handle keys when in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      // Command palette (Cmd+K or Ctrl+K)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(!showCommandPalette);
        return;
      }

      // Toggle staging sidebar (Cmd+Shift+S or Ctrl+Shift+S)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 's') {
        e.preventDefault();
        toggleStagingSidebar();
        return;
      }

      // Close overlays on Escape
      if (e.key === 'Escape') {
        if (showHelpOverlay) {
          setShowHelpOverlay(false);
          return;
        }
        if (showCommandPalette) {
          setShowCommandPalette(false);
          return;
        }
      }

      // Help overlay
      if (e.key === '?') {
        e.preventDefault();
        setShowHelpOverlay(!showHelpOverlay);
        return;
      }

      // Don't process other keys when overlays are open
      if (showHelpOverlay || showCommandPalette) {
        return;
      }

      // Helper to activate panel in both ui-store and dockview
      const activatePanel = (panelId: PanelId) => {
        setActivePanel(panelId);
        const api = getDockviewApi();
        if (api) {
          const panel = api.getPanel(panelId);
          if (panel) {
            panel.api.setActive();
          }
        }
      };

      // Panel navigation with Tab, h/l, or arrow keys
      if (e.key === 'Tab' || e.key === 'l' || e.key === 'ArrowRight') {
        e.preventDefault();
        const currentIndex = PANELS.indexOf(activePanel);
        const nextIndex = e.shiftKey
          ? (currentIndex - 1 + PANELS.length) % PANELS.length
          : (currentIndex + 1) % PANELS.length;
        activatePanel(PANELS[nextIndex]);
        return;
      }

      if ((e.key === 'h' || e.key === 'ArrowLeft') && !e.shiftKey) {
        e.preventDefault();
        const currentIndex = PANELS.indexOf(activePanel);
        const prevIndex = (currentIndex - 1 + PANELS.length) % PANELS.length;
        activatePanel(PANELS[prevIndex]);
        return;
      }

      // Vim navigation
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        config.onNavigateDown?.();
        return;
      }

      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        config.onNavigateUp?.();
        return;
      }

      // Select/enter
      if (e.key === 'Enter') {
        e.preventDefault();
        config.onSelect?.();
        return;
      }

      // Stage (space)
      if (e.key === ' ') {
        e.preventDefault();
        config.onStage?.();
        return;
      }

      // Unstage (u)
      if (e.key === 'u') {
        e.preventDefault();
        config.onUnstage?.();
        return;
      }

      // Discard (d)
      if (e.key === 'd' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        config.onDiscard?.();
        return;
      }

      // Refresh (r)
      if (e.key === 'r') {
        e.preventDefault();
        config.onRefresh?.();
        return;
      }

      // Toggle diff view mode (v)
      if (e.key === 'v') {
        e.preventDefault();
        setDiffViewMode(diffViewMode === 'split' ? 'unified' : 'split');
        return;
      }

      // Focus specific panels with number keys
      if (e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (index < PANELS.length) {
          activatePanel(PANELS[index]);
        }
        return;
      }
    },
    [
      activePanel,
      setActivePanel,
      showHelpOverlay,
      setShowHelpOverlay,
      showCommandPalette,
      setShowCommandPalette,
      diffViewMode,
      setDiffViewMode,
      toggleStagingSidebar,
      config,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    activePanel,
    setActivePanel,
  };
}
