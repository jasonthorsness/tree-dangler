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
            <p className="text-xs text-slate-500">
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
            className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-300"
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
