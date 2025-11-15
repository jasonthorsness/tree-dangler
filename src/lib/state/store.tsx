import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import { TreeDanglerState, MaskPolygon } from '../types';

// Action types
type Action =
  | { type: 'SET_MASK'; payload: MaskPolygon }
  | { type: 'SET_SEGMENTS'; payload: TreeDanglerState['segments'] }
  | { type: 'SET_VORONOI_POLYGONS'; payload: TreeDanglerState['voronoiPolygons'] }
  | { type: 'SET_DISTANCE_FIELD'; payload: Float32Array }
  | { type: 'SET_THRESHOLD_BITMAP'; payload: Uint8ClampedArray }
  | { type: 'SET_PIECE_POLYGONS'; payload: TreeDanglerState['piecePolygons'] }
  | { type: 'SET_CONNECTORS'; payload: TreeDanglerState['connectors'] }
  | { type: 'SET_DISTANCE_CONFIG'; payload: Partial<Pick<TreeDanglerState, 'distanceThreshold' | 'noiseEnabled' | 'noiseAmplitude' | 'noiseScale'>> }
  | { type: 'SET_CONNECTOR_LENGTH'; payload: number };

// Initial state with a default triangle mask
const initialState: TreeDanglerState = {
  mask: {
    id: 'default-mask',
    points: [
      { x: 200, y: 100 },
      { x: 100, y: 300 },
      { x: 300, y: 300 },
    ],
  },
  segments: [],
  voronoiPolygons: [],
  piecePolygons: [],
  connectors: [],
  distanceThreshold: 10,
  noiseEnabled: false,
  noiseAmplitude: 5,
  noiseScale: 0.01,
  connectorLength: 30,
};

// Reducer
function reducer(state: TreeDanglerState, action: Action): TreeDanglerState {
  switch (action.type) {
    case 'SET_MASK':
      return { ...state, mask: action.payload };
    case 'SET_SEGMENTS':
      return { ...state, segments: action.payload };
    case 'SET_VORONOI_POLYGONS':
      return { ...state, voronoiPolygons: action.payload };
    case 'SET_DISTANCE_FIELD':
      return { ...state, distanceField: action.payload };
    case 'SET_THRESHOLD_BITMAP':
      return { ...state, thresholdBitmap: action.payload };
    case 'SET_PIECE_POLYGONS':
      return { ...state, piecePolygons: action.payload };
    case 'SET_CONNECTORS':
      return { ...state, connectors: action.payload };
    case 'SET_DISTANCE_CONFIG':
      return { ...state, ...action.payload };
    case 'SET_CONNECTOR_LENGTH':
      return { ...state, connectorLength: action.payload };
    default:
      return state;
  }
}

// Context
type TreeDanglerContextValue = {
  state: TreeDanglerState;
  dispatch: Dispatch<Action>;
};

const TreeDanglerContext = createContext<TreeDanglerContextValue | undefined>(undefined);

// Provider component
export function TreeDanglerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

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
    throw new Error('useTreeDanglerState must be used within a TreeDanglerProvider');
  }
  return context;
}
