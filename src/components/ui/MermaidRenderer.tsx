import { useEffect, useRef, useState, useId, memo, useCallback } from "react";
import mermaid from "mermaid";
import panzoom, { type PanZoom } from "panzoom";
import { useTheme } from "../../stores/ui-store";
import {
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  ArrowsOutCardinal,
  House,
} from "@phosphor-icons/react";

interface MermaidRendererProps {
  /** Mermaid diagram source code */
  source: string;
  /** Optional className for the container */
  className?: string;
  /** Enable pan/zoom functionality (default: true) */
  enablePanZoom?: boolean;
}

/**
 * Get computed CSS variable value from the document
 */
function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/**
 * Build mermaid themeVariables from our app's CSS variables
 */
function getThemeVariables() {
  const bgPrimary = getCSSVar("--bg-primary");
  const bgSecondary = getCSSVar("--bg-secondary");
  const bgTertiary = getCSSVar("--bg-tertiary");
  const textPrimary = getCSSVar("--text-primary");
  const textSecondary = getCSSVar("--text-secondary");
  const textMuted = getCSSVar("--text-muted");
  const borderPrimary = getCSSVar("--border-primary");
  const accentBlue = getCSSVar("--accent-blue");
  const accentGreen = getCSSVar("--accent-green");
  const accentRed = getCSSVar("--accent-red");
  const accentYellow = getCSSVar("--accent-yellow");
  const accentPurple = getCSSVar("--accent-purple");

  return {
    // General
    background: bgSecondary,
    primaryColor: bgTertiary,
    primaryTextColor: textPrimary,
    primaryBorderColor: borderPrimary,
    secondaryColor: bgTertiary,
    secondaryTextColor: textSecondary,
    secondaryBorderColor: borderPrimary,
    tertiaryColor: bgPrimary,
    tertiaryTextColor: textMuted,
    tertiaryBorderColor: borderPrimary,

    // Lines and arrows
    lineColor: textMuted,

    // Text
    textColor: textPrimary,

    // Flowchart specific
    nodeBorder: borderPrimary,
    clusterBkg: bgTertiary,
    clusterBorder: borderPrimary,
    defaultLinkColor: textMuted,
    titleColor: textPrimary,
    nodeTextColor: textPrimary,

    // Node colors by type (we'll use these for status)
    mainBkg: bgTertiary,

    // Mindmap specific
    mindmapMainBg: accentBlue,

    // Sequence diagram specific
    actorBkg: bgTertiary,
    actorBorder: borderPrimary,
    actorTextColor: textPrimary,
    actorLineColor: textMuted,
    signalColor: textPrimary,
    signalTextColor: textPrimary,
    labelBoxBkgColor: bgTertiary,
    labelBoxBorderColor: borderPrimary,
    labelTextColor: textPrimary,
    loopTextColor: textPrimary,
    noteBorderColor: borderPrimary,
    noteBkgColor: bgTertiary,
    noteTextColor: textSecondary,
    activationBorderColor: accentBlue,
    activationBkgColor: bgTertiary,
    sequenceNumberColor: textPrimary,

    // Status colors for custom styling
    // Modified = yellow, Added = green, Deleted = red, Untracked = purple
    node1Color: accentGreen,
    node2Color: accentYellow,
    node3Color: accentRed,
    node4Color: accentPurple,
  };
}

/**
 * MermaidRenderer - renders a Mermaid diagram with theme-aware styling.
 * Re-renders when theme or source changes. Supports pan/zoom.
 */
export const MermaidRenderer = memo(function MermaidRenderer({
  source,
  className = "",
  enablePanZoom = true,
}: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const panzoomRef = useRef<PanZoom | null>(null);
  const { theme } = useTheme();
  const uniqueId = useId().replace(/:/g, "_");
  const [error, setError] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [zoom, setZoom] = useState(1);

  // Initialize panzoom after SVG is rendered
  useEffect(() => {
    if (!enablePanZoom || !svgContainerRef.current || !svgContent) return;

    // Clean up previous instance
    if (panzoomRef.current) {
      panzoomRef.current.dispose();
    }

    // Initialize panzoom on the SVG container
    const instance = panzoom(svgContainerRef.current, {
      maxZoom: 5,
      minZoom: 0.1,
      initialZoom: 1,
      bounds: false,
      boundsPadding: 0.1,
      smoothScroll: false,
      zoomDoubleClickSpeed: 1,
    });

    // Track zoom level for display
    instance.on("zoom", (e) => {
      setZoom(e.getTransform().scale);
    });

    panzoomRef.current = instance;

    return () => {
      instance.dispose();
      panzoomRef.current = null;
    };
  }, [svgContent, enablePanZoom]);

  // Render diagram
  useEffect(() => {
    if (!source.trim()) {
      setSvgContent("");
      setError(null);
      return;
    }

    const renderDiagram = async () => {
      try {
        // Re-initialize mermaid with current theme variables
        const themeVariables = getThemeVariables();

        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          securityLevel: "strict",
          themeVariables,
          flowchart: {
            htmlLabels: true,
            curve: "basis",
            padding: 15,
            nodeSpacing: 50,
            rankSpacing: 50,
          },
          mindmap: {
            padding: 16,
          },
          sequence: {
            diagramMarginX: 50,
            diagramMarginY: 10,
            actorMargin: 50,
            width: 150,
            height: 65,
            boxMargin: 10,
            boxTextMargin: 5,
            noteMargin: 10,
            messageMargin: 35,
            mirrorActors: true,
            useMaxWidth: false,
          },
        });

        // Generate unique ID for this render
        const diagramId = `mermaid-${uniqueId}-${Date.now()}`;

        // Render the diagram
        const { svg } = await mermaid.render(diagramId, source);
        setSvgContent(svg);
        setError(null);
      } catch (err) {
        console.error("Mermaid render error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to render diagram",
        );
        setSvgContent("");
      }
    };

    renderDiagram();
  }, [source, theme, uniqueId]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (panzoomRef.current && svgContainerRef.current) {
      const rect = svgContainerRef.current.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      panzoomRef.current.smoothZoom(cx, cy, 1.3);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (panzoomRef.current && svgContainerRef.current) {
      const rect = svgContainerRef.current.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      panzoomRef.current.smoothZoom(cx, cy, 0.7);
    }
  }, []);

  const handleReset = useCallback(() => {
    if (panzoomRef.current) {
      panzoomRef.current.moveTo(0, 0);
      panzoomRef.current.zoomAbs(0, 0, 1);
      setZoom(1);
    }
  }, []);

  const handleFitToView = useCallback(() => {
    if (panzoomRef.current && svgContainerRef.current && containerRef.current) {
      const svg = svgContainerRef.current.querySelector("svg");
      if (!svg) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();

      // Calculate scale to fit
      const scaleX = (containerRect.width - 40) / svgRect.width;
      const scaleY = (containerRect.height - 40) / svgRect.height;
      const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in past 100%

      panzoomRef.current.moveTo(0, 0);
      panzoomRef.current.zoomAbs(0, 0, scale);
      setZoom(scale);
    }
  }, []);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center p-4 text-accent-red bg-accent-red/10 rounded-md border border-accent-red/30 ${className}`}
      >
        <div className="text-center">
          <p className="font-medium text-sm">Failed to render diagram</p>
          <p className="text-xs text-text-muted mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!svgContent) {
    return (
      <div
        className={`flex items-center justify-center p-4 text-text-muted ${className}`}
      >
        <p className="text-sm">No diagram to display</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`mermaid-container relative ${className}`}
    >
      {/* Zoom controls */}
      {enablePanZoom && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-bg-secondary/90 backdrop-blur-sm rounded-md border border-border-primary p-1">
          <button
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-bg-hover rounded-sm text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            title="Zoom in"
          >
            <MagnifyingGlassPlus size={16} />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-bg-hover rounded-sm text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            title="Zoom out"
          >
            <MagnifyingGlassMinus size={16} />
          </button>
          <div className="w-px h-4 bg-border-primary mx-0.5" />
          <button
            onClick={handleFitToView}
            className="p-1.5 hover:bg-bg-hover rounded-sm text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            title="Fit to view"
          >
            <ArrowsOutCardinal size={16} />
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 hover:bg-bg-hover rounded-sm text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            title="Reset view"
          >
            <House size={16} />
          </button>
          <div className="w-px h-4 bg-border-primary mx-0.5" />
          <span className="text-xs text-text-muted px-1.5 min-w-[3rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      )}

      {/* Pan/zoom hint */}
      {enablePanZoom && (
        <div className="absolute bottom-2 left-2 z-10 text-xs text-text-muted/60">
          Scroll to zoom • Drag to pan
        </div>
      )}

      {/* SVG container */}
      <div
        ref={svgContainerRef}
        className="mermaid-svg-container"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
});

export default MermaidRenderer;
