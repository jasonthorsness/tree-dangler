import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  TreeDanglerState,
  MaskPolygon,
  LineSegment,
  Polygon,
  BinaryBitmap,
} from "../types";
import { mmToPx, resizeConnectorFromStart } from "../logic/connectors";
import {
  decodeSceneFromHash,
  deserializeScene,
  type NormalizedScene,
} from "../logic/sceneSerialization";

// Action types
type Action =
  | { type: "SET_MASK"; payload: MaskPolygon }
  | { type: "SET_SEGMENTS"; payload: TreeDanglerState["segments"] }
  | {
      type: "SET_VORONOI_POLYGONS";
      payload: TreeDanglerState["voronoiPolygons"];
    }
  | { type: "SET_VORONOI_RASTER"; payload: BinaryBitmap | undefined }
  | {
      type: "SET_DISTANCE_FIELD";
      payload: {
        data?: Float32Array;
        width?: number;
        height?: number;
        max?: number;
      };
    }
  | { type: "SET_DISTANCE_PREVIEW"; payload: BinaryBitmap | undefined }
  | { type: "SET_THRESHOLD_BITMAP"; payload: Uint8ClampedArray }
  | { type: "SET_PIECE_POLYGONS"; payload: TreeDanglerState["piecePolygons"] }
  | { type: "SET_CONNECTORS"; payload: TreeDanglerState["connectors"] }
  | {
      type: "SET_DISTANCE_CONFIG";
      payload: Partial<
        Pick<TreeDanglerState, "gap" | "round" | "noiseAmplitude" | "noiseSeed">
      >;
    }
  | { type: "SET_CONNECTOR_LENGTH"; payload: number }
  | { type: "SET_SVG_STRING"; payload: string };

// Initial state; populated from default_scene.json on mount
const initialState: TreeDanglerState = {
  mask: { id: "default-mask", points: [] },
  segments: [],
  voronoiPolygons: [],
  voronoiRaster: undefined,
  piecePolygons: [],
  connectors: [],
  gap: 1.2,
  round: 2,
  noiseAmplitude: 5,
  noiseSeed: 0,
  connectorLength: 8,
  distancePreview: undefined,
  svgString: "",
};

// Reducer
function reducer(state: TreeDanglerState, action: Action): TreeDanglerState {
  switch (action.type) {
    case "SET_MASK":
      return { ...state, mask: action.payload };
    case "SET_SEGMENTS":
      return { ...state, segments: action.payload };
    case "SET_VORONOI_POLYGONS":
      return { ...state, voronoiPolygons: action.payload };
    case "SET_VORONOI_RASTER":
      return { ...state, voronoiRaster: action.payload };
    case "SET_DISTANCE_FIELD":
      return {
        ...state,
        distanceField: action.payload.data,
        distanceFieldDimensions: action.payload.data
          ? {
              width:
                action.payload.width ??
                state.distanceFieldDimensions?.width ??
                0,
              height:
                action.payload.height ??
                state.distanceFieldDimensions?.height ??
                0,
            }
          : undefined,
        distanceFieldMax: action.payload.data
          ? action.payload.max ?? state.distanceFieldMax
          : undefined,
      };
    case "SET_THRESHOLD_BITMAP":
      return { ...state, thresholdBitmap: action.payload };
    case "SET_PIECE_POLYGONS":
      return { ...state, piecePolygons: action.payload };
    case "SET_CONNECTORS":
      return { ...state, connectors: action.payload };
    case "SET_DISTANCE_CONFIG":
      return { ...state, ...action.payload };
    case "SET_DISTANCE_PREVIEW":
      return { ...state, distancePreview: action.payload };
    case "SET_SVG_STRING":
      return { ...state, svgString: action.payload };
    case "SET_CONNECTOR_LENGTH":
      return {
        ...state,
        connectorLength: action.payload,
        connectors: state.connectors.map((segment) =>
          resizeConnectorFromStart(segment, mmToPx(action.payload), state.mask)
        ),
      };
    default:
      return state;
  }
}

// Context
type TreeDanglerContextValue = {
  state: TreeDanglerState;
  dispatch: Dispatch<Action>;
};

const TreeDanglerContext = createContext<TreeDanglerContextValue | undefined>(
  undefined
);

function applyScene(
  scene: NormalizedScene,
  dispatch: Dispatch<Action>,
  opts?: { suppressHistory?: boolean }
) {
  dispatch({
    type: "SET_MASK",
    payload: scene.mask,
  });
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
  if (!opts?.suppressHistory && typeof window !== "undefined") {
    window.dispatchEvent(new Event("tree-dangler-push-undo"));
  }
}

// Provider component
export function TreeDanglerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Auto-load default scene from packaged JSON or URL hash
  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      if (typeof window !== "undefined") {
        const hashValue = window.location.hash.slice(1);
        if (hashValue) {
          const decoded = await decodeSceneFromHash(hashValue);
          if (decoded && !cancelled) {
            applyScene(decoded, dispatch, { suppressHistory: true });
            if (window.history?.replaceState) {
              window.history.replaceState(null, "", window.location.pathname + window.location.search);
            } else {
              window.location.hash = "";
            }
            return;
          }
        }
      }
      try {
        const resp = await fetch("/default_scene.json");
        const raw = await resp.json();
        const normalized = deserializeScene({
          mask: raw.mask,
          segments: raw.segments,
          connectors: raw.connectors,
          noise: raw.noise ?? {},
        });
        if (normalized && !cancelled) {
          applyScene(normalized, dispatch, { suppressHistory: true });
        }
      } catch (err) {
        console.error("Failed to load default scene", err);
      }
    };
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleHashChange = () => {
      const run = async () => {
        const hashValue = window.location.hash.slice(1);
        if (!hashValue) return;
        const decoded = await decodeSceneFromHash(hashValue);
        if (decoded) {
          applyScene(decoded, dispatch);
          if (window.history?.replaceState) {
            window.history.replaceState(
              null,
              "",
              window.location.pathname + window.location.search
            );
          } else {
            window.location.hash = "";
          }
        }
      };
      void run();
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [dispatch]);

  const gapPx = mmToPx(state.gap);
  const roundPx = mmToPx(state.round);
  useWorker(
    state.mask,
    state.segments,
    state.connectors,
    {
      shrinkThreshold: roundPx + gapPx / 2,
      roundThreshold: roundPx,
      noiseAmplitude: state.noiseAmplitude,
      noiseSeed: state.noiseSeed,
    },
    dispatch
  );

  return (
    <TreeDanglerContext.Provider value={{ state, dispatch }}>
      {children}
    </TreeDanglerContext.Provider>
  );
}

// Hook to access state and dispatch
export function useTreeDanglerState() {
  const context = useContext(TreeDanglerContext);
  if (!context) {
    throw new Error(
      "useTreeDanglerState must be used within a TreeDanglerProvider"
    );
  }
  return context;
}

interface VoronoiWorkerMessage {
  id: number;
  polygons?: Polygon[];
  voronoiRaster?: BinaryBitmap;
  distanceField?: {
    data: Float32Array;
    width: number;
    height: number;
    max: number;
  };
  distancePreview?: BinaryBitmap;
  piecePolygons?: Polygon[];
  svgString?: string;
  error?: string;
}

interface DistanceProcessingConfig {
  shrinkThreshold: number;
  roundThreshold: number;
  noiseAmplitude: number;
  noiseSeed: number;
}

function useWorker(
  mask: MaskPolygon,
  segments: LineSegment[],
  connectors: LineSegment[],
  config: DistanceProcessingConfig,
  dispatch: Dispatch<Action>
) {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const latestCompletedRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const worker = new Worker(
      new URL("../workers/voronoiWorker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<VoronoiWorkerMessage>) => {
      const {
        id,
        polygons,
        voronoiRaster,
        distanceField,
        distancePreview,
        piecePolygons,
        svgString,
        error,
      } = event.data;
      if (error) {
        console.error("Voronoi worker error:", error);
        return;
      }
      if (id < latestCompletedRef.current) {
        return;
      }
      latestCompletedRef.current = id;
      dispatch({ type: "SET_VORONOI_POLYGONS", payload: polygons ?? [] });
      dispatch({ type: "SET_VORONOI_RASTER", payload: voronoiRaster });
      if (distanceField) {
        dispatch({
          type: "SET_DISTANCE_FIELD",
          payload: {
            data: distanceField.data,
            width: distanceField.width,
            height: distanceField.height,
            max: distanceField.max,
          },
        });
      } else {
        dispatch({ type: "SET_DISTANCE_FIELD", payload: {} });
      }
      dispatch({ type: "SET_DISTANCE_PREVIEW", payload: distancePreview });
      dispatch({ type: "SET_PIECE_POLYGONS", payload: piecePolygons ?? [] });
      dispatch({ type: "SET_SVG_STRING", payload: svgString ?? "" });
    };
    return () => {
      workerRef.current = null;
      worker.terminate();
    };
  }, [dispatch]);

  useEffect(() => {
    if (!workerRef.current) return;
    const id = requestIdRef.current + 1;
    requestIdRef.current = id;
    workerRef.current.postMessage({
      id,
      mask,
      segments,
      connectors,
      config,
    });
  }, [
    mask,
    segments,
    connectors,
    config.shrinkThreshold,
    config.roundThreshold,
    config.noiseAmplitude,
    config.noiseSeed,
  ]);
}
