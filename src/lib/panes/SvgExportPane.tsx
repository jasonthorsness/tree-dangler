import { useTreeDanglerState } from "../state/store";

interface SvgExportPaneProps {
  className?: string;
}

export function SvgExportPane({ className }: SvgExportPaneProps) {
  const {
    state: { svgString },
  } = useTreeDanglerState();

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
      <div className="flex h-[600px] w-[600px] items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40">
        {svgString ? (
          <div className="w-[600px] h-[600px]" dangerouslySetInnerHTML={{ __html: svgString }} />
        ) : (
          <p className="text-xs text-slate-500">Generate geometry first to preview the SVG.</p>
        )}
      </div>
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
    </div>
  );
}

export default SvgExportPane;
