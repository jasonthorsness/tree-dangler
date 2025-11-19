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
    state: { gap, round, noiseAmplitude, noiseSeed },
    dispatch,
  } = useTreeDanglerState();

  const updateConfig = useCallback(
    (
      patch: Partial<
        Pick<
          TreeDanglerState,
          "gap" | "round" | "noiseAmplitude" | "noiseSeed"
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
            Gap <span>{gap.toFixed(1)} mm</span>
          </label>
          <input
            type="range"
            min={0}
            max={8}
            step={0.1}
            value={gap}
            onChange={(event) =>
              updateConfig({ gap: Number(event.target.value) })
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="flex items-center justify-between text-xs uppercase tracking-widest text-slate-400">
            Round <span>{round.toFixed(1)} mm</span>
          </label>
          <input
            type="range"
            min={0}
            max={8}
            step={0.1}
            value={round}
            onChange={(event) =>
              updateConfig({ round: Number(event.target.value) })
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
      </div>
    </div>
  );
}

export default DistanceFieldPane;
