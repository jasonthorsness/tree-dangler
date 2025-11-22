import Matter from "matter-js";
import decomp from "poly-decomp";

// Required for Matter to find the decomp library
// (Matter checks for global `window.decomp`)
(window as any).decomp = decomp;

(Matter.Common as any).setDecomp(decomp);

import type { LineSegment, Polygon } from "../types";
import { mmToPx } from "./connectors";

export interface SimulationWorld {
  engine: Matter.Engine;
  destroy: () => void;
  attachments: Record<string, Matter.Body | null>;
}

export function createSimulationWorld(
  polygons: Polygon[],
  connectors: LineSegment[],
  holeDiameter: number,
  _width: number,
  _height: number
): SimulationWorld {
  const engine = Matter.Engine.create();
  engine.constraintIterations = 500;
  engine.positionIterations = 10;

  const world = engine.world;
  world.gravity.y = 1;

  const bodies: Matter.Body[] = [];
  const attachments: Record<string, Matter.Body | null> = {};
  const holeRadius = mmToPx(holeDiameter - 1) / 2;

  polygons.forEach((poly) => {
    if (poly.points.length < 3) return;
    const vertices = poly.points.map((p) => ({ x: p.x, y: p.y }));
    const body = Matter.Bodies.fromVertices(
      0,
      0,
      [vertices],
      {
        friction: 0.8,
        restitution: 0.01,
        density: 0.002,
      },
      true,
      0.5
    );
    if (body) {
      const center = Matter.Vertices.centre(vertices);
      Matter.Body.setPosition(body, center);
      bodies.push(body);
    }
  });

  Matter.Composite.add(world, bodies);

  connectors.forEach((connector, idx) => {
    const attachA = attachToBody(world, bodies, connector.start);
    const attachB = attachToBody(world, bodies, connector.end);

    const circleA = Matter.Bodies.circle(
      connector.start.x,
      connector.start.y,
      holeRadius,
      {
        collisionFilter: { mask: 0 },
        render: { visible: false },
      }
    );
    const circleB = Matter.Bodies.circle(
      connector.end.x,
      connector.end.y,
      holeRadius,
      {
        collisionFilter: { mask: 0 },
        render: { visible: false },
      }
    );
    Matter.Composite.add(world, [circleA, circleB]);

    const anchorA = Matter.Constraint.create({
      bodyA: attachA.body,
      pointA: attachA.point,
      bodyB: circleA,
      pointB: { x: 0, y: 0 },
      length: 0,
      stiffness: 1.2,
      damping: 0.1,
    });
    const anchorB = Matter.Constraint.create({
      bodyA: attachB.body,
      pointA: attachB.point,
      bodyB: circleB,
      pointB: { x: 0, y: 0 },
      length: 0,
      stiffness: 1.2,
      damping: 0.1,
    });

    const dx = connector.end.x - connector.start.x;
    const dy = connector.end.y - connector.start.y;
    const distance = Math.hypot(dx, dy);
    const safeDistance = distance || 1;
    const dir = { x: dx / safeDistance, y: dy / safeDistance };
    const pointA = { x: dir.x * holeRadius, y: dir.y * holeRadius };
    const pointB = { x: -dir.x * holeRadius, y: -dir.y * holeRadius };
    const edgeConstraint = Matter.Constraint.create({
      bodyA: circleA,
      pointA,
      bodyB: circleB,
      pointB,
      length: Math.max(distance - holeRadius * 2, 0),
      stiffness: 1.2,
      damping: 0.1,
    });

    Matter.Composite.add(world, [anchorA, anchorB, edgeConstraint]);

    attachments[`${idx}-start`] = attachA.isStub ? attachA.body : null;
    attachments[`${idx}-end`] = attachB.isStub ? attachB.body : null;
  });

  const destroy = () => {
    Matter.World.clear(world, false);
    Matter.Engine.clear(engine);
  };

  return { engine, destroy, attachments };
}

function attachToBody(
  world: Matter.World,
  bodies: Matter.Body[],
  point: { x: number; y: number }
) {
  const findContainingBody = () => {
    for (const body of bodies) {
      if (body.parts && body.parts.length > 1) {
        for (let i = 1; i < body.parts.length; i += 1) {
          const part = body.parts[i];
          if (Matter.Vertices.contains(part.vertices, point)) {
            return body;
          }
        }
      } else if (Matter.Vertices.contains(body.vertices, point)) {
        return body;
      }
    }
    return null;
  };

  const containing = findContainingBody();
  if (containing) {
    return {
      body: containing,
      point: {
        x: point.x - containing.position.x,
        y: point.y - containing.position.y,
      },
      isStub: false,
    };
  }

  const stub = Matter.Bodies.circle(point.x, point.y, 2, {
    isStatic: true,
    render: { visible: false },
  });
  Matter.Composite.add(world, stub);
  return { body: stub, point: { x: 0, y: 0 }, isStub: true };
}
