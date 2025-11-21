import { useMemo } from "react";

import { useTreeDanglerState } from "../state/store";

interface SvgExportPaneProps {
  className?: string;
  showDownload?: boolean;
}

export function SvgExportPane({
  className,
  showDownload = true,
}: SvgExportPaneProps) {
  const {
    state: { svgString },
  } = useTreeDanglerState();

  const displaySvg = useMemo(() => {
    if (!svgString) return undefined;
    return svgString
      .replace(/width="[^"]*"/, 'width="100%"')
      .replace(/height="[^"]*"/, 'height="100%"');
  }, [svgString]);

  const handleDownload = () => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tree-dangler.svg";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={className}>
      <div className="w-full max-w-[600px] aspect-[3/4] [&>svg]:h-full [&>svg]:w-full">
        {displaySvg ? (
          <div
            className="w-full h-full"
            dangerouslySetInnerHTML={{ __html: displaySvg }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <p className="text-xs text-[var(--ink-muted)]">
              Generate geometry first to preview the SVG.
            </p>
          </div>
        )}
      </div>
      {showDownload ? (
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={handleDownload}
            className="rounded-full border border-transparent bg-gradient-to-r from-cyan-300 via-cyan-200 to-indigo-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-900 shadow-lg shadow-cyan-500/30 transition hover:shadow-indigo-500/30 disabled:from-cyan-300/50 disabled:via-cyan-200/50 disabled:to-indigo-300/50 disabled:text-slate-700 disabled:cursor-not-allowed"
            disabled={!svgString}
          >
            Download SVG
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default SvgExportPane;
