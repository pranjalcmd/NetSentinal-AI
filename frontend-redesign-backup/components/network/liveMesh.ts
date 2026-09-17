/**
 * Build ReactFlow nodes/edges for NetworkMesh from the backend's
 * /api/network/graph and /api/incidents.
 *
 * The backend graph is flat (nodes + links); this lays it out in columns —
 * internal hosts left, external destinations right, top incidents far right —
 * which is the same visual language the demo data used.
 */
import { MarkerType, type Edge, type Node } from '@xyflow/react'
import { fetchGraph, fetchIncidents, incidentFromBackend } from '@/lib/api'

const riskColor = (r: number): string =>
  r >= 80 ? '#E8483A' : r >= 60 ? '#E8863A' : r >= 40 ? '#E8C93A' : '#4B7BE5'

export async function buildLiveMesh(): Promise<{ nodes: Node[]; edges: Edge[] } | null> {
  const [graph, liveIncs] = await Promise.all([fetchGraph(), fetchIncidents()])
  if (!graph || !graph.nodes.length) return null


  const internal = graph.nodes.filter(n => n.kind === 'internal')
  const external = graph.nodes.filter(n => n.kind !== 'internal')

  // Radial layout: internal hosts on the inner circle, external destinations
  // on the outer circle — the "gol gol" mesh the demo showed, but with live data.
  const CX = 500
  const CY = 400
  const nodes: Node[] = []
  const ring = (count: number, radius: number, offset = 0): Array<{ x: number; y: number }> =>
    Array.from({ length: count }, (_, i) => {
      const a = offset + (i / Math.max(count, 1)) * Math.PI * 2
      return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) }
    })
  const hostPos = ring(internal.length, 200, -Math.PI / 2)
  const extPos = ring(external.length, 400, -Math.PI / 2)

  internal.forEach((n, i) => {
    nodes.push({
      id: n.id,
      type: 'hostNode',
      position: hostPos[i],
      data: {
        label: n.name,
        nodeType: 'host',
        riskScore: n.risk ?? 0,
        ip: n.id,
        internal: true,
        entityId: n.id,
      },
    })
  })
  external.forEach((n, i) => {
    nodes.push({
      id: n.id,
      type: 'externalNode',
      position: extPos[i],
      data: {
        label: n.name,
        nodeType: 'external_ip',
        riskScore: n.risk ?? 0,
        entityId: n.id,
      },
    })
  })

  // Top three incidents become incident cards on the far right.
  const incidents = (liveIncs ?? []).map(incidentFromBackend)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 3)
  incidents.forEach((inc, i) => {
    nodes.push({
      id: inc.id,
      type: 'incidentNode',
      position: { x: CX + 560 * Math.cos(-Math.PI / 2 + (i + 0.5) * 0.9), y: CY + 560 * Math.sin(-Math.PI / 2 + (i + 0.5) * 0.9) },
      data: {
        label: inc.id.slice(0, 12),
        nodeType: 'incident',
        riskScore: inc.riskScore,
        status: inc.status,
        title: inc.title,
        entityId: inc.id,
      },
    })
  })

  const ids = new Set(nodes.map(n => n.id))
  const edges: Edge[] = graph.links
    .filter(l => ids.has(l.source) && ids.has(l.target))
    .map((l, i) => {
      const color = l.suspicious ? '#E8863A' : '#515E72'
      return {
        id: `e-${l.source}-${l.target}-${i}`,
        source: l.source,
        target: l.target,
        animated: Boolean(l.suspicious),
        style: { stroke: color, strokeWidth: l.suspicious ? 2 : 1 },
        markerEnd: { type: MarkerType.ArrowClosed, color },
        data: {},
      }
    })

  // Wire each incident to its primary host so the story reads left → right.
  for (const inc of incidents) {
    const host = inc.hostIds.find(h => ids.has(h))
    if (host) {
      edges.push({
        id: `inc-${inc.id}`,
        source: host,
        target: inc.id,
        style: { stroke: '#E8483A', strokeWidth: 1.5, strokeDasharray: '4 2' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#E8483A' },
        data: {},
      })
    }
  }

  return { nodes, edges }
}

export { riskColor }
