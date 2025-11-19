import { useCallback, useEffect, useRef, useState } from "react";

import { SimulationPane } from "../lib/panes/SimulationPane";
import { SvgExportPane } from "../lib/panes/SvgExportPane";
import EditorPane from "../lib/panes/EditorPane";
import { TreeDanglerProvider, useTreeDanglerState } from "../lib/state/store";
import type { TreeDanglerState } from "../lib/types";
import { pxToMm } from "../lib/logic/connectors";

function EditorCard() {
  const width = 600;
  const height = 800;
  const { state, dispatch } = useTreeDanglerState();
  const [resetToken, setResetToken] = useState(0);
  const [previewMode, setPreviewMode] = useState<"simulation" | "svg">(
    "simulation"
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setResetToken((token) => token + 1);
  }, [state.piecePolygons, state.connectors]);

  const handleReset = useCallback(() => {
    setResetToken((token) => token + 1);
  }, []);

  const handleSave = useCallback(async () => {
    const payload = {
      mask: state.mask,
      segments: state.segments,
      connectors: state.connectors,
      noise: {
        gap: state.gap,
        round: state.round,
        noiseAmplitude: state.noiseAmplitude,
        noiseSeed: state.noiseSeed,
        connectorLength: state.connectorLength,
      },
    };

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

  const handleLoad = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDownloadSvg = useCallback(async () => {
    if (!state.svgString) return;

    try {
      // Modern browsers: use native Save dialog
      if ((window as any).showSaveFilePicker) {
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
      }
    } catch (err) {
      console.error("Save dialog failed, falling back", err);
    }

    // Fallback: force download
    const blob = new Blob([state.svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tree-dangler.svg";
    link.click();
    URL.revokeObjectURL(url);
  }, [state.svgString]);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          if (data.mask?.points) {
            dispatch({ type: "SET_MASK", payload: data.mask });
          }
          if (Array.isArray(data.segments)) {
            dispatch({ type: "SET_SEGMENTS", payload: data.segments });
          }
          if (Array.isArray(data.connectors)) {
            dispatch({ type: "SET_CONNECTORS", payload: data.connectors });
          }
          if (data.noise) {
            const {
              shrinkThreshold,
              growThreshold,
              round,
              gap,
              noiseAmplitude,
              noiseSeed,
              connectorLength,
            } = data.noise;
            const configPatch: Partial<
              Pick<
                TreeDanglerState,
                "gap" | "round" | "noiseAmplitude" | "noiseSeed"
              >
            > = {};

            let roundMm: number | undefined;
            if (typeof round === "number") {
              roundMm = round;
            } else if (typeof growThreshold === "number") {
              roundMm = pxToMm(growThreshold);
            }

            let gapMm: number | undefined;
            if (typeof gap === "number") {
              gapMm = typeof round === "number" ? gap : pxToMm(gap);
            } else if (
              typeof shrinkThreshold === "number" &&
              roundMm !== undefined
            ) {
              gapMm = pxToMm(shrinkThreshold) - roundMm;
            }

            if (roundMm !== undefined) {
              configPatch.round = Math.max(0, roundMm);
            }
            if (gapMm !== undefined) {
              configPatch.gap = Math.max(0, gapMm);
            }
            if (typeof noiseAmplitude === "number") {
              configPatch.noiseAmplitude = noiseAmplitude;
            }
            if (typeof noiseSeed === "number") {
              configPatch.noiseSeed = noiseSeed;
            }
            if (Object.keys(configPatch).length > 0) {
              dispatch({
                type: "SET_DISTANCE_CONFIG",
                payload: configPatch,
              });
            }
            if (typeof connectorLength === "number") {
              dispatch({
                type: "SET_CONNECTOR_LENGTH",
                payload: connectorLength,
              });
            }
          }
        } catch (err) {
          console.error("Failed to load scene", err);
        }
      };
      reader.readAsText(file);
      event.target.value = "";
    },
    [dispatch]
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
                dispatch({
                  type: "SET_MASK",
                  payload: {
                    id: "default-mask",
                    points: [
                      { x: 200, y: 100 },
                      { x: 100, y: 300 },
                      { x: 300, y: 300 },
                    ],
                  },
                });
                dispatch({ type: "SET_SEGMENTS", payload: [] });
                dispatch({ type: "SET_CONNECTORS", payload: [] });
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
