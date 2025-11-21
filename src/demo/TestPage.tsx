import { useCallback, useEffect, useRef, useState } from "react";

import { SimulationPane } from "../lib/panes/SimulationPane";
import { SvgExportPane } from "../lib/panes/SvgExportPane";
import EditorPane, { EXTERNAL_UNDO_EVENT } from "../lib/panes/EditorPane";
import { TreeDanglerProvider, useTreeDanglerState } from "../lib/state/store";
import type { TreeDanglerState } from "../lib/types";
import { mmToPx } from "../lib/logic/connectors";
import {
  deserializeScene,
  encodeSceneToHash,
  serializeScene,
} from "../lib/logic/sceneSerialization";

const CLEAR_MASK_POINTS = [
  { x: mmToPx(60), y: mmToPx(30) },
  { x: mmToPx(20), y: mmToPx(100) },
  { x: mmToPx(100), y: mmToPx(100) },
];

const CLEAR_CONNECTOR_CENTER = { x: mmToPx(60), y: mmToPx(32) };
const CLEAR_SEGMENT_CENTER = { x: mmToPx(60), y: mmToPx(60) };
const DEFAULT_SEGMENT_HALF_LENGTH = 20;

const createClearSegment = () => ({
  id: crypto.randomUUID(),
  start: {
    x: CLEAR_SEGMENT_CENTER.x - DEFAULT_SEGMENT_HALF_LENGTH,
    y: CLEAR_SEGMENT_CENTER.y,
  },
  end: {
    x: CLEAR_SEGMENT_CENTER.x + DEFAULT_SEGMENT_HALF_LENGTH,
    y: CLEAR_SEGMENT_CENTER.y,
  },
  text: "text",
});

const createClearConnector = (connectorLengthMm: number) => {
  const halfLengthPx = mmToPx(connectorLengthMm) / 2;
  return {
    id: crypto.randomUUID(),
    start: {
      x: CLEAR_CONNECTOR_CENTER.x,
      y: CLEAR_CONNECTOR_CENTER.y - halfLengthPx,
    },
    end: {
      x: CLEAR_CONNECTOR_CENTER.x,
      y: CLEAR_CONNECTOR_CENTER.y + halfLengthPx,
    },
  };
};

function EditorCard() {
  const width = 600;
  const height = 800;
  const { state, dispatch } = useTreeDanglerState();
  const [resetToken, setResetToken] = useState(0);
  const [previewMode, setPreviewMode] = useState<"simulation" | "svg">(
    "simulation"
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setResetToken((token) => token + 1);
  }, [state.piecePolygons, state.connectors]);

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

  const handleLoad = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

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
    },
    [dispatch]
  );

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

  return (
    <div className="p-4">
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-6">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-[0.4em]">
              Ornament Editor
            </p>
            <div className="text-xs text-slate-400">
              {state.mask.points.length} mask points · {state.segments.length}{" "}
              segments · {state.connectors.length} connectors
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:ml-auto sm:justify-end">
            <div className="relative">
              <button
                type="button"
                onClick={() => setHelpOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-100 shadow-lg backdrop-blur transition hover:border-white/30"
              >
                Help
                <span className="text-lg leading-none font-mono">
                  {helpOpen ? "-" : "?"}
                </span>
              </button>
              {helpOpen ? (
                <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-2xl border border-white/10 bg-slate-950 p-4 text-xs text-slate-200 shadow-2xl backdrop-blur">
                  <ol className="mt-3 space-y-3 list-decimal pl-4 text-left text-[12px] leading-relaxed text-slate-200">
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
                      connectors by their points or by 90-degrees with a
                      right-click. Change the connector length in settings.
                    </li>
                    <li>
                      Once the simulation and SVG look good, export the SVG with
                      the button to the right.
                    </li>
                    <li>CTRL+Z to Undo, CTRL+Y to Redo. Happy dangling!</li>
                    <li>Happy dangling!</li>
                  </ol>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-slate-400"
            >
              Copy Link
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-slate-400"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleLoad}
              className="rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-slate-400"
            >
              Load
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new Event(EXTERNAL_UNDO_EVENT));
                }
                const maskPayload = {
                  id: "default-mask",
                  points: CLEAR_MASK_POINTS.map((point) => ({ ...point })),
                };
                const clearSegment = createClearSegment();
                const clearConnector = createClearConnector(
                  state.connectorLength
                );
                dispatch({
                  type: "SET_MASK",
                  payload: maskPayload,
                });
                dispatch({ type: "SET_SEGMENTS", payload: [clearSegment] });
                dispatch({ type: "SET_CONNECTORS", payload: [clearConnector] });
                dispatch({
                  type: "SET_DISTANCE_CONFIG",
                  payload: { gap: 1.5, round: 2, noiseAmplitude: 3 },
                });
              }}
              className="rounded-full border border-rose-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-100 transition hover:border-rose-400"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleDownloadSvg}
              className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-300"
              disabled={!state.svgString}
            >
              Export SVG
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-2 grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="flex justify-center">
              <EditorPane
                width={width}
                height={height}
                className="rounded-2xl border border-slate-800 w-full max-w-[600px] aspect-[3/4]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex justify-center">
              <div className="relative w-full max-w-[600px]">
                <div className="pointer-events-none absolute left-4 top-4 z-10">
                  <div className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-900/80 p-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-100 shadow-lg backdrop-blur">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("simulation")}
                      className={`rounded-full px-3 py-1 transition ${
                        previewMode === "simulation"
                          ? "bg-white text-slate-900"
                          : "text-slate-400 hover:text-slate-100"
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
                          ? "bg-white text-slate-900"
                          : "text-slate-400 hover:text-slate-100"
                      }`}
                      aria-pressed={previewMode === "svg"}
                    >
                      SVG
                    </button>
                  </div>
                </div>
                {previewMode === "simulation" ? (
                  <SimulationPane
                    width={width}
                    height={height}
                    resetToken={resetToken}
                    onResetRequest={handleReset}
                    className="rounded-2xl border border-slate-800 w-full aspect-[3/4]"
                  />
                ) : (
                  <div className="rounded-2xl border border-slate-800 w-full aspect-[3/4] bg-slate-950">
                    <SvgExportPane
                      className="h-full w-full overflow-auto p-4"
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
      <div className="min-h-screen">
        <EditorCard />
      </div>
    </TreeDanglerProvider>
  );
}
