# Tree Dangler – Implementation Plan for Claude

This is a concrete plan for implementing **Tree Dangler** as:

1. A **standalone dev app** with a Tailwind-styled test page.
2. An **embeddable React library** that can be imported into another app (e.g. a Next.js blog).

All panes share a central application state but can be rendered in **any order**.

---

## 0. Goals & Constraints

- **Single codebase** that:
  - Exposes a **React library** (core components + state) via `src/lib`.
  - Includes a **standalone dev/test page** via `src/demo`, using Tailwind CSS.
- **Embeddable in a Next.js app:**
  - The main entry is a React component that can be imported into `app` or `pages`.
  - Avoid direct `window/document` access at module scope.
- **Pane architecture:**
  - Each pane is a React component, reading/writing **shared state** via a provider/store.
  - Panes do not hard-code layout; any React parent can arrange them.
- **Modules:**
  - 0: Mask editor
  - 1: Segment input editor
  - 2: Voronoi generation
  - 3: Distance field + threshold + noise
  - 4: Bitmap → polygons
  - 5: Connector editor
  - 6: Physics simulation with matter-js
  - 7: SVG export with connector holes

---

## 1. Project Structure

Use a simple React+TS setup (Vite is fine).

### 1.1 Directory Layout

```text
root/
  package.json
  vite.config.ts
  tailwind.config.cjs
  postcss.config.cjs
  tsconfig.json
  src/
    lib/        ← embeddable library
      index.ts
      types.ts
      state/
        store.ts
      logic/
        mask.ts
        segments.ts
        voronoi.ts
        distanceField.ts
        tracing.ts
        connectors.ts
        simulation.ts
        svgExport.ts
      panes/
        MaskPane.tsx
        SegmentInputPane.tsx
        VoronoiPane.tsx
        DistanceFieldPane.tsx
        TracedPolygonsPane.tsx
        ConnectorsPane.tsx
        SimulationPane.tsx
        SvgExportPane.tsx
      ui/
        CanvasPane.tsx
        Controls.tsx
    demo/       ← standalone test app using Tailwind
      main.tsx
      TestPage.tsx
      PaneLayoutControls.tsx
      index.css  ← imports Tailwind
```

### 1.2 Library Bundling

Configure Vite library mode:

- `build.lib.entry = 'src/lib/index.ts'`
- `build.lib.name = 'TreeDangler'`

Export:

- `TreeDanglerApp` – fully wired default layout.
- `TreeDanglerProvider`, `useTreeDanglerState` – for custom layouts.
- Individual panes (`MaskPane`, `SegmentInputPane`, etc.).

---

## 2. Tech Stack & Dependencies

**Core React/TS:**
- `react`, `react-dom`
- `typescript`

**State & composition:**
- Use React Context + `useReducer` for portability and simplicity (no extra deps).

**Geometry & diagrams:**
- `d3-delaunay` – Voronoi/Delaunay (Module 2).
- `martinez-polygon-clipping` – polygon union/merge for Voronoi cell merging.

**Distance fields & noise:**
- Implement in-house Euclidean Distance Transform (Module 3) as pure TS in `logic/distanceField.ts`.
- `open-simplex-noise` – noise in distance field.

**Bitmap → polygons:**
- `imagetracerjs` (or similar) – bitmap tracing (Module 4).

**Physics simulation:**
- `matter-js` – rigid bodies + constraints (Module 6).

**Styling:**
- Tailwind CSS – test page (`src/demo`) only.
- Library components use minimal inline styles/unstyled canvas so that host app controls look.

---

## 3. Shared Application State & API

### 3.1 Types

In `src/lib/types.ts`:

```typescript
export interface Point {
  x: number;
  y: number;
}

export interface LineSegment {
  id: string;
  start: Point;
  end: Point;
  text?: string;
}

export interface Polygon {
  id: string;
  points: Point[];
  meta?: Record<string, unknown>;
}

export type MaskPolygon = Polygon;

export interface Connector {
  id: string;
  a: Point;       // endpoint in world coordinates
  b: Point;       // endpoint in world coordinates
  length: number; // fixed length
  attachments: {
    endpoint: "a" | "b";
    polygonId: string;
    localPoint: Point; // polygon-local or world with a flag
  }[];
}

export interface TreeDanglerState {
  mask: MaskPolygon;
  segments: LineSegment[];
  voronoiPolygons: Polygon[];
  distanceField?: Float32Array;
  thresholdBitmap?: Uint8ClampedArray; // or boolean[][], same size as canvas
  piecePolygons: Polygon[];
  connectors: Connector[];
  // UI-level config
  distanceThreshold: number;
  noiseEnabled: boolean;
  noiseAmplitude: number;
  noiseScale: number;
  connectorLength: number;
}
```

### 3.2 State Store (Context + Reducer)

In `src/lib/state/store.ts`:

- `TreeDanglerProvider` and `useTreeDanglerState` hook.
- Reducer with actions like:
  - `SET_MASK`, `SET_SEGMENTS`, `SET_VORONOI_POLYGONS`, `SET_DISTANCE_FIELD`, `SET_PIECE_POLYGONS`, `SET_CONNECTORS`, `SET_DISTANCE_CONFIG`, etc.
- Derived computations triggered at the pane level (see §5–§11).

This ensures:
- All panes share the same state.
- Panes are independent of layout and can be rendered in any order by any parent.

### 3.3 Public Library Exports

In `src/lib/index.ts`:

```typescript
export * from "./types";
export * from "./state/store";
export * from "./panes/MaskPane";
export * from "./panes/SegmentInputPane";
export * from "./panes/VoronoiPane";
export * from "./panes/DistanceFieldPane";
export * from "./panes/TracedPolygonsPane";
export * from "./panes/ConnectorsPane";
export * from "./panes/SimulationPane";
export * from "./panes/SvgExportPane";

export { TreeDanglerApp } from "./TreeDanglerApp";
```

`TreeDanglerApp` is a convenience component that wires provider + default pane order.

---

## 4. Shared Canvas & UI Components

### 4.1 CanvasPane

In `src/lib/ui/CanvasPane.tsx`:

Abstract common canvas setup for all panes.

**Responsibilities:**
- Handle device pixel ratio / resizing.
- Provide `onDraw(ctx: CanvasRenderingContext2D)` callback.
- Normalize pointer events: `onPointerDown`, `onPointerMove`, `onPointerUp`.
- Optional `onKeyDown` for delete etc. (the demo page can give it focus).

**API example:**

```typescript
interface CanvasPaneProps {
  width: number;
  height: number;
  onDraw: (ctx: CanvasRenderingContext2D) => void;
  onPointerDown?: (e: PointerEventData) => void;
  onPointerMove?: (e: PointerEventData) => void;
  onPointerUp?: (e: PointerEventData) => void;
  tabIndex?: number;
  className?: string; // used by demo/test page to add Tailwind classes
}
```

`PointerEventData` is a small type with `x`, `y`, `buttons`, etc. in canvas coordinates.

### 4.2 Lightweight Controls

`src/lib/ui/Controls.tsx` can contain small reusable components:
- Slider (`<input type="range" />`)
- Number input, checkbox.
- No Tailwind here; use basic HTML so host app can style.

---

## 5. Module 0 – Mask Editor Pane

**Libraries:** none beyond React.

**Logic (`logic/mask.ts`):**
- Point/segment hit-testing.
- Functions:
  - `hitTestMaskPoint(mask: MaskPolygon, p: Point, radius: number)`
  - `hitTestMaskSegment(mask: MaskPolygon, p: Point, tolerance: number)`
  - `insertPointIntoSegment(mask, segmentIndex, point)`
  - `deleteMaskPoint(mask, pointIndex)`
- Guarantee min 3 points.

**UI (`panes/MaskPane.tsx`):**
- Uses `CanvasPane` with width/height props (passed from parent).
- On render:
  - Draw filled polygon (semi-transparent), outline, and points.
- Interactions:
  - Click near segment → insert new point at click location.
  - Click near point → select.
  - Delete key or button → delete selected point (if >3 points).
- Starts with a default triangle in initial state in provider.

---

## 6. Module 1 – Segment Input Pane

**Libraries:**
- Point-in-polygon: `point-in-polygon` or simple winding test implemented in `logic/mask.ts`.

**Logic (`logic/segments.ts`):**
- Functions:
  - `isPointInsideMask(point, mask)`
  - `createDefaultSegmentAtPoint(mask, clickPoint)`
  - `moveSegment(segment, delta, mask)`
  - `moveEndpoint(segment, endpoint, newPoint, mask)`
- Enforce rule: no endpoint may be outside mask (prevent or clamp moves).

**UI (`panes/SegmentInputPane.tsx`):**
- Uses `CanvasPane`.
- Draw:
  - Mask polygon (maybe faint).
  - Line segments with labels.
- Interactions:
  - Click empty area → create new horizontal segment (e.g. ±20 px from click) if both endpoints inside mask.
  - Click near segment body → select & drag whole segment.
  - Click near endpoint → drag endpoint with mask constraints.
  - Second click on selected segment → show inline text input overlay (absolute-positioned input over canvas).
  - Delete key → remove selected segment.

---

## 7. Module 2 – Voronoi Polygon Builder

**Libraries:**
- `d3-delaunay` – compute Voronoi.
- `martinez-polygon-clipping` – union polygons.

**Logic (`logic/voronoi.ts`):**

Steps:
1. Sample points along each segment:
   - `sampleSegmentPoints(segment, spacing = 10): { point: Point; segmentId: string }[]`.
   - Build point arrays and mapping from index → segmentId.
2. Use `Delaunay.from(points)`:
   - Build Voronoi with a bounding box equal to mask bounding box or canvas bounds.
3. For each point (sample):
   - Extract its Voronoi cell polygon.
4. Group cells by segmentId:
   - For each group, union polygons using `martinez.union(...)`.
   - Output one or more merged polygons per segment.
5. Store result in `state.voronoiPolygons`.

**Display Pane (`panes/VoronoiPane.tsx`):**
- Read `voronoiPolygons` from state.
- Draw polygons in different colors or outlines for debugging.
- This pane has no inputs, just visualization.

---

## 8. Module 3 – Distance Field & Regions

**Libraries:**
- Custom distance transform in `logic/distanceField.ts`.
- `open-simplex-noise` for noise.

**Logic (`logic/distanceField.ts`):**

**Rasterization:**
- Offscreen canvas sized like display (e.g. 400×400).
- Fill white.
- Draw `state.voronoiPolygons` in black.
- Overlay mask: outside mask = black.
- Get ImageData → boolean or 0/1 array of "black pixels".

**Euclidean Distance Transform:**
- Implement a standard EDT over this bitmap:
- Use 2-pass (or 3-pass) algorithm storing distances in a `Float32Array`.

**Noise application:**
- If `noiseEnabled`, compute `noise(x * scale, y * scale)` using `open-simplex-noise` and add `noiseAmplitude * noise`.

**Thresholding:**
- Build `thresholdBitmap` where `distance >= threshold` → inside region.
- Store `distanceField` + `thresholdBitmap` in state.

**Pane (`panes/DistanceFieldPane.tsx`):**

**Controls (using basic Inputs):**
- Slider/input for threshold.
- Toggles/inputs for `noiseEnabled`, `noiseAmplitude`, `noiseScale`.

**On changes:**
- Dispatch actions to update config.
- Recompute distance field and thresholded bitmap via `logic/distanceField`.

**Draw:**
- Visualize thresholded regions on canvas (e.g. white region on black background).

---

## 9. Module 4 – Bitmap → Polygons

**Libraries:**
- `imagetracerjs` (or a similar library) for tracing.

**Logic (`logic/tracing.ts`):**
- Take `thresholdBitmap` or reconstructed ImageData.
- Convert to a minimal RGB bitmap (white region, black background) accepted by `imagetracerjs`.
- Run tracer:
  - Receive one or more paths.
  - Convert each path to `Polygon`:
    - Simplify points if necessary to control vertex count.
    - Filter out tiny polygons based on area threshold.
- Store results in `state.piecePolygons`.

**Pane (`panes/TracedPolygonsPane.tsx`):**
- Display: show polygons from `state.piecePolygons` overlaid with mask.
- No extra controls.

---

## 10. Module 5 – Connectors Pane

**Libraries:** none beyond React & internal logic.

**Logic (`logic/connectors.ts`):**
- Maintains connectors list and endpoint computations.
- Functions:
  - `createConnectorStart(point, defaultLength)`
  - `updateConnectorPreview(connector, pointerPos)`: compute endpoint with fixed length:
    - `dir = normalize(pointerPos - start)` → `end = start + dir * length`.
  - `finalizeConnector(start, end)`
- Attachment detection:
  - Check if endpoint is near polygon edge.
  - If yes, store attachments with `polygonId` and local offset.

**Pane (`panes/ConnectorsPane.tsx`):**

**Visuals:**
- Draw `piecePolygons`.
- Draw connectors.

**Interactions:**
- Click to start placing a connector (set `a`).
- Move pointer → show preview of `b` at fixed length.
- Second click → finalize.
- Drag endpoint:
  - Recompute endpoint along direction from opposite point with fixed length.
- Attachment:
  - Snap endpoints to polygon edges within tolerance and record attachments.
- Delete key → remove selected connector.

---

## 11. Module 6 – Simulation Pane (matter-js)

**Libraries:**
- `matter-js`.

**Logic (`logic/simulation.ts`):**
- Build a simulation world from state:
  - `piecePolygons` → static description.
  - `connectors` → constraints.
- Functions:
  - `createSimulationWorld(state: TreeDanglerState)` → `{ engine, world, bodies }`.
  - Provide hooks to step simulation and read out body positions.

**Details:**
- For each polygon:
  - Use `Matter.Bodies.fromVertices` with `piecePolygon.points`.
- For each connector:
  - For each endpoint a/b:
    - If attached: compute anchor point/offset on the polygon body.
    - If free: create static small body at world coordinate.
  - Create `Matter.Constraint` with relatively high stiffness (stiff spring).
- Expose methods to:
  - Step engine by a fixed timestep.
  - Reset world from current state.

**Pane (`panes/SimulationPane.tsx`):**
- Uses `useEffect` with `requestAnimationFrame` loop to:
  - Step engine.
  - Redraw bodies + connectors on canvas.
- Controls:
  - Play/pause.
  - Reset.
- Interaction (optional):
  - Use `Matter.MouseConstraint` to drag bodies.

---

## 12. Module 7 – SVG Export Pane

**Libraries:** none beyond built-in JS.

**Logic (`logic/svgExport.ts`):**
- Accepts `piecePolygons`, `connectors`, plus config for scale (pixels→mm).

**Steps:**
1. Define a scale factor: e.g. 1 canvas unit = 1 px, and `pxPerMm = 3.78` (or config).
2. Compute overall bounds from polygons.
3. Build `<svg>` string:
   - `<svg width="Wmm" height="Hmm" viewBox="0 0 widthPx heightPx">`.
4. For each polygon:
   - Convert points to path `d="M x0 y0 L x1 y1 ... Z"`.
5. For each connector endpoint:
   - Add `<circle cx="..." cy="..." r="holeRadius" />` where `holeRadius = 1 mm` (for 2 mm diameter).
6. Return string and optionally a Blob builder helper for the demo.

**Pane (`panes/SvgExportPane.tsx`):**

**Buttons:**
- "Generate SVG Preview" – show text area or small preview of SVG path count.
- "Download SVG" – build Blob and call `URL.createObjectURL` for `<a download>` (in demo app).

**Note:** Library should only create the string; actual document/DOM operations (blob URLs) can be implemented in the demo page or by the host app.

---

## 13. Standalone Test Page with Tailwind

**Requirements:**
- Fully standalone dev app with Tailwind.
- Panes connected via the same state.
- Layout can be rearranged.

### 13.1 Tailwind Setup

`tailwind.config.cjs`:
- Content paths: `["./index.html", "./src/**/*.{ts,tsx}"]`.

`src/demo/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 13.2 TestPage.tsx (demo)

In `src/demo/TestPage.tsx`:

- Wrap the page in `TreeDanglerProvider`.
- Maintain local state: `paneOrder: string[]` e.g.:

```typescript
const [paneOrder, setPaneOrder] = useState<string[]>([
  "mask",
  "segments",
  "voronoi",
  "distance",
  "traced",
  "connectors",
  "simulation",
  "svg",
]);
```

Render panes dynamically:

```typescript
const paneComponents: Record<string, React.ReactNode> = {
  mask: <MaskPane width={400} height={400} />,
  segments: <SegmentInputPane width={400} height={400} />,
  voronoi: <VoronoiPane width={400} height={400} />,
  distance: <DistanceFieldPane width={400} height={400} />,
  traced: <TracedPolygonsPane width={400} height={400} />,
  connectors: <ConnectorsPane width={400} height={400} />,
  simulation: <SimulationPane width={400} height={400} />,
  svg: <SvgExportPane width={400} height={400} />,
};
```

Layout using Tailwind:

```tsx
<div className="min-h-screen bg-slate-950 text-slate-100">
  <header className="p-4 border-b border-slate-800 flex justify-between items-center">
    <h1 className="text-xl font-semibold">Tree Dangler – Dev Playground</h1>
    {/* Pane layout controls component */}
    <PaneLayoutControls paneOrder={paneOrder} setPaneOrder={setPaneOrder} />
  </header>

  <main className="p-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {paneOrder.map((paneKey) => (
      <div key={paneKey} className="bg-slate-900/70 rounded-xl p-2 shadow">
        {paneComponents[paneKey]}
      </div>
    ))}
  </main>
</div>
```

### 13.3 Pane Layout Controls

In `PaneLayoutControls.tsx`:

- Minimal controls using Tailwind:
  - Simple `<select>` + up/down buttons or drag-and-drop with local state.
  - You can optionally use `@dnd-kit/core` for drag-and-drop reordering, but not required.

**Result:**

During development, you get a Tailwind-styled playground where you can:
- See all panes.
- Reorder them without touching their implementation.
- Verify shared state flows correctly.

---

## 14. Embedding in a Next.js Blog

To use this library in a Next.js app (assuming Next 13+ with app router):

1. Install library (once published or via `npm link` locally).

2. Ensure the component is rendered in a client component:

```typescript
"use client";

import { TreeDanglerProvider, MaskPane, SegmentInputPane, ... } from "tree-dangler";

export default function TreeDanglerPage() {
  return (
    <TreeDanglerProvider>
      <div className="grid gap-4 md:grid-cols-2">
        <MaskPane width={400} height={400} />
        <SegmentInputPane width={400} height={400} />
        {/* you can choose subset / any order */}
      </div>
    </TreeDanglerProvider>
  );
}
```

3. No Tailwind dependency in the library itself:
   - The host app (your blog) can style layout with Tailwind or any other method.

4. Make sure:
   - `matter-js` and canvas interactions only touch `window`/`document` inside `useEffect`, not at module load time (to be safe with SSR).

---

## 15. Iterative Implementation Plan

This plan breaks down implementation into testable increments. Each checkpoint should be verified in the demo page before moving forward.

---

### Phase 1: Foundation + Demo Infrastructure

**Checkpoint 1.1: Project Bootstrap**
- Create Vite + React + TypeScript project structure
- Install base dependencies: `react`, `react-dom`, `typescript`
- Configure `tsconfig.json` with proper paths
- Create directory structure: `src/lib/`, `src/demo/`
- **Test:** Verify Vite dev server runs successfully

**Checkpoint 1.2: Tailwind Setup for Demo**
- Install Tailwind CSS and dependencies
- Configure `tailwind.config.cjs` with content paths
- Create `src/demo/index.css` with Tailwind imports
- Create basic `src/demo/main.tsx` entry point
- Create minimal `src/demo/TestPage.tsx` with dark theme layout
- **Test:** Verify demo page renders with Tailwind styling

**Checkpoint 1.3: Base Types + State Structure**
- Create `src/lib/types.ts` with:
  - `Point`, `LineSegment`, `Polygon`, `MaskPolygon` types
  - `TreeDanglerState` interface (all fields, even if some unused initially)
- Create `src/lib/state/store.ts`:
  - `TreeDanglerProvider` with React Context + `useReducer`
  - Initial state with default triangle mask
  - Basic actions: `SET_MASK`, `SET_SEGMENTS`
  - `useTreeDanglerState` hook
- **Test:** Wrap `TestPage` in provider, verify no errors

**Checkpoint 1.4: Shared Canvas Component**
- Create `src/lib/ui/CanvasPane.tsx`:
  - Handle canvas sizing with device pixel ratio
  - Implement `onDraw` callback
  - Normalize pointer events (down/move/up) to canvas coordinates
  - Support `onKeyDown` for keyboard events
  - Accept `className` prop for Tailwind styling
- Create test pane in demo that draws a simple rectangle
- **Test:** Verify canvas renders correctly, pointer events log to console

---

### Phase 2: Module 0 - Mask Editor (First Interactive Pane)

**Checkpoint 2.1: Mask Logic**
- Create `src/lib/logic/mask.ts`:
  - `hitTestMaskPoint(mask, point, radius)` - returns point index or -1
  - `hitTestMaskSegment(mask, point, tolerance)` - returns segment index or -1
  - `insertPointIntoSegment(mask, segmentIndex, point)` - returns new mask
  - `deleteMaskPoint(mask, pointIndex)` - returns new mask (min 3 points)
- Write simple unit tests or manual verification in demo
- **Test:** Call functions with test data, verify correct return values

**Checkpoint 2.2: Mask Pane UI**
- Create `src/lib/panes/MaskPane.tsx`:
  - Read mask from state
  - Draw filled polygon (semi-transparent), outline, points
  - Implement click to select point
  - Implement click on segment to insert point
  - Implement delete key handler
- Add `MaskPane` to demo page in a grid cell
- **Test:** Interact with mask - add/remove points, verify minimum 3 points enforced

**Checkpoint 2.3: Mask State Integration**
- Add `SET_MASK` action to reducer
- Connect MaskPane edits to dispatch actions
- Verify state updates correctly
- **Test:** Edit mask, check React DevTools to see state updates

---

### Phase 3: Module 1 - Segment Input Pane

**Checkpoint 3.1: Segment Logic**
- Create `src/lib/logic/segments.ts`:
  - `isPointInsideMask(point, mask)` - point-in-polygon test
  - `createDefaultSegmentAtPoint(click, mask)` - returns new segment if valid
  - `hitTestSegment(segments, point)` - returns segment index or -1
  - `hitTestEndpoint(segments, point, radius)` - returns `{segmentIndex, endpoint}` or null
  - `moveSegment(segment, delta, mask)` - returns updated segment if both endpoints stay inside
  - `moveEndpoint(segment, endpoint, newPoint, mask)` - returns updated segment if valid
- **Test:** Verify hit-testing and movement validation logic with test cases

**Checkpoint 3.2: Basic Segment Rendering**
- Create `src/lib/panes/SegmentInputPane.tsx`:
  - Read mask + segments from state
  - Draw faint mask outline
  - Draw all segments as lines
  - Draw endpoints as circles
- Add `SET_SEGMENTS` action to reducer
- Add `SegmentInputPane` to demo page
- **Test:** Manually add test segments to initial state, verify they render

**Checkpoint 3.3: Segment Interaction - Creation & Selection**
- Implement click empty area to create new segment
- Implement click segment to select
- Implement click endpoint to select endpoint
- Show visual feedback for selection (highlight)
- **Test:** Click to create segments, click to select them

**Checkpoint 3.4: Segment Interaction - Movement & Deletion**
- Implement drag whole segment
- Implement drag individual endpoints
- Enforce mask constraints during dragging
- Implement delete key to remove selected segment
- **Test:** Drag segments, verify mask constraints work, delete segments

**Checkpoint 3.5: Segment Text Labels**
- Add text rendering over segments
- Implement double-click or second click to edit text
- Create absolute-positioned `<input>` overlay for editing
- Update segment text in state
- **Test:** Add/edit text labels on segments

---

### Phase 4: Module 2 - Voronoi Visualization

**Checkpoint 4.1: Voronoi Dependencies & Sampling**
- Install `d3-delaunay` and `martinez-polygon-clipping`
- Create `src/lib/logic/voronoi.ts`:
  - `sampleSegmentPoints(segment, spacing)` - returns array of points
  - `buildPointMap(segments)` - returns `{points: Point[], segmentIds: string[]}`
- **Test:** Call with test segments, verify point sampling works correctly

**Checkpoint 4.2: Voronoi Computation**
- In `voronoi.ts`, implement:
  - `computeVoronoi(segments, bounds)` - uses Delaunay/Voronoi
  - Extract cells for each sampled point
  - Group cells by segmentId
  - Merge polygons using `martinez.union()`
- Add `SET_VORONOI_POLYGONS` action to reducer
- **Test:** Compute voronoi from test segments, log output polygons

**Checkpoint 4.3: Voronoi Display Pane**
- Create `src/lib/panes/VoronoiPane.tsx`:
  - Read `voronoiPolygons` from state
  - Draw each polygon with different colors/outlines
  - Read-only, no interactions
- Add button in `SegmentInputPane` or demo page to trigger voronoi computation
- Add `VoronoiPane` to demo page
- **Test:** Create segments, click to compute voronoi, verify visualization updates

---

### Phase 5: Module 3 - Distance Field & Thresholding

**Checkpoint 5.1: Distance Field - Rasterization**
- Install `open-simplex-noise`
- Create `src/lib/logic/distanceField.ts`:
  - `rasterizeToCanvas(voronoiPolygons, mask, width, height)` - returns ImageData
  - Draw voronoi polygons in black, apply mask (outside = black)
  - Return boolean array of "black pixels"
- **Test:** Call with test data, verify bitmap looks correct (can write to temp canvas)

**Checkpoint 5.2: Distance Field - EDT Implementation**
- In `distanceField.ts`, implement:
  - `computeEDT(bitmap, width, height)` - Euclidean Distance Transform
  - Use 2-pass or 3-pass algorithm
  - Return `Float32Array` of distances
- **Test:** Verify distance values are reasonable for test bitmaps

**Checkpoint 5.3: Distance Field - Noise & Threshold**
- In `distanceField.ts`, implement:
  - `applyNoise(distanceField, config)` - modifies distances with simplex noise
  - `applyThreshold(distanceField, threshold, width, height)` - returns boolean bitmap
- Add state for: `distanceThreshold`, `noiseEnabled`, `noiseAmplitude`, `noiseScale`
- Add `SET_DISTANCE_CONFIG`, `SET_DISTANCE_FIELD`, `SET_THRESHOLD_BITMAP` actions
- **Test:** Verify noise application and thresholding logic

**Checkpoint 5.4: Distance Field Display Pane**
- Create `src/lib/ui/Controls.tsx` with basic `Slider`, `Checkbox`, `NumberInput`
- Create `src/lib/panes/DistanceFieldPane.tsx`:
  - Display thresholded regions (white on black)
  - Controls for threshold, noise enable, amplitude, scale
  - Button to recompute distance field
- Add `DistanceFieldPane` to demo page
- **Test:** Adjust sliders, verify real-time or on-demand updates to visualization

---

### Phase 6: Module 4 - Bitmap Tracing

**Checkpoint 6.1: Tracing Logic**
- Install `imagetracerjs` (or alternative)
- Create `src/lib/logic/tracing.ts`:
  - `traceBitmap(thresholdBitmap, width, height)` - converts to ImageData for tracer
  - Run tracer, convert paths to `Polygon[]`
  - Implement basic polygon simplification
  - Filter tiny polygons by area threshold
- Add `SET_PIECE_POLYGONS` action
- **Test:** Trace test bitmap, verify polygon output

**Checkpoint 6.2: Traced Polygons Display Pane**
- Create `src/lib/panes/TracedPolygonsPane.tsx`:
  - Read `piecePolygons` from state
  - Draw polygons with outlines
  - Optionally overlay mask for reference
  - Button to trigger tracing
- Add `TracedPolygonsPane` to demo page
- **Test:** Compute distance field → trace → verify clean polygons appear

---

### Phase 7: Module 5 - Connectors Editor

**Checkpoint 7.1: Connector Logic**
- Create `src/lib/logic/connectors.ts`:
  - `createConnector(start, length, angle)` - returns `Connector`
  - `updateConnectorEndpoint(connector, endpoint, newPos, fixedLength)` - enforces length
  - `detectAttachment(point, polygons, tolerance)` - returns attachment info or null
- Add `Connector` type to `types.ts` (if not already)
- Add `connectorLength` to state, `SET_CONNECTORS` action
- **Test:** Verify fixed-length math works correctly

**Checkpoint 7.2: Connectors Display & Placement**
- Create `src/lib/panes/ConnectorsPane.tsx`:
  - Draw `piecePolygons` as reference
  - Draw existing connectors as lines
  - Implement click to start connector placement
  - Show preview line at fixed length following cursor
  - Second click to finalize
- Add `ConnectorsPane` to demo page
- **Test:** Place connectors, verify fixed length constraint

**Checkpoint 7.3: Connector Editing & Attachment**
- Implement click endpoint to drag/reposition (maintains length)
- Implement attachment detection and snapping to polygon edges
- Visual feedback for attachments (different color/marker)
- Implement delete key for selected connector
- Store attachment info in connector state
- **Test:** Drag endpoints, verify snapping, verify attachments saved

---

### Phase 8: Module 6 - Physics Simulation

**Checkpoint 8.1: Simulation World Setup**
- Install `matter-js`
- Create `src/lib/logic/simulation.ts`:
  - `createSimulationWorld(piecePolygons, connectors, options)` - returns engine/world
  - Create rigid bodies from polygons using `Matter.Bodies.fromVertices`
  - Handle body creation errors gracefully (some polygons may be invalid)
- **Test:** Create world with test polygons, verify no errors

**Checkpoint 8.2: Connector Constraints**
- In `simulation.ts`, extend world creation:
  - For each connector, determine attachment points on bodies
  - Create static anchor bodies for free endpoints
  - Create `Matter.Constraint` with appropriate stiffness
- **Test:** Verify constraints connect bodies correctly

**Checkpoint 8.3: Simulation Pane - Basic Animation**
- Create `src/lib/panes/SimulationPane.tsx`:
  - Create simulation world in `useEffect`
  - Use `requestAnimationFrame` to step engine and redraw
  - Draw bodies (polygons) in their current positions/rotations
  - Draw connectors between attachment points
- Add `SimulationPane` to demo page
- **Test:** Verify simulation runs, bodies respond to gravity

**Checkpoint 8.4: Simulation Controls & Interaction**
- Add play/pause button
- Add reset button (rebuilds world from current state)
- Optional: Add `Matter.MouseConstraint` for dragging bodies
- **Test:** Pause/resume, reset, drag bodies if implemented

---

### Phase 9: Module 7 - SVG Export

**Checkpoint 9.1: SVG Generation Logic**
- Create `src/lib/logic/svgExport.ts`:
  - `generateSVG(piecePolygons, connectors, config)` - returns SVG string
  - Compute bounds from polygons
  - Convert polygons to SVG `<path>` elements
  - Add `<circle>` elements for connector holes (2mm diameter)
  - Support configurable scale (pixels to mm)
- **Test:** Generate SVG string, verify format is valid (inspect in browser)

**Checkpoint 9.2: SVG Export Pane**
- Create `src/lib/panes/SvgExportPane.tsx`:
  - Button to generate SVG preview (show path count, dimensions)
  - Button to download SVG (create Blob, trigger download)
  - Optional: render SVG preview inline
- Add `SvgExportPane` to demo page
- **Test:** Export SVG, open in vector editor, verify correct geometry and holes

---

### Phase 10: Polish & Embeddability

**Checkpoint 10.1: Demo Page Layout Controls**
- Create `src/demo/PaneLayoutControls.tsx`:
  - Simple UI to reorder panes
  - Could be dropdown + up/down buttons, or drag-and-drop
- Update `TestPage.tsx` to render panes in configurable order
- **Test:** Reorder panes, verify layout updates correctly

**Checkpoint 10.2: Library Exports**
- Create `src/lib/TreeDanglerApp.tsx` - convenience component with default layout
- Update `src/lib/index.ts` to export:
  - All types
  - State provider and hook
  - All panes
  - `TreeDanglerApp`
- **Test:** Verify exports work via demo imports

**Checkpoint 10.3: Library Build Configuration**
- Configure Vite library mode in `vite.config.ts`
- Set `build.lib.entry`, `build.lib.name`, output formats
- Configure externals (React, React-DOM)
- **Test:** Run build, verify output bundle structure

**Checkpoint 10.4: SSR Safety & Documentation**
- Audit all canvas/browser API usage - ensure inside `useEffect`
- Test in Next.js app (create minimal test page)
- Update `CLAUDE.md` with:
  - Build/dev commands
  - Architecture overview
  - Library usage examples
  - Next.js integration notes
- **Test:** Verify library works in Next.js without SSR errors

---

### Testing Strategy

After each checkpoint:
1. Run dev server: `npm run dev`
2. Open browser to demo page
3. Verify specific functionality works as expected
4. Fix issues before moving to next checkpoint
5. Commit working code

This ensures each piece is solid before building on top of it.
