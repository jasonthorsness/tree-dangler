import { useCallback } from "react";

import { useTreeDanglerState } from "../state/store";
import type { TreeDanglerState } from "../types";
import { DistancePreviewPane } from "./DistancePreviewPane";

interface DistanceFieldPaneProps {
  width: number;
  height: number;
  className?: string;
  showPreview?: boolean;
}

export function DistanceFieldPane({
  width,
  height,
  className,
  showPreview = true,
}: DistanceFieldPaneProps) {
  const {
    state: {
      shrinkThreshold,
      growThreshold,
      noiseAmplitude,
      noiseSeed,
      connectorLength,
    },
    dispatch,
  } = useTreeDanglerState();

  const updateConfig = useCallback(
    (
      patch: Partial<
        Pick<
          TreeDanglerState,
          "shrinkThreshold" | "growThreshold" | "noiseAmplitude" | "noiseSeed"
        >
      >
    ) => {
      dispatch({ type: "SET_DISTANCE_CONFIG", payload: patch });
    },
    [dispatch]
  );

  return (
    <div className={className}>
      {showPreview ? (
        <DistancePreviewPane
          width={width}
          height={height}
          className="rounded-2xl border border-slate-800"
        />
      ) : null}
      <div className="mt-4 space-y-3 text-sm text-slate-300">
        <div className="flex flex-col gap-1">
          <label className="flex items-center justify-between text-xs uppercase tracking-widest text-slate-400">
            Shrink Threshold <span>{shrinkThreshold.toFixed(1)} px</span>
          </label>
          <input
            type="range"
            min={0}
            max={40}
            step={0.5}
            value={shrinkThreshold}
            onChange={(event) =>
              updateConfig({ shrinkThreshold: Number(event.target.value) })
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="flex items-center justify-between text-xs uppercase tracking-widest text-slate-400">
            Grow Threshold <span>{growThreshold.toFixed(1)} px</span>
          </label>
          <input
            type="range"
            min={0}
            max={40}
            step={0.5}
            value={growThreshold}
            onChange={(event) =>
              updateConfig({ growThreshold: Number(event.target.value) })
            }
          />
        </div>
        <div className="space-y-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="flex items-center justify-between text-slate-400">
              Noise Amplitude <span>{noiseAmplitude.toFixed(1)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={50}
              step={0.5}
              value={noiseAmplitude}
              onChange={(event) =>
                updateConfig({ noiseAmplitude: Number(event.target.value) })
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-slate-400">Noise Seed</span>
            <input
              type="number"
              min={0}
              step={1}
              value={noiseSeed}
              onChange={(event) =>
                updateConfig({ noiseSeed: Number(event.target.value) })
              }
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
            />
          </label>
        </div>
        <div className="space-y-1 text-xs">
          <label className="flex items-center gap-2">
            <span className="text-slate-400 uppercase tracking-[0.25em]">
              Connector length
            </span>
            <input
              type="number"
              min={2}
              step={0.5}
              value={connectorLength}
              onChange={(event) =>
                dispatch({
                  type: "SET_CONNECTOR_LENGTH",
                  payload: Number(event.target.value),
                })
              }
              className="w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
            />
            <span className="text-slate-500">mm</span>
          </label>
        </div>
      </div>
    </div>
  );
}

export default DistanceFieldPane;
