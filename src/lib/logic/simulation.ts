import Matter from "matter-js";

import type { LineSegment, Polygon } from "../types";

export interface SimulationWorld {
  engine: Matter.Engine;
  destroy: () => void;
}

export function createSimulationWorld(
  polygons: Polygon[],
  connectors: LineSegment[],
  width: number,
  height: number
): SimulationWorld {
  const engine = Matter.Engine.create();
  const world = engine.world;
  world.gravity.y = 1;

  const bodies: Matter.Body[] = [];

  // only take the first polygon
  polygons = polygons.slice(1, 4);

  polygons.forEach((poly) => {
    if (poly.points.length < 3) return;
    const vertices = poly.points.map((p) => ({ x: p.x, y: p.y }));
    const body = Matter.Bodies.fromVertices(0, 0, [vertices], {
      friction: 0.3,
      restitution: 0.1,
      density: 0.002,
    });
    if (body) {
      const center = Matter.Vertices.centre(vertices);
      Matter.Body.setPosition(body, center);
      bodies.push(body);
    }
  });

  Matter.Composite.add(world, bodies);

  const boundaries = [
    Matter.Bodies.rectangle(width / 2, -50, width, 100, {
      isStatic: true,
      render: { visible: false },
    }),
    Matter.Bodies.rectangle(width / 2, height + 50, width, 100, {
      isStatic: true,
      render: { visible: false },
    }),
    Matter.Bodies.rectangle(-50, height / 2, 100, height, {
      isStatic: true,
      render: { visible: false },
    }),
    Matter.Bodies.rectangle(width + 50, height / 2, 100, height, {
      isStatic: true,
      render: { visible: false },
    }),
  ];
  Matter.Composite.add(world, boundaries);

  connectors.forEach((connector) => {
    const attachA = attachToBody(world, bodies, connector.start);
    const attachB = attachToBody(world, bodies, connector.end);

    const length = Math.hypot(
      connector.end.x - connector.start.x,
      connector.end.y - connector.start.y
    );

    const constraint = Matter.Constraint.create({
      bodyA: attachA.body,
      pointA: attachA.point,
      bodyB: attachB.body,
      pointB: attachB.point,
      length,
      stiffness: 0.6,
      damping: 0.05,
    });
    Matter.Composite.add(world, constraint);
  });

  const destroy = () => {
    Matter.World.clear(world, false);
    Matter.Engine.clear(engine);
  };

  return { engine, destroy };
}

function attachToBody(
  world: Matter.World,
  bodies: Matter.Body[],
  point: { x: number; y: number }
) {
  for (const body of bodies) {
    if (Matter.Vertices.contains(body.vertices, point)) {
      return {
        body,
        point: {
          x: point.x - body.position.x,
          y: point.y - body.position.y,
        },
      };
    }
  }

  const stub = Matter.Bodies.circle(point.x, point.y, 2, {
    isStatic: true,
    render: { visible: false },
  });
  Matter.Composite.add(world, stub);
  return { body: stub, point: { x: 0, y: 0 } };
}
