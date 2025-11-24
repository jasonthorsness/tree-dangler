import { useCallback, useEffect, useRef, useState } from "react";
import type { Point } from "../lib/types";

import { SimulationPane } from "../lib/panes/SimulationPane";
import { SvgExportPane } from "../lib/panes/SvgExportPane";
import EditorPane, { EXTERNAL_UNDO_EVENT } from "../lib/panes/EditorPane";
import { TreeDanglerProvider, useTreeDanglerState } from "../lib/state/store";
import {
  deserializeScene,
  encodeSceneToHash,
  serializeScene,
} from "../lib/logic/sceneSerialization";

type PresetScene = ReturnType<typeof deserializeScene>;

type PresetEntry = {
  label: string;
  file: string;
  scene: PresetScene | null;
  previewDataUri?: string;
  error?: string;
};

const PRESETS: Array<Pick<PresetEntry, "label" | "file">> = [
  { label: "Cat", file: "cat.json" },
  { label: "Circle", file: "circle.json" },
  { label: "Dog", file: "dog.json" },
  { label: "Owl", file: "owl.json" },
  { label: "Star", file: "star.json" },
  { label: "Tree", file: "tree.json" },
  { label: "Turtle", file: "turtle.json" },
];

const formatLabelFromFile = (file: string) => {
  const base = file.replace(/\.json$/i, "");
  return base
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const buildMaskPreviewDataUri = (points: Point[] | undefined) => {
  if (!points?.length) return undefined;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const scale = 16 / Math.max(width, height);
  const offsetX = (16 - width * scale) / 2;
  const offsetY = (16 - height * scale) / 2;
  const normalizedPoints = points.map((p) => ({
    x: (p.x - minX) * scale + offsetX,
    y: (p.y - minY) * scale + offsetY,
  }));
  const pointsAttr = normalizedPoints
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="transparent"/><polygon points="${pointsAttr}" fill="#fff" /></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

function EditorCard() {
  const width = 600;
  const height = 800;
  const { state, dispatch } = useTreeDanglerState();
  const [resetToken, setResetToken] = useState(0);
  const [previewMode, setPreviewMode] = useState<"simulation" | "svg">(
    "simulation"
  );
  const [isMobile, setIsMobile] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const [presetOptions, setPresetOptions] = useState<PresetEntry[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const presetMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setResetToken((token) => token + 1);
  }, [state.piecePolygons, state.connectors]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const handleChange = () => {
      setIsMobile(mediaQuery.matches);
      if (mediaQuery.matches) {
        setPreviewMode("simulation");
      }
    };
    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const handleReset = useCallback(() => {
    setResetToken((token) => token + 1);
  }, []);

  const handleSave = useCallback(async () => {
    const payload = serializeScene(state);

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });

    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: "tree-dangler-scene.json",
        types: [
          {
            description: "JSON file",
            accept: { "application/json": [".json"] },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (err) {
      // user cancelled — safe to ignore
      console.log(err);
    }
  }, [state]);

  const handleCopyLink = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const hash = await encodeSceneToHash(state);
      const { origin, pathname, search } = window.location;
      const base = `${origin}${pathname}${search}`;
      const url = `${base}#${hash}`;
      const clipboard = navigator.clipboard;
      if (clipboard?.writeText) {
        await clipboard.writeText(url);
      } else {
        const tempInput = document.createElement("textarea");
        tempInput.value = url;
        tempInput.setAttribute("readonly", "");
        tempInput.style.position = "absolute";
        tempInput.style.left = "-9999px";
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        document.body.removeChild(tempInput);
      }
    } catch (err) {
      console.error("Failed to copy link", err);
    }
  }, [state]);

  const applySerializedScene = useCallback(
    (scene: ReturnType<typeof deserializeScene>) => {
      if (!scene) return;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(EXTERNAL_UNDO_EVENT));
      }
      dispatch({ type: "SET_MASK", payload: scene.mask });
      dispatch({ type: "SET_SEGMENTS", payload: scene.segments });
      dispatch({ type: "SET_CONNECTORS", payload: scene.connectors });
      dispatch({
        type: "SET_DISTANCE_CONFIG",
        payload: {
          gap: scene.noise.gap,
          round: scene.noise.round,
          noiseAmplitude: scene.noise.noiseAmplitude,
          noiseSeed: scene.noise.noiseSeed,
        },
      });
      dispatch({
        type: "SET_CONNECTOR_LENGTH",
        payload: scene.noise.connectorLength,
      });
      dispatch({
        type: "SET_HOLE_DIAMETER",
        payload: scene.noise.holeDiameter,
      });
    },
    [dispatch]
  );

  useEffect(() => {
    let cancelled = false;
    const loadPresets = async () => {
      setPresetsLoading(true);

      const manifest = PRESETS;
      const resolved = await Promise.all(
        manifest.map(async (entry) => {
          try {
            const resp = await fetch(entry.file);
            if (!resp.ok) {
              throw new Error(`HTTP ${resp.status}`);
            }
            const data = await resp.json();
            const scene = deserializeScene(data);
            const previewDataUri = buildMaskPreviewDataUri(scene?.mask.points);
            return {
              label:
                entry.label && entry.label.trim().length
                  ? entry.label
                  : formatLabelFromFile(entry.file),
              file: entry.file,
              scene,
              previewDataUri,
            };
          } catch (err) {
            console.error("Failed to load preset", entry.file, err);
            return {
              label:
                entry.label && entry.label.trim().length
                  ? entry.label
                  : formatLabelFromFile(entry.file),
              file: entry.file,
              scene: null,
              previewDataUri: undefined,
              error: (err as Error).message,
            };
          }
        })
      );

      if (!cancelled) {
        setPresetOptions(resolved.filter((item) => item.file));
      }
      if (!cancelled) setPresetsLoading(false);
    };

    void loadPresets();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLoadFromFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const loadPreset = useCallback(
    async (preset: { file: string; scene?: PresetScene }) => {
      try {
        if (preset.scene) {
          applySerializedScene(preset.scene);
          return;
        }
        const resp = await fetch(preset.file);
        if (!resp.ok) {
          throw new Error(
            `Failed to load preset ${preset.file}: ${resp.status}`
          );
        }
        const data = await resp.json();
        const scene = deserializeScene(data);
        if (scene) {
          applySerializedScene(scene);
        } else {
          console.error("Invalid preset file", preset.file);
        }
      } catch (err) {
        console.error("Preset load error", err);
      } finally {
        setPresetMenuOpen(false);
      }
    },
    [applySerializedScene]
  );

  const handleDownloadSvg = useCallback(async () => {
    if (!state.svgString) return;

    const handle = await (window as any).showSaveFilePicker({
      suggestedName: "tree-dangler.svg",
      types: [
        {
          description: "SVG Image",
          accept: { "image/svg+xml": [".svg"] },
        },
      ],
    });

    const writable = await handle.createWritable();
    await writable.write(
      new Blob([state.svgString], { type: "image/svg+xml" })
    );
    await writable.close();
    return;
  }, [state.svgString]);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          const scene = deserializeScene(data);
          if (scene) {
            applySerializedScene(scene);
          } else {
            console.error("Invalid scene file");
          }
        } catch (err) {
          console.error("Failed to load scene", err);
        }
      };
      reader.readAsText(file);
      event.target.value = "";
    },
    [applySerializedScene]
  );

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!presetMenuOpen) return;
      if (presetMenuRef.current?.contains(event.target as Node)) return;
      setPresetMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [presetMenuOpen]);

  return (
    <div className="p-0 sm:p-8 text-[var(--ink)]">
      <div className="mx-auto w-full max-w-[1200px] sm:rounded-[28px] border glass-panel p-2 sm:p-8">
        {isMobile ? (
          <div className="mb-4 rounded-2xl border border-cyan-300/30 bg-[rgba(5,14,32,0.9)] px-4 py-3 text-center text-sm font-semibold text-cyan-50 shadow-lg">
            Sorry, the editor requires a wider screen.
          </div>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-6">
          <div className="hidden flex-col gap-1 sm:flex">
            <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-cyan-100">
              Tree Dangler
            </p>
            <div className="hidden text-sm text-[var(--ink-muted)] sm:block">
              {state.mask.points.length} mask points · {state.segments.length}{" "}
              segments · {state.connectors.length} connectors
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:ml-auto sm:justify-end">
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setHelpOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-[rgba(9,32,66,0.8)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-50 shadow-lg shadow-cyan-500/15 transition hover:border-cyan-200/70 hover:bg-[rgba(23,58,105,0.9)]"
              >
                Help
                <span className="text-lg leading-none font-mono">
                  {helpOpen ? "▲" : "▼"}
                </span>
              </button>
              {helpOpen ? (
                <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-2xl border border-cyan-300/30 bg-[rgba(5,14,32,0.95)] p-4 text-xs text-[var(--ink)] shadow-2xl backdrop-blur">
                  <ol className="mt-3 space-y-3 list-decimal pl-4 text-left text-[12px] leading-relaxed text-[var(--ink-muted)]">
                    <li>
                      For an in-depth tutorial{" "}
                      <a
                        href="https://github.com/jasonthorsness/tree-dangler/?tab=readme-ov-file#how-to-make-an-ornament"
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-cyan-200"
                      >
                        visit here.
                      </a>
                    </li>
                    <li>
                      Define the overall shape using the green outline. To add a
                      new point, click on a line.
                    </li>
                    <li>
                      Left-click to add a segment. Double-click to change the
                      text label. Drag points to rotate or elongate. Adjust
                      settings to alter the look of the generated pieces.
                    </li>
                    <li>
                      Right-click to add connectors between segments. Rotate
                      connectors by their points, or by 90-degrees with a
                      right-click. Change the connector length in settings.
                    </li>
                    <li>
                      Drag with the middle mouse button pressed to move. Use the
                      mouse wheel to scale.
                    </li>
                    <li>
                      If the simulation shows a connector is getting squeezed
                      rather than pulled, select it and toggle "compression"
                      mode which will alter the hole placement to better
                      preserve the shape.
                    </li>
                    <li>
                      Once the simulation and SVG look good, export the SVG with
                      the button to the right.
                    </li>
                    <li>CTRL+Z to Undo, CTRL+Y to Redo.</li>
                    <li>Happy dangling!</li>
                  </ol>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="hidden rounded-full border border-cyan-300/40 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-50 shadow-sm shadow-cyan-500/10 transition hover:border-cyan-200/70 hover:bg-cyan-500/10 sm:inline-flex"
            >
              Copy Link
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="hidden rounded-full border border-cyan-300/40 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-50 shadow-sm shadow-cyan-500/10 transition hover:border-cyan-200/70 hover:bg-cyan-500/10 sm:inline-flex"
            >
              Save
            </button>
            <div className="relative w-full sm:w-auto" ref={presetMenuRef}>
              <button
                type="button"
                onClick={() => setPresetMenuOpen((prev) => !prev)}
                aria-expanded={presetMenuOpen}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-cyan-300/40 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-50 shadow-sm shadow-cyan-500/10 transition hover:border-cyan-200/70 hover:bg-cyan-500/10 sm:w-auto sm:py-1"
              >
                Load
                <span className="text-lg leading-none font-mono">
                  {presetMenuOpen ? "▲" : "▼"}
                </span>
              </button>
              {presetMenuOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-52 rounded-2xl border border-cyan-300/30 bg-[rgba(5,14,32,0.95)] p-2 text-xs text-[var(--ink)] shadow-2xl backdrop-blur">
                  <button
                    type="button"
                    onClick={() => {
                      setPresetMenuOpen(false);
                      loadPreset({ file: "triangle.json" });
                    }}
                    className="w-full rounded-xl px-3 py-2 text-left text-[12px] font-semibold text-cyan-50 transition hover:bg-cyan-500/10"
                  >
                    Empty
                  </button>
                  <div className="my-1 h-px w-full bg-cyan-300/20" />
                  <div className="flex flex-col">
                    {presetOptions.length ? (
                      presetOptions.map((option) => (
                        <button
                          key={option.file}
                          type="button"
                          onClick={() => loadPreset(option)}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] text-cyan-50 transition hover:bg-white/5"
                          title={option.file}
                        >
                          <span className="flex h-8 w-8 items-center justify-center ">
                            {option.previewDataUri ? (
                              <img
                                src={option.previewDataUri}
                                alt={`${option.label} preview`}
                                className="h-6 w-6 object-contain"
                              />
                            ) : (
                              <span className="text-[10px] text-cyan-100/70">
                                N/A
                              </span>
                            )}
                          </span>
                          <span className="flex-1 truncate">
                            {option.label}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-[12px] text-cyan-100/70">
                        {presetsLoading ? "Loading…" : "No presets found"}
                      </div>
                    )}
                  </div>
                  <div className="my-1 h-px w-full bg-cyan-300/20" />
                  <button
                    type="button"
                    onClick={() => {
                      setPresetMenuOpen(false);
                      handleLoadFromFile();
                    }}
                    className="w-full rounded-xl px-3 py-2 text-left text-[12px] font-semibold text-cyan-50 transition hover:bg-cyan-500/10"
                  >
                    From File…
                  </button>
                </div>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={handleDownloadSvg}
              className="hidden rounded-full border border-transparent bg-gradient-to-r from-cyan-300 via-cyan-200 to-indigo-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-900 shadow-lg shadow-cyan-500/30 transition hover:shadow-indigo-500/30 disabled:from-cyan-300/50 disabled:via-cyan-200/50 disabled:to-indigo-300/50 disabled:text-slate-700 disabled:cursor-not-allowed sm:inline-flex"
              disabled={!state.svgString}
            >
              Export SVG
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {!isMobile ? (
            <div className="flex flex-col gap-4">
              <div className="flex justify-center">
                <EditorPane
                  width={width}
                  height={height}
                  className="rounded-2xl border border-cyan-300/25 bg-[rgba(7,24,54,0.8)] shadow-2xl shadow-cyan-500/10 w-full max-w-[600px] aspect-[3/4]"
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-4">
            <div className="flex justify-center">
              <div className="relative w-full max-w-[600px]">
                <div className="pointer-events-none absolute left-4 top-4 z-10 hidden sm:block">
                  <div className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-cyan-300/35 bg-[rgba(8,26,54,0.85)] p-[3px] text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-50 shadow-lg shadow-cyan-500/15">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("simulation")}
                      className={`rounded-full px-3 py-1 transition ${
                        previewMode === "simulation"
                          ? "bg-gradient-to-r from-cyan-300 to-sky-200 text-slate-900 shadow-md shadow-cyan-500/20"
                          : "text-cyan-100/70 hover:text-cyan-50"
                      }`}
                      aria-pressed={previewMode === "simulation"}
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode("svg")}
                      className={`rounded-full px-3 py-1 transition ${
                        previewMode === "svg"
                          ? "bg-gradient-to-r from-cyan-300 to-indigo-300 text-slate-900 shadow-md shadow-cyan-500/20"
                          : "text-cyan-100/70 hover:text-cyan-50"
                      }`}
                      aria-pressed={previewMode === "svg"}
                    >
                      SVG
                    </button>
                  </div>
                </div>
                {previewMode === "simulation" || isMobile ? (
                  <SimulationPane
                    width={width}
                    height={height}
                    resetToken={resetToken}
                    onResetRequest={handleReset}
                    className="rounded-2xl border border-cyan-300/25 bg-[rgba(7,24,54,0.8)] shadow-2xl shadow-cyan-500/10 w-full aspect-[3/4]"
                  />
                ) : (
                  <div className="rounded-2xl border border-cyan-300/25 w-full aspect-[3/4] bg-[rgba(4,12,28,0.9)] shadow-2xl shadow-cyan-500/10">
                    <SvgExportPane
                      className="h-full w-full overflow-auto p-0"
                      showDownload={false}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TestPage() {
  return (
    <TreeDanglerProvider>
      <div className="min-h-screen p-0 sm:px-4 sm:pb-12">
        <EditorCard />
      </div>
    </TreeDanglerProvider>
  );
}
