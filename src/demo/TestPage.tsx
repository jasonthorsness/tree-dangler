import { useCallback, useEffect, useRef, useState } from "react";

import { SimulationPane } from "../lib/panes/SimulationPane";
import { SvgExportPane } from "../lib/panes/SvgExportPane";
import { DistanceFieldPane } from "../lib/panes/DistanceFieldPane";
import EditorPane from "../lib/panes/EditorPane";
import { TreeDanglerProvider, useTreeDanglerState } from "../lib/state/store";

function EditorCard() {
  const width = 600;
  const height = 800;
  const { state, dispatch } = useTreeDanglerState();
  const [resetToken, setResetToken] = useState(0);
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
        shrinkThreshold: state.shrinkThreshold,
        growThreshold: state.growThreshold,
        noiseAmplitude: state.noiseAmplitude,
        noiseSeed: state.noiseSeed,
        connectorLength: state.connectorLength,
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });

    try {
      const handle = await window.showSaveFilePicker({
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
              noiseAmplitude,
              noiseSeed,
              connectorLength,
            } = data.noise;
            dispatch({
              type: "SET_DISTANCE_CONFIG",
              payload: {
                shrinkThreshold,
                growThreshold,
                noiseAmplitude,
                noiseSeed,
              },
            });
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-sky-300">
            Ornament Editor
          </p>
          <h2 className="text-2xl font-semibold text-white">Instructions</h2>
          <p className="text-sm text-slate-300">
            Segments are laser-cut wooden pieces, while connectors are jewelry
            jump rings.
            <ol>
              <li>
                First, define the overall shape using the outline mask (green
                points/lines). To add a new point, click on the green dotted
                line.
              </li>
              <li>
                Next, left-click to add a segment for each separate piece of the
                ornament. Double-click to change the text. Drag points to rotate
                or elongate. Adjust the shrink, grow, and noise parameters to
                alter the look of the segment pieces.
              </li>
              <li>
                Third, right-click to add a connector from the background to
                your top segment. Then add more connectors until all segments
                are connected. Change the connector length to match your jump
                rings (10mm jump rings give about 8mm of connector length).
              </li>
              <li>
                Adjust segments and connectors until the simulation shows them
                hanging the way you want.
              </li>
              <li>
                Observe the SVG preview to make sure the connector holes are not
                too close to the text or the edge. Once everything looks good,
                you can download your SVG for laser cutting!
              </li>
              <li>
                To change the font or otherwise alter the pieces, post-process
                the SVG using{" "}
                <a
                  href="https://inkscape.org/"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Inkscape
                </a>{" "}
                or your favorite vector editor.
              </li>
            </ol>
          </p>
        </div>
        <div className="text-xs text-right text-slate-400">
          {state.mask.points.length} mask points · {state.segments.length}{" "}
          segments · {state.connectors.length} connectors
        </div>
      </div>
      <div className="mt-4 grid gap-2 grid-cols-4">
        <div className="flex flex-col gap-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
              Interactions
            </p>
            <p className="mt-2 text-xs text-slate-300">
              Left-click: add segment · Right-click: add connector. Drag
              points/edges to edit; Delete removes the last selection.
            </p>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
              Scene
            </p>
            <div className="flex flex-wrap gap-2">
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
            <DistanceFieldPane
              width={300}
              height={800}
              className="w-full"
              showPreview={false}
            />
          </div>
        </div>

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
            <SimulationPane
              width={width}
              height={height}
              resetToken={resetToken}
              onResetRequest={handleReset}
              className="rounded-2xl border border-slate-800 w-full max-w-[600px] aspect-[3/4]"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="w-full max-w-[600px]">
            <SvgExportPane
              className="rounded-2xl border border-slate-800 p-4 w-full"
              showDownload={false}
            />
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
