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
          className="rounded-2xl border border-cyan-300/25 bg-[rgba(4,12,28,0.65)] shadow-2xl shadow-cyan-500/10"
        />
      ) : null}
      <div className="mt-4 space-y-3 text-sm text-[var(--ink-muted)]">
        <div className="flex flex-col gap-1">
          <label className="flex items-center justify-between text-xs uppercase tracking-widest text-cyan-100/70">
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
          <label className="flex items-center justify-between text-xs uppercase tracking-widest text-cyan-100/70">
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
            <span className="flex items-center justify-between text-cyan-100/70">
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
            <span className="text-cyan-100/70">Noise Seed</span>
            <input
              type="number"
              min={0}
              step={1}
              value={noiseSeed}
              onChange={(event) =>
                updateConfig({ noiseSeed: Number(event.target.value) })
              }
              className="rounded border border-cyan-400/30 bg-[rgba(7,20,44,0.8)] px-2 py-1 text-[var(--ink)] outline-none transition focus:border-cyan-200/70"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

export default DistanceFieldPane;
