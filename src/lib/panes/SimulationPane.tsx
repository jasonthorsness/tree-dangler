import { useEffect, useRef, useState } from "react";
import Matter from "matter-js";

import { useTreeDanglerState } from "../state/store";
import { createSimulationWorld } from "../logic/simulation";

interface SimulationPaneProps {
  width: number;
  height: number;
  className?: string;
  resetToken: number;
}

export function SimulationPane({
  width,
  height,
  className,
  resetToken,
}: SimulationPaneProps) {
  const {
    state: { piecePolygons, connectors },
  } = useTreeDanglerState();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runningRef = useRef<number | undefined>(undefined);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
    if (!canvasRef.current) return;
    try {
      const world = createSimulationWorld(
        piecePolygons,
        connectors,
        width,
        height
      );
      engineRef.current = world.engine;
      return () => {
        world.destroy();
      };
    } catch (err) {
      console.error("Simulation init failed", err);
      setHasError(true);
      engineRef.current = null;
      return undefined;
    }
  }, [connectors, piecePolygons, width, height, resetToken]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const renderLoop = () => {
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, width, height);
      const engine = engineRef.current;
      if (engine && !hasError) {
        try {
          Matter.Engine.update(engine, 1000 / 60);
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 1.5;
          const bodies = Matter.Composite.allBodies(engine.world);

          bodies.forEach((body) => {
            if (body.isStatic) return;

            // If the body has parts, draw each part (skip index 0 which is the parent)
            const parts =
              body.parts && body.parts.length > 1
                ? body.parts.slice(1)
                : [body];

            parts.forEach((part) => {
              const vertices = part.vertices;
              ctx.beginPath();
              ctx.moveTo(vertices[0].x, vertices[0].y);

              for (let j = 1; j < vertices.length; j++) {
                ctx.lineTo(vertices[j].x, vertices[j].y);
              }

              ctx.closePath();
              ctx.fillStyle = "#FFFFFF";
              ctx.fill();
              ctx.strokeStyle = "#FFFFFF";
              ctx.lineWidth = 1.5;
              ctx.stroke();
            });
          });

          ctx.strokeStyle = "rgba(248, 113, 113, 0.7)";
          ctx.lineWidth = 1;
          const constraints = Matter.Composite.allConstraints(engine.world);
          constraints.forEach((constraint) => {
            const pointA = constraint.bodyA
              ? Matter.Vector.add(
                  constraint.bodyA.position,
                  constraint.pointA as Matter.Vector
                )
              : constraint.pointA;
            const pointB = constraint.bodyB
              ? Matter.Vector.add(
                  constraint.bodyB.position,
                  constraint.pointB as Matter.Vector
                )
              : constraint.pointB;
            if (pointA && pointB) {
              ctx.beginPath();
              ctx.moveTo(pointA.x, pointA.y);
              ctx.lineTo(pointB.x, pointB.y);
              ctx.stroke();
            }
          });
        } catch (err) {
          console.error("Simulation render failed", err);
          setHasError(true);
        }
      }
      runningRef.current = requestAnimationFrame(renderLoop);
    };

    if (!hasError) {
      renderLoop();
    }
    return () => {
      if (runningRef.current) cancelAnimationFrame(runningRef.current);
    };
  }, [width, height, hasError]);

  if (hasError) {
    return (
      <div
        className={`${
          className ?? ""
        } flex h-[600px] w-[600px] items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40`}
      >
        <p className="text-xs text-slate-500">
          Simulation unavailable for this configuration.
        </p>
      </div>
    );
  }

  return <canvas ref={canvasRef} className={className} />;
}

export default SimulationPane;
