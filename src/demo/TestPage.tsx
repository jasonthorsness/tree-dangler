import { useCallback, useState } from "react";

import { MaskPane } from "../lib/panes/MaskPane";
import { SegmentInputPane } from "../lib/panes/SegmentInputPane";
import { ConnectorsPane } from "../lib/panes/ConnectorsPane";
import { VoronoiPane } from "../lib/panes/VoronoiPane";
import { DistanceFieldPane } from "../lib/panes/DistanceFieldPane";
import { TracedPolygonsPane } from "../lib/panes/TracedPolygonsPane";
import { TreeDanglerProvider, useTreeDanglerState } from "../lib/state/store";
import { CanvasPane, type PointerEventData } from "../lib/ui/CanvasPane";

const panes = [
  {
    title: "Distance Field",
    description: "Blend Voronoi shapes with threshold + noise controls.",
  },
  {
    title: "Connectors",
    description: "Fix connector lengths and anchor them to polygons.",
  },
];

const callouts = [
  "Shared context + reducer",
  "Canvas-first panes",
  "SSR-safe React components",
  "1 px = 0.2 mm metric grid",
];

function CanvasDemo() {
  const width = 360;
  const height = 220;
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const handleDraw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      ctx.clearRect(0, 0, width, height);

      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#0f172a");
      gradient.addColorStop(1, "#06121f");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(24, 24, width - 48, height - 48);

      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(16, 185, 129, 0.25)";
      ctx.strokeStyle = "rgba(16, 185, 129, 0.9)";
      ctx.lineWidth = 3;
      const rectX = width / 2 - 70;
      const rectY = height / 2 - 40;
      const rectWidth = 140;
      const rectHeight = 80;
      const radius = 16;
      ctx.beginPath();
      ctx.moveTo(rectX + radius, rectY);
      ctx.lineTo(rectX + rectWidth - radius, rectY);
      ctx.quadraticCurveTo(
        rectX + rectWidth,
        rectY,
        rectX + rectWidth,
        rectY + radius
      );
      ctx.lineTo(rectX + rectWidth, rectY + rectHeight - radius);
      ctx.quadraticCurveTo(
        rectX + rectWidth,
        rectY + rectHeight,
        rectX + rectWidth - radius,
        rectY + rectHeight
      );
      ctx.lineTo(rectX + radius, rectY + rectHeight);
      ctx.quadraticCurveTo(
        rectX,
        rectY + rectHeight,
        rectX,
        rectY + rectHeight - radius
      );
      ctx.lineTo(rectX, rectY + radius);
      ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (cursor) {
        ctx.fillStyle = "#f0fdf4";
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
      }
    },
    [cursor, height, width]
  );

  const handlePointerMove = useCallback((event: PointerEventData) => {
    setCursor({ x: Number(event.x.toFixed(1)), y: Number(event.y.toFixed(1)) });
  }, []);

  const handlePointerLeave = useCallback(() => {
    setCursor(null);
  }, []);

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-black/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">
            CanvasPane
          </p>
          <p className="text-lg text-white">Shared canvas utility</p>
        </div>
        <div className="text-xs text-slate-300">
          {cursor ? (
            <span>
              Pointer:{" "}
              <span className="font-mono text-emerald-200">{cursor.x}</span>,{" "}
              <span className="font-mono text-emerald-200">{cursor.y}</span>
            </span>
          ) : (
            "Move pointer to sample coordinates"
          )}
        </div>
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-black/30">
        <CanvasPane
          width={width}
          height={height}
          onDraw={handleDraw}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerMove}
          onPointerUp={handlePointerLeave}
          onPointerLeave={handlePointerLeave}
          className="block"
        />
      </div>
    </div>
  );
}

function MaskPaneCard() {
  const { state } = useTreeDanglerState();
  const width = 600;
  const height = 600;

  return (
    <div className="rounded-3xl border border-emerald-900/50 bg-slate-900/60 p-6 shadow-2xl shadow-black/50">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-emerald-300">
            Module 0
          </p>
          <h2 className="text-2xl font-semibold text-white">Mask Editor</h2>
          <p className="text-sm text-slate-300">
            600 × 600 px canvas ⇒ 120 × 120 mm workspace. Click points to
            select, edges to insert, Delete to remove.
          </p>
        </div>
        <div className="flex flex-col gap-1 text-right">
          <div className="rounded-lg border border-emerald-500/30 px-3 py-1 text-xs text-emerald-200">
            {width}×{height}
          </div>
          <div className="text-xs text-slate-400">
            {state.mask.points.length} points
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-center">
        <MaskPane
          width={width}
          height={height}
          className="rounded-2xl border border-slate-800 w-[600px] h-[600px]"
        />
      </div>
    </div>
  );
}

function SegmentPaneCard() {
  const width = 600;
  const height = 600;
  const { state } = useTreeDanglerState();

  return (
    <div className="rounded-3xl border border-sky-900/40 bg-slate-900/60 p-6 shadow-2xl shadow-black/40">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-sky-300">
            Module 1
          </p>
          <h2 className="text-2xl font-semibold text-white">Segment Input</h2>
          <p className="text-sm text-slate-300">
            Same 120 × 120 mm frame with shared state: click canvas to add a
            segment, drag endpoints/body, double-click label to edit.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <div className="rounded-lg border border-sky-500/30 px-3 py-1 text-xs text-sky-200">
            {width}×{height}
          </div>
          <p className="text-xs text-slate-400">
            {state.segments.length
              ? `${state.segments.length} segment${
                  state.segments.length === 1 ? "" : "s"
                }`
              : "No segments yet"}
          </p>
        </div>
      </div>
      <div className="mt-6 flex justify-center">
        <SegmentInputPane
          width={width}
          height={height}
          className="rounded-2xl border border-slate-800 w-[600px] h-[600px]"
        />
      </div>
    </div>
  );
}

function VoronoiPaneCard() {
  const width = 600;
  const height = 600;
  const { state } = useTreeDanglerState();

  return (
    <div className="rounded-3xl border border-fuchsia-900/40 bg-slate-900/60 p-6 shadow-2xl shadow-black/40">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-fuchsia-300">
            Module 2
          </p>
          <h2 className="text-2xl font-semibold text-white">Voronoi Preview</h2>
          <p className="text-sm text-slate-300">
            Visualize merged Voronoi regions for each segment to inspect
            coverage before rasterizing distance fields.
          </p>
        </div>
        <div className="text-xs text-right text-slate-400">
          {state.voronoiPolygons.length
            ? `${state.voronoiPolygons.length} polygons`
            : "No polygons yet"}
        </div>
      </div>
      <div className="mt-6 flex justify-center">
        <VoronoiPane
          width={width}
          height={height}
          className="rounded-2xl border border-slate-800 w-[600px] h-[600px]"
        />
      </div>
    </div>
  );
}

function DistanceFieldCard() {
  const width = 600;
  const height = 600;
  const { state } = useTreeDanglerState();

  return (
    <div className="rounded-3xl border border-rose-900/40 bg-slate-900/60 p-6 shadow-2xl shadow-black/40">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-rose-300">
            Module 3 · Checkpoints 5.2–5.4
          </p>
          <h2 className="text-2xl font-semibold text-white">
            Distance Transform
          </h2>
          <p className="text-sm text-slate-300">
            Shrink → grow pipeline with optional noise, visualized as a grayscale mask that feeds tracing for the next phase.
          </p>
        </div>
        <div className="text-xs text-right text-slate-400">
          {state.distanceField && state.distanceFieldDimensions
            ? `${state.distanceFieldDimensions.width}×${state.distanceFieldDimensions.height}`
            : "Not ready"}
        </div>
      </div>
      <div className="mt-6 flex justify-center">
        <DistanceFieldPane
          width={width}
          height={height}
          className="w-[600px]"
        />
      </div>
    </div>
  );
}

function TracedPolygonsCard() {
  const width = 600;
  const height = 600;
  const { state } = useTreeDanglerState();

  return (
    <div className="rounded-3xl border border-amber-900/40 bg-slate-900/60 p-6 shadow-2xl shadow-black/40">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-amber-300">
            Module 4 · Traced Pieces
          </p>
          <h2 className="text-2xl font-semibold text-white">Polygon Output</h2>
          <p className="text-sm text-slate-300">
            Distance-mask raster vectorized into discrete pieces; each polygon gets a deterministic random color.
          </p>
        </div>
        <div className="text-xs text-right text-slate-400">
          {state.piecePolygons.length
            ? `${state.piecePolygons.length} piece${state.piecePolygons.length === 1 ? "" : "s"}`
            : "Tracing pending"}
        </div>
      </div>
      <div className="mt-6 flex justify-center">
        <TracedPolygonsPane
          width={width}
          height={height}
          className="rounded-2xl border border-slate-800 w-[600px] h-[600px]"
        />
      </div>
    </div>
  );
}

function ConnectorsCard() {
  const width = 600;
  const height = 600;
  const { state, dispatch } = useTreeDanglerState();

  return (
    <div className="rounded-3xl border border-sky-900/40 bg-slate-900/60 p-6 shadow-2xl shadow-black/40">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-sky-300">
            Module 5 · Connectors
          </p>
          <h2 className="text-2xl font-semibold text-white">Connector Editor</h2>
          <p className="text-sm text-slate-300">
            Works like the segment editor but draws vertical connectors with a fixed physical length.
          </p>
        </div>
        <div className="text-xs text-right text-slate-400">
          {state.connectors.length
            ? `${state.connectors.length} connector${state.connectors.length === 1 ? "" : "s"}`
            : "No connectors yet"}
        </div>
      </div>
      <div className="mt-6 flex flex-col items-center gap-4">
        <ConnectorsPane
          width={width}
          height={height}
          className="rounded-2xl border border-slate-800 w-[600px] h-[600px]"
        />
        <label className="flex w-full max-w-sm flex-col gap-2 text-xs text-slate-300">
          <span className="flex items-center justify-between uppercase tracking-[0.3em] text-slate-500">
            Connector length <span>{state.connectorLength.toFixed(1)} mm</span>
          </span>
          <input
            type="number"
            min={2}
            step={0.5}
            value={state.connectorLength}
            onChange={(event) =>
              dispatch({ type: "SET_CONNECTOR_LENGTH", payload: Number(event.target.value) })
            }
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
          />
        </label>
      </div>
    </div>
  );
}

function TestPageContent() {
  const { state } = useTreeDanglerState();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-12">
        <header className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">
            Tree Dangler
          </p>
          <h1 className="text-4xl font-semibold text-slate-50 sm:text-5xl">
            Dev Playground
          </h1>
          <p className="text-base text-slate-300 sm:text-lg">
            Tailwind is wired up for the standalone demo. Every canvas treats{" "}
            <span className="font-semibold text-emerald-300">1 px</span> as{" "}
            <span className="font-semibold text-emerald-300">0.2 mm</span>, so
            the rulers + grid double-check physical scale before SVG export.
          </p>
          <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs text-emerald-200">
            State initialized: {state.mask.points.length} mask points,{" "}
            {state.segments.length} segments
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <MaskPaneCard />
          <SegmentPaneCard />
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <VoronoiPaneCard />
          <DistanceFieldCard />
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <TracedPolygonsCard />
          <ConnectorsCard />
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <CanvasDemo />
        </section>

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {panes.map((pane) => (
            <article
              key={pane.title}
              className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/70 to-slate-900/30 p-6 shadow-2xl shadow-slate-950/50"
            >
              <h2 className="text-xl font-semibold text-white">{pane.title}</h2>
              <p className="mt-2 text-sm text-slate-300">{pane.description}</p>
              <div className="mt-6 h-24 rounded-xl border border-dashed border-slate-700 bg-slate-900/60" />
            </article>
          ))}
        </section>

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {panes.map((pane) => (
            <article
              key={pane.title}
              className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/70 to-slate-900/30 p-6 shadow-2xl shadow-slate-950/50"
            >
              <h2 className="text-xl font-semibold text-white">{pane.title}</h2>
              <p className="mt-2 text-sm text-slate-300">{pane.description}</p>
              <div className="mt-6 h-24 rounded-xl border border-dashed border-slate-700 bg-slate-900/60" />
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-emerald-300">
            Build Notes
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {callouts.map((label) => (
              <span
                key={label}
                className="rounded-full border border-emerald-500/30 px-4 py-1 text-xs text-emerald-200"
              >
                {label}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-300">
            Swap this layout for live panes as we hit new checkpoints.
          </p>
        </section>
      </div>
    </div>
  );
}

export default function TestPage() {
  return (
    <TreeDanglerProvider>
      <TestPageContent />
    </TreeDanglerProvider>
  );
}
