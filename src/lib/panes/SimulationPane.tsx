import { useEffect, useRef, useState, useCallback } from "react";
import Matter from "matter-js";

import { useTreeDanglerState } from "../state/store";
import { createSimulationWorld } from "../logic/simulation";
import { hitTestConnectorEndpoint } from "../logic/connectors";

interface SimulationPaneProps {
  width: number;
  height: number;
  className?: string;
  resetToken: number;
  onResetRequest?: () => void;
}

export function SimulationPane({
  width,
  height,
  className,
  resetToken,
  onResetRequest,
}: SimulationPaneProps) {
  const {
    state: { piecePolygons, connectors },
  } = useTreeDanglerState();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const attachmentsRef = useRef<Record<string, Matter.Body | null>>({});
  const runningRef = useRef<number | undefined>(undefined);
  const pausedRef = useRef(false);
  const [hasError, setHasError] = useState(false);
  const dragRef = useRef<{
    segmentIndex: number;
    endpoint: "start" | "end";
  } | null>(null);

  const buildPointer = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;
      return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
      };
    },
    [width, height]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const { x, y } = buildPointer(event);
      const hit = hitTestConnectorEndpoint(connectors, { x, y }, 12);
      if (hit) {
        dragRef.current = {
          segmentIndex: hit.segmentIndex,
          endpoint: hit.endpoint,
        };
        event.preventDefault();
      }
    },
    [buildPointer, connectors]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!dragRef.current) return;
      const { x, y } = buildPointer(event);
      const key = `${dragRef.current.segmentIndex}-${dragRef.current.endpoint}`;
      const body = attachmentsRef.current[key];
      if (body) {
        Matter.Body.setPosition(body, { x, y });
      }
      event.preventDefault();
    },
    [buildPointer]
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    if (onResetRequest) {
      onResetRequest();
    }
  }, [onResetRequest]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isInsideCanvas = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      );
    };

    const updatePaused = (event: PointerEvent) => {
      const leftButtonDown = (event.buttons & 1) === 1;
      pausedRef.current = leftButtonDown && !isInsideCanvas(event);
    };

    const handlePointerMoveGlobal = (event: PointerEvent) => {
      updatePaused(event);
    };
    const handlePointerDownGlobal = (event: PointerEvent) => {
      updatePaused(event);
    };
    const handlePointerUpGlobal = () => {
      pausedRef.current = false;
    };
    const handleBlur = () => {
      pausedRef.current = false;
    };

    window.addEventListener("pointermove", handlePointerMoveGlobal);
    window.addEventListener("pointerdown", handlePointerDownGlobal);
    window.addEventListener("pointerup", handlePointerUpGlobal);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("pointermove", handlePointerMoveGlobal);
      window.removeEventListener("pointerdown", handlePointerDownGlobal);
      window.removeEventListener("pointerup", handlePointerUpGlobal);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

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
      attachmentsRef.current = world.attachments;
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
          if (!pausedRef.current) {
            Matter.Engine.update(engine, 1000 / 60);
          }
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

          // Draw draggable fixed endpoints
          Object.entries(attachmentsRef.current).forEach(([, body]) => {
            if (!body) return;
            ctx.beginPath();
            ctx.arc(body.position.x, body.position.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(248, 113, 113, 0.8)";
            ctx.fill();
            ctx.strokeStyle = "rgba(248, 113, 113, 1)";
            ctx.lineWidth = 1;
            ctx.stroke();
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

  return (
    <canvas
      ref={canvasRef}
      className={className}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
}

export default SimulationPane;
