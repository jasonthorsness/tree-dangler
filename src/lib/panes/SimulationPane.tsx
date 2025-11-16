import { useEffect, useRef } from "react";
import Matter from "matter-js";

import { useTreeDanglerState } from "../state/store";
import { createSimulationWorld } from "../logic/simulation";

interface SimulationPaneProps {
  width: number;
  height: number;
  className?: string;
  resetToken: number;
}

export function SimulationPane({ width, height, className, resetToken }: SimulationPaneProps) {
  const {
    state: { piecePolygons, connectors },
  } = useTreeDanglerState();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runningRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!canvasRef.current) return;
    const world = createSimulationWorld(piecePolygons, connectors, width, height);
    engineRef.current = world.engine;
    return () => {
      world.destroy();
    };
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
      if (engine) {
        Matter.Engine.update(engine, 1000 / 60);
        ctx.strokeStyle = "#cbd5f5";
        ctx.lineWidth = 1.5;
        const bodies = Matter.Composite.allBodies(engine.world);
        bodies.forEach((body) => {
          if (body.isStatic) return;
          const vertices = body.vertices;
          ctx.beginPath();
          ctx.moveTo(vertices[0].x, vertices[0].y);
          for (let j = 1; j < vertices.length; j += 1) {
            ctx.lineTo(vertices[j].x, vertices[j].y);
          }
          ctx.closePath();
          ctx.stroke();
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
      }
      runningRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();
    return () => {
      if (runningRef.current) cancelAnimationFrame(runningRef.current);
    };
  }, [width, height]);

  return <canvas ref={canvasRef} className={className} />;
}

export default SimulationPane;
