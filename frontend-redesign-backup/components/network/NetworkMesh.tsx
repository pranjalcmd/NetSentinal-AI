'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  Panel,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Monitor,
  Globe,
  Server,
  AlertTriangle,
  ShieldAlert,
  Activity,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  EyeOff,
  Search,
  X,
  Radio,
  Layers,
  Network,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildLiveMesh } from './liveMesh'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface NetworkMeshProps {
  mode?: 'traffic' | 'threat' | 'incident' | 'host'
  height?: number | string
  showControls?: boolean
  showMinimap?: boolean
  highlightEntityId?: string
  onNodeClick?: (nodeType: string, entityId: string) => void
  onEdgeClick?: (source: string, target: string, data: unknown) => void
  compact?: boolean
}

interface MeshNodeData extends Record<string, unknown> {
  label: string
  nodeType: string
  riskScore: number
  entityId: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_NODES: Node[] = [
  // Internal hosts (left cluster)
  {
    id: '10.0.0.14',
    type: 'hostNode',
    position: { x: 120, y: 280 },
    data: {
      label: 'FIN-WS-014',
      nodeType: 'host',
      riskScore: 87,
      ip: '10.0.0.14',
      role: 'Finance Workstation',
      internal: true,
      entityId: '10.0.0.14',
    },
  },
  {
    id: '10.0.0.28',
    type: 'hostNode',
    position: { x: 120, y: 420 },
    data: {
      label: 'DEV-WS-028',
      nodeType: 'host',
      riskScore: 64,
      ip: '10.0.0.28',
      role: 'Developer Workstation',
      internal: true,
      entityId: '10.0.0.28',
    },
  },
  {
    id: '10.0.0.5',
    type: 'hostNode',
    position: { x: 120, y: 160 },
    data: {
      label: 'CORE-DNS-01',
      nodeType: 'host',
      riskScore: 21,
      ip: '10.0.0.5',
      role: 'DNS Server',
      internal: true,
      entityId: '10.0.0.5',
    },
  },
  {
    id: '10.0.0.1',
    type: 'hostNode',
    position: { x: 120, y: 560 },
    data: {
      label: 'CORE-GW-01',
      nodeType: 'host',
      riskScore: 18,
      ip: '10.0.0.1',
      role: 'Gateway',
      internal: true,
      entityId: '10.0.0.1',
    },
  },

  // Domain/DNS node (middle)
  {
    id: 'cdn-sync-update.net',
    type: 'domainNode',
    position: { x: 380, y: 200 },
    data: {
      label: 'cdn-sync-update.net',
      nodeType: 'domain',
      riskScore: 81,
      rarity: 'rare',
      entityId: 'cdn-sync-update.net',
    },
  },

  // External IP (right)
  {
    id: '45.77.21.184',
    type: 'externalNode',
    position: { x: 620, y: 280 },
    data: {
      label: '45.77.21.184',
      nodeType: 'external_ip',
      riskScore: 82,
      asn: 'AS64514',
      country: 'US',
      entityId: '45.77.21.184',
    },
  },

  // Service node
  {
    id: 'svc-443',
    type: 'serviceNode',
    position: { x: 500, y: 360 },
    data: {
      label: 'TLS:443',
      nodeType: 'service',
      port: 443,
      application: 'TLS',
      riskScore: 0,
      entityId: 'svc-443',
    },
  },

  // Finding node (far right top)
  {
    id: 'FND-8841',
    type: 'findingNode',
    position: { x: 820, y: 180 },
    data: {
      label: 'FND-8841',
      nodeType: 'finding',
      severity: 'high',
      riskScore: 87,
      title: 'Possible C2-style periodic traffic',
      entityId: 'FND-8841',
    },
  },

  // Incident node (far right bottom)
  {
    id: 'INC-2026-041',
    type: 'incidentNode',
    position: { x: 820, y: 360 },
    data: {
      label: 'INC-2026-041',
      nodeType: 'incident',
      riskScore: 91,
      status: 'investigating',
      title: 'Suspicious outbound communication',
      entityId: 'INC-2026-041',
    },
  },

  // Other external
  {
    id: 'github.com',
    type: 'domainNode',
    position: { x: 380, y: 560 },
    data: {
      label: 'github.com',
      nodeType: 'domain',
      riskScore: 8,
      rarity: 'common',
      entityId: 'github.com',
    },
  },
]

const DEMO_EDGES: Edge[] = [
  {
    id: 'e1',
    source: '10.0.0.14',
    target: 'cdn-sync-update.net',
    label: 'DNS Query',
    animated: true,
    style: { stroke: '#E8C93A', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#E8C93A' },
    data: { protocol: 'DNS', bytes: 48000, packets: 284, riskScore: 81 },
  },
  {
    id: 'e2',
    source: 'cdn-sync-update.net',
    target: '45.77.21.184',
    label: 'Resolves',
    style: { stroke: '#E8863A', strokeWidth: 1 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#E8863A' },
    data: {},
  },
  {
    id: 'e3',
    source: '10.0.0.14',
    target: 'svc-443',
    animated: true,
    style: { stroke: '#3DD9C4', strokeWidth: 2.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#3DD9C4' },
    label: 'Active TLS Flow (31x)',
    data: {
      protocol: 'TLS',
      bytes: 8928000,
      packets: 5580,
      riskScore: 87,
      relatedFindings: ['FND-8841'],
    },
  },
  {
    id: 'e4',
    source: 'svc-443',
    target: '45.77.21.184',
    animated: true,
    style: { stroke: '#3DD9C4', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#3DD9C4' },
    data: {},
  },
  {
    id: 'e5',
    source: '45.77.21.184',
    target: 'FND-8841',
    style: { stroke: '#E8863A', strokeWidth: 1, strokeDasharray: '4 2' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#E8863A' },
    data: {},
  },
  {
    id: 'e6',
    source: 'FND-8841',
    target: 'INC-2026-041',
    style: { stroke: '#E8483A', strokeWidth: 1.5, strokeDasharray: '4 2' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#E8483A' },
    data: {},
  },
  {
    id: 'e7',
    source: '10.0.0.14',
    target: '10.0.0.5',
    style: { stroke: '#515E72', strokeWidth: 1 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#515E72' },
    label: 'DNS',
    data: { protocol: 'DNS' },
  },
  {
    id: 'e8',
    source: '10.0.0.28',
    target: 'cdn-sync-update.net',
    style: { stroke: '#E8863A', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#E8863A' },
    data: { protocol: 'HTTPS', riskScore: 68 },
  },
  {
    id: 'e9',
    source: '10.0.0.14',
    target: '10.0.0.1',
    style: { stroke: '#242B36', strokeWidth: 1 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#242B36' },
    data: { protocol: 'TCP' },
  },
  {
    id: 'e10',
    source: '10.0.0.14',
    target: 'github.com',
    style: { stroke: '#4B7BE5', strokeWidth: 1 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#4B7BE5' },
    data: { protocol: 'HTTPS', riskScore: 8 },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Custom Node Components
// ─────────────────────────────────────────────────────────────────────────────

type HostNodeData = MeshNodeData & { ip: string; role: string; internal: boolean }

// React Flow routes every edge through source/target Handles. The demo data
// never needed them because its few edges were drawn node-center to
// node-center with default handles; without any Handle rendered, live edges
// fail with error #008. One invisible pair per node fixes all six types.
function WithHandles({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Handle type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: 'none' }} isConnectable={false} />
      {children}
      <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: 'none' }} isConnectable={false} />
    </div>
  )
}

function HostNode({ data, selected }: { data: HostNodeData; selected?: boolean }) {
  const riskColor =
    data.riskScore >= 80 ? '#E8483A' : data.riskScore >= 60 ? '#E8863A' : data.riskScore >= 40 ? '#E8C93A' : '#4B7BE5'
  return (
  <WithHandles>
    <div
      style={{
        background: '#0F141C',
        border: `1px solid ${selected ? '#3DD9C4' : '#242B36'}`,
        borderRadius: 2,
        padding: '6px 10px',
        minWidth: 148,
        fontFamily: 'IBM Plex Mono, monospace',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Monitor size={12} color={riskColor} />
        <span style={{ fontSize: 11, fontWeight: 600, color: '#E4E8EE', letterSpacing: '0.02em' }}>
          {data.label}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            fontWeight: 700,
            color: riskColor,
            background: `${riskColor}15`,
            padding: '1px 5px',
            border: `1px solid ${riskColor}30`,
            borderRadius: 2,
          }}
        >
          {data.riskScore}
        </span>
      </div>
      <div style={{ fontSize: 10, color: '#768396', fontFamily: 'IBM Plex Mono, monospace' }}>
        {data.ip}
      </div>
      <div style={{ fontSize: 9, color: '#515E72', marginTop: 2, fontFamily: 'Inter, sans-serif' }}>{data.role}</div>
      {data.internal && (
        <div
          style={{
            marginTop: 4,
            fontSize: 8,
            color: '#4B7BE5',
            background: 'rgba(75,123,229,0.1)',
            padding: '1px 4px',
            borderRadius: 2,
            display: 'inline-block',
            letterSpacing: '0.05em',
            border: '1px solid rgba(75,123,229,0.25)',
          }}
        >
          INTERNAL
        </div>
      )}
    </div>
  </WithHandles>
  )
}

type DomainNodeData = MeshNodeData & { rarity?: string }

function DomainNode({ data, selected }: { data: DomainNodeData; selected?: boolean }) {
  const isRare = data.rarity === 'rare' || data.rarity === 'unusual'
  const riskColor = data.riskScore >= 80 ? '#E8483A' : data.riskScore >= 60 ? '#E8863A' : data.riskScore >= 40 ? '#E8C93A' : '#4B7BE5'
  const borderColor = selected ? '#3DD9C4' : isRare ? '#E8863A' : '#242B36'

  return (
  <WithHandles>
    <div
      style={{
        background: '#0F141C',
        border: `1px solid ${borderColor}`,
        borderRadius: 2,
        padding: '6px 10px',
        minWidth: 168,
        fontFamily: 'IBM Plex Mono, monospace',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Globe size={12} color={isRare ? '#E8863A' : '#768396'} />
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#E4E8EE',
            maxWidth: 140,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {data.label}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {isRare && (
          <span
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: '#E8863A',
              background: 'rgba(232,134,58,0.15)',
              padding: '1px 5px',
              borderRadius: 2,
              letterSpacing: '0.06em',
              border: '1px solid rgba(232,134,58,0.3)',
            }}
          >
            {data.rarity?.toUpperCase()}
          </span>
        )}
        {data.riskScore > 0 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: riskColor,
              marginLeft: 'auto',
              background: `${riskColor}15`,
              padding: '1px 5px',
              border: `1px solid ${riskColor}30`,
              borderRadius: 2,
            }}
          >
            {data.riskScore}
          </span>
        )}
      </div>
    </div>
  </WithHandles>
  )
}

type ExternalNodeData = MeshNodeData & { asn?: string; country?: string }

function ExternalNode({ data, selected }: { data: ExternalNodeData; selected?: boolean }) {
  const riskColor = data.riskScore >= 80 ? '#E8483A' : data.riskScore >= 60 ? '#E8863A' : data.riskScore >= 40 ? '#E8C93A' : '#4B7BE5'
  return (
  <WithHandles>
    <div
      style={{
        background: '#0F141C',
        border: `1px solid ${selected ? '#3DD9C4' : '#242B36'}`,
        borderRadius: 2,
        padding: '6px 10px',
        minWidth: 148,
        fontFamily: 'IBM Plex Mono, monospace',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Server size={12} color={riskColor} />
        <span style={{ fontSize: 11, fontWeight: 600, color: '#E4E8EE' }}>{data.label}</span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            fontWeight: 700,
            color: riskColor,
            background: `${riskColor}15`,
            padding: '1px 5px',
            border: `1px solid ${riskColor}30`,
            borderRadius: 2,
          }}
        >
          {data.riskScore}
        </span>
      </div>
      {data.asn && (
        <div style={{ fontSize: 9, color: '#768396' }}>{data.asn}</div>
      )}
      {data.country && (
        <div style={{ fontSize: 9, color: '#515E72', marginTop: 1, fontFamily: 'Inter, sans-serif' }}>
          {data.country} · External
        </div>
      )}
    </div>
  </WithHandles>
  )
}

type ServiceNodeData = MeshNodeData & { port: number; application: string }

function ServiceNode({ data, selected }: { data: ServiceNodeData; selected?: boolean }) {
  return (
  <WithHandles>
    <div
      style={{
        background: '#0F141C',
        border: `1px solid ${selected ? '#3DD9C4' : '#242B36'}`,
        borderRadius: 2,
        padding: '4px 10px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'IBM Plex Mono, monospace',
        whiteSpace: 'nowrap',
      }}
    >
      <Activity size={10} color="#3DD9C4" />
      <span style={{ fontSize: 10, fontWeight: 600, color: '#3DD9C4', letterSpacing: '0.04em' }}>
        {data.application}:{data.port}
      </span>
    </div>
  </WithHandles>
  )
}

type FindingNodeData = MeshNodeData & { severity: string; title: string }

function FindingNode({ data, selected }: { data: FindingNodeData; selected?: boolean }) {
  const severityColor =
    data.severity === 'critical'
      ? '#E8483A'
      : data.severity === 'high'
      ? '#E8863A'
      : data.severity === 'medium'
      ? '#E8C93A'
      : '#4B7BE5'

  return (
  <WithHandles>
    <div
      style={{
        background: '#0F141C',
        border: `1px solid ${selected ? '#3DD9C4' : '#242B36'}`,
        borderRadius: 2,
        padding: '6px 10px',
        minWidth: 176,
        maxWidth: 220,
        fontFamily: 'IBM Plex Mono, monospace',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <AlertTriangle size={12} color={severityColor} />
        <span
          style={{
            fontSize: 8,
            fontWeight: 700,
            color: severityColor,
            background: `${severityColor}15`,
            padding: '1px 5px',
            borderRadius: 2,
            letterSpacing: '0.06em',
            border: `1px solid ${severityColor}30`,
          }}
        >
          {data.severity.toUpperCase()}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: severityColor }}>
          {data.riskScore}
        </span>
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#E4E8EE', marginBottom: 2 }}>
        {data.label}
      </div>
      <div
        style={{
          fontSize: 9,
          color: '#768396',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {data.title}
      </div>
    </div>
  </WithHandles>
  )
}

type IncidentNodeData = MeshNodeData & { status: string; title: string }

function IncidentNode({ data, selected }: { data: IncidentNodeData; selected?: boolean }) {
  return (
  <WithHandles>
    <div
      style={{
        background: '#0F141C',
        border: `1px solid ${selected ? '#3DD9C4' : '#E8483A'}`,
        borderRadius: 2,
        padding: '6px 10px',
        minWidth: 188,
        maxWidth: 230,
        fontFamily: 'IBM Plex Mono, monospace',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <ShieldAlert size={12} color="#E8483A" />
        <span
          style={{
            fontSize: 8,
            fontWeight: 700,
            color: '#E8483A',
            background: '#E8483A15',
            padding: '1px 5px',
            borderRadius: 2,
            letterSpacing: '0.06em',
            border: '1px solid #E8483A30',
          }}
        >
          {data.status.toUpperCase()}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#E8483A' }}>
          {data.riskScore}
        </span>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#E4E8EE', marginBottom: 2 }}>
        {data.label}
      </div>
      <div
        style={{
          fontSize: 9,
          color: '#768396',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {data.title}
      </div>
    </div>
  </WithHandles>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Toolbar component (inside ReactFlowProvider)
// ─────────────────────────────────────────────────────────────────────────────

type MeshMode = 'traffic' | 'threat' | 'incident' | 'host'

interface MeshToolbarProps {
  mode: MeshMode
  onModeChange: (m: MeshMode) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  showExternal: boolean
  onToggleExternal: () => void
}

function MeshToolbar({
  mode,
  onModeChange,
  searchQuery,
  onSearchChange,
  showExternal,
  onToggleExternal,
}: MeshToolbarProps) {
  const { fitView } = useReactFlow()

  const modes: { id: MeshMode; label: string; icon: React.ReactNode }[] = [
    { id: 'threat', label: 'Threat', icon: <ShieldAlert size={12} /> },
    { id: 'traffic', label: 'Traffic', icon: <Activity size={12} /> },
    { id: 'incident', label: 'Incident', icon: <AlertTriangle size={12} /> },
    { id: 'host', label: 'Hosts', icon: <Network size={12} /> },
  ]

  return (
    <Panel position="top-left">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '10px 12px',
          background: 'rgba(13,17,23,0.95)',
          border: '1px solid rgba(148,163,184,0.12)',
          borderRadius: 8,
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          minWidth: 240,
        }}
      >
        {/* Mode selector */}
        <div style={{ display: 'flex', gap: 4 }}>
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => onModeChange(m.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 4,
                border: `1px solid ${mode === m.id ? 'rgba(59,130,246,0.4)' : 'rgba(148,163,184,0.1)'}`,
                background: mode === m.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: mode === m.id ? '#60a5fa' : '#64748b',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                letterSpacing: '0.03em',
                transition: 'all 0.1s ease',
              }}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Search size={11} color="#475569" style={{ flexShrink: 0 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search nodes…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#e2e8f0',
              fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace',
              minWidth: 0,
            }}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <X size={10} color="#475569" />
            </button>
          )}
        </div>

        {/* Controls row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={onToggleExternal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid rgba(148,163,184,0.1)',
              background: showExternal ? 'rgba(99,102,241,0.1)' : 'transparent',
              color: showExternal ? '#818cf8' : '#475569',
              fontSize: 10,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              flex: 1,
            }}
          >
            {showExternal ? <Eye size={10} /> : <EyeOff size={10} />}
            External nodes
          </button>
          <button
            onClick={() => fitView({ padding: 0.12, duration: 400 })}
            title="Fit to view"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 4,
              border: '1px solid rgba(148,163,184,0.1)',
              background: 'transparent',
              color: '#64748b',
              cursor: 'pointer',
            }}
          >
            <Maximize2 size={11} />
          </button>
        </div>
      </div>
    </Panel>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Legend
// ─────────────────────────────────────────────────────────────────────────────

function MeshLegend() {
  const items = [
    { color: '#ef4444', label: 'Critical / C2' },
    { color: '#f97316', label: 'High risk' },
    { color: '#eab308', label: 'DNS query' },
    { color: '#3b82f6', label: 'Service / Low' },
    { color: '#475569', label: 'Normal traffic' },
  ]

  return (
    <Panel position="bottom-right">
      <div
        style={{
          padding: '8px 12px',
          background: 'rgba(13,17,23,0.92)',
          border: '1px solid rgba(148,163,184,0.12)',
          borderRadius: 6,
          backdropFilter: 'blur(8px)',
        }}
      >
        <div
          style={{
            fontSize: 8,
            fontWeight: 700,
            color: '#334155',
            letterSpacing: '0.1em',
            marginBottom: 6,
          }}
        >
          EDGE RISK
        </div>
        {items.map((item) => (
          <div
            key={item.color}
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}
          >
            <div
              style={{
                width: 20,
                height: 2,
                background: item.color,
                borderRadius: 1,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
              {item.label}
            </span>
          </div>
        ))}
        <div
          style={{
            marginTop: 8,
            paddingTop: 6,
            borderTop: '1px solid rgba(148,163,184,0.08)',
          }}
        >
          {[
            { bg: '#ef4444', label: 'Finding' },
            { bg: '#f97316', label: 'Incident' },
            { bg: '#3b82f6', label: 'Host / Service' },
            { bg: '#475569', label: 'Domain' },
          ].map((item) => (
            <div
              key={item.label}
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: `${item.bg}33`,
                  border: `1px solid ${item.bg}66`,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 9, color: '#64748b' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Info panel (selected node/edge)
// ─────────────────────────────────────────────────────────────────────────────

function NodeInfoPanel({
  node,
  onClose,
}: {
  node: Node
  onClose: () => void
}) {
  const riskScore = node.data.riskScore as number | undefined
  const riskColor =
    riskScore !== undefined
      ? riskScore > 65
        ? '#ef4444'
        : riskScore > 40
        ? '#eab308'
        : '#3b82f6'
      : '#64748b'

  return (
    <Panel position="bottom-left">
      <div
        style={{
          background: 'rgba(26,34,48,0.98)',
          border: '1px solid rgba(148,163,184,0.2)',
          borderRadius: 8,
          padding: '12px 16px',
          minWidth: 280,
          maxWidth: 400,
          backdropFilter: 'blur(8px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          animation: 'slide-in-up 0.15s ease-out',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' }}>
              {String(node.data.label)}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {String(node.data.nodeType).replace('_', ' ')}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(148,163,184,0.1)',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              borderRadius: 4,
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {riskScore !== undefined && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, color: '#64748b' }}>Risk score</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: riskColor, fontFamily: 'JetBrains Mono, monospace' }}>
                {riskScore}
                <span style={{ fontSize: 9, color: '#475569', fontWeight: 400, marginLeft: 2 }}>/100</span>
              </span>
            </div>
          )}

          {Boolean(node.data.ip) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, color: '#64748b' }}>IP address</span>
              <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
                {String(node.data.ip)}
              </span>
            </div>
          )}

          {Boolean(node.data.role) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, color: '#64748b' }}>Role</span>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>{String(node.data.role)}</span>
            </div>
          )}

          {Boolean(node.data.title) && (
            <div
              style={{
                marginTop: 4,
                padding: '6px 8px',
                background: 'rgba(148,163,184,0.05)',
                borderRadius: 4,
                border: '1px solid rgba(148,163,184,0.08)',
              }}
            >
              <span style={{ fontSize: 10, color: '#94a3b8' }}>{String(node.data.title)}</span>
            </div>
          )}

          {Boolean(node.data.asn) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, color: '#64748b' }}>ASN</span>
              <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
                {String(node.data.asn)}
              </span>
            </div>
          )}

          {Boolean(node.data.severity) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, color: '#64748b' }}>Severity</span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: riskColor,
                  background: `${riskColor}1a`,
                  padding: '1px 6px',
                  borderRadius: 3,
                  letterSpacing: '0.05em',
                }}
              >
                {String(node.data.severity).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: '1px solid rgba(148,163,184,0.08)',
            display: 'flex',
            gap: 6,
          }}
        >
          <button
            style={{
              flex: 1,
              padding: '5px 0',
              background: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.25)',
              borderRadius: 4,
              color: '#60a5fa',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            View details
          </button>
          <button
            style={{
              flex: 1,
              padding: '5px 0',
              background: 'transparent',
              border: '1px solid rgba(148,163,184,0.1)',
              borderRadius: 4,
              color: '#64748b',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Filter edges
          </button>
        </div>
      </div>
    </Panel>
  )
}

function EdgeInfoPanel({ edge, onClose }: { edge: Edge; onClose: () => void }) {
  const data = edge.data as Record<string, unknown> | undefined
  if (!data) return null

  return (
    <Panel position="bottom-left">
      <div
        style={{
          background: 'rgba(26,34,48,0.98)',
          border: '1px solid rgba(148,163,184,0.2)',
          borderRadius: 8,
          padding: '12px 16px',
          minWidth: 260,
          backdropFilter: 'blur(8px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0' }}>
            {edge.source} → {edge.target}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#64748b', fontSize: 16,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {Boolean(data.protocol) && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, color: '#64748b' }}>Protocol</span>
              <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
                {String(data.protocol)}
              </span>
            </div>
          )}
          {Boolean(data.bytes) && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, color: '#64748b' }}>Bytes</span>
              <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
                {Number(data.bytes).toLocaleString()}
              </span>
            </div>
          )}
          {Boolean(data.packets) && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, color: '#64748b' }}>Packets</span>
              <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
                {Number(data.packets).toLocaleString()}
              </span>
            </div>
          )}
          {Boolean(data.riskScore) && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, color: '#64748b' }}>Risk score</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>
                {String(data.riskScore)}
              </span>
            </div>
          )}
        </div>
      </div>
    </Panel>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner graph (needs useReactFlow, must be inside ReactFlowProvider)
// ─────────────────────────────────────────────────────────────────────────────

const EXTERNAL_NODE_TYPES = new Set(['external_ip', 'domain'])

interface NetworkMeshInnerProps extends NetworkMeshProps {
  mode: MeshMode
}

function NetworkMeshInner({
  mode: initialMode,
  showControls = true,
  showMinimap = true,
  highlightEntityId,
  onNodeClick,
  onEdgeClick,
  compact = false,
}: NetworkMeshInnerProps) {
  const [mode, setMode] = useState<MeshMode>(initialMode)
  const [searchQuery, setSearchQuery] = useState('')
  const [showExternal, setShowExternal] = useState(true)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null)

  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      hostNode: HostNode as unknown as NodeTypes[string],
      domainNode: DomainNode as unknown as NodeTypes[string],
      externalNode: ExternalNode as unknown as NodeTypes[string],
      serviceNode: ServiceNode as unknown as NodeTypes[string],
      findingNode: FindingNode as unknown as NodeTypes[string],
      incidentNode: IncidentNode as unknown as NodeTypes[string],
    }),
    []
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(DEMO_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState(DEMO_EDGES)

  // Live data first: replace the demo graph with the analysed capture's
  // topology. Demo stays until the backend answers, so the mesh is never blank.
  useEffect(() => {
    let cancelled = false
    buildLiveMesh().then(live => {
      if (live && !cancelled && live.nodes.length) {
        setNodes(live.nodes)
        setEdges(live.edges)
      }
    })
    return () => { cancelled = true }
  }, [setNodes, setEdges])

  // Filter nodes based on search and showExternal toggle
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => {
        const nodeData = n.data as MeshNodeData
        const isExternal = EXTERNAL_NODE_TYPES.has(nodeData.nodeType)
        const matchesSearch =
          !searchQuery ||
          String(nodeData.label).toLowerCase().includes(searchQuery.toLowerCase()) ||
          String(nodeData.entityId).toLowerCase().includes(searchQuery.toLowerCase())

        const hidden = (!showExternal && isExternal) || (!matchesSearch && searchQuery !== '')

        return {
          ...n,
          hidden,
          style: {
            ...n.style,
            opacity: highlightEntityId
              ? nodeData.entityId === highlightEntityId
                ? 1
                : 0.3
              : 1,
          },
        }
      })
    )
  }, [searchQuery, showExternal, highlightEntityId, setNodes])

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node)
      setSelectedEdge(null)
      onNodeClick?.(String(node.data.nodeType), String(node.data.entityId))
    },
    [onNodeClick]
  )

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setSelectedEdge(edge)
      setSelectedNode(null)
      onEdgeClick?.(edge.source, edge.target, edge.data)
    },
    [onEdgeClick]
  )

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null)
    setSelectedEdge(null)
  }, [])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      onNodeClick={handleNodeClick}
      onEdgeClick={handleEdgeClick}
      onPaneClick={handlePaneClick}
      fitView
      fitViewOptions={{ padding: 0.12 }}
      attributionPosition="bottom-left"
      style={{ background: 'radial-gradient(ellipse at center, #0D1420 0%, #0A0E14 100%)' }}
      minZoom={0.2}
      maxZoom={2.5}
      defaultEdgeOptions={{
        style: { strokeWidth: 1.5 },
      }}
    >
      <Background
        color="#242B36"
        gap={24}
        size={1}
        variant={BackgroundVariant.Dots}
      />
      {showControls && !compact && <Controls />}
      {showMinimap && !compact && (
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as MeshNodeData
            return d.riskScore >= 80 ? '#E8483A' : d.riskScore >= 60 ? '#E8863A' : d.riskScore >= 40 ? '#E8C93A' : '#4B7BE5'
          }}
          maskColor="rgba(10,14,20,0.85)"
        />
      )}

      {/* Toolbar panel */}
      {!compact && (
        <MeshToolbar
          mode={mode}
          onModeChange={setMode}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          showExternal={showExternal}
          onToggleExternal={() => setShowExternal((s) => !s)}
        />
      )}

      {/* Legend */}
      {!compact && <MeshLegend />}

      {/* Info panels */}
      {selectedNode && !compact && (
        <NodeInfoPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
      )}
      {selectedEdge && !compact && (
        <EdgeInfoPanel edge={selectedEdge} onClose={() => setSelectedEdge(null)} />
      )}
    </ReactFlow>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Public export (wraps in ReactFlowProvider)
// ─────────────────────────────────────────────────────────────────────────────

export function NetworkMesh({
  mode = 'threat',
  height = '100%',
  showControls = true,
  showMinimap = true,
  highlightEntityId,
  onNodeClick,
  onEdgeClick,
  compact = false,
}: NetworkMeshProps) {
  return (
    <div
      style={{
        width: '100%',
        height,
        background: 'radial-gradient(ellipse at center, #0D1420 0%, #0A0E14 100%)',
        borderRadius: compact ? 0 : 2,
        border: '1px solid #242B36',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <ReactFlowProvider>
        <NetworkMeshInner
          mode={mode}
          height={height}
          showControls={showControls}
          showMinimap={showMinimap}
          highlightEntityId={highlightEntityId}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          compact={compact}
        />
      </ReactFlowProvider>
    </div>
  )
}

export default NetworkMesh
