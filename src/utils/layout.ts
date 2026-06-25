import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import type { Node as FlowNode, Edge as FlowEdge } from 'reactflow';

export interface LayoutOptions {
  width?: number;
  height?: number;
  nodeRadius?: number;
  linkDistance?: number;
  strength?: number;
}

export function applyForceLayout(
  nodes: FlowNode[],
  edges: FlowEdge[],
  options: LayoutOptions = {}
): FlowNode[] {
  if (nodes.length === 0) return nodes;

  const {
    width = 600,
    height = 600,
    nodeRadius = 60, // approximate size of a node
    linkDistance = 150,
    strength = -600,
  } = options;

  // We need to copy nodes because d3-force mutates the objects directly
  const simulationNodes = nodes.map(n => ({
    id: n.id,
    x: n.position.x || width / 2 + (Math.random() - 0.5) * 100,
    y: n.position.y || height / 2 + (Math.random() - 0.5) * 100,
    flowNode: n
  }));

  const simulationLinks = edges.map(e => ({
    source: e.source,
    target: e.target,
  }));

  const simulation = forceSimulation(simulationNodes)
    .force(
      'link',
      forceLink(simulationLinks)
        .id((d: any) => d.id)
        .distance(linkDistance)
    )
    .force('charge', forceManyBody().strength(strength))
    .force('collide', forceCollide().radius(nodeRadius).iterations(3))
    .force('center', forceCenter(width / 2, height / 2))
    .stop();

  // Run synchronously for a fixed number of ticks to settle the layout immediately
  simulation.tick(300);

  return simulationNodes.map(n => ({
    ...n.flowNode,
    position: {
      x: Math.round(n.x),
      y: Math.round(n.y)
    }
  }));
}
