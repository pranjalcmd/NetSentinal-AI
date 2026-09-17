/**
 * NetSentinal AI — Simulation Engine
 *
 * A client-side simulation engine that drives live state updates for the demo.
 * It models the real-time behavior of:
 *
 *  1. LiveSensorMetrics     — sensor throughput metrics with realistic fluctuation
 *  2. RollingCaptureState   — ring-buffer tracking, segment rotation
 *  3. ManualCaptureLifecycle — start/stop/finalize a manual capture
 *  4. TriggerQueue          — periodic arrival of new detection triggers
 *  5. AutoPreservation      — trigger score → auto-preserve workflow
 *  6. AnalysisStages        — simulated pipeline stage progression
 *  7. EventEmitter          — pub/sub for React component subscriptions
 *
 * Usage:
 *   import { simulationEngine, useSimulation } from '@/lib/mock/simulation'
 *
 *   // In a React component:
 *   useSimulation('sensor:metrics', (data) => setSensorMetrics(data))
 */

'use client'

import { useEffect, useRef } from 'react'
import type {
  Sensor,
  SensorMetrics,
  CaptureSession,
  Capture,
  CaptureSegment,
  Trigger,
  TriggerSignal,
  AnalysisStage,
  InvestigationProgress,
} from '../types'
import {
  MOCK_SENSORS,
  MOCK_CAPTURES,
  MOCK_INVESTIGATIONS,
  MOCK_TRIGGERS,
} from './data'

// ─────────────────────────────────────────────────────────────────────────────
// Event types
// ─────────────────────────────────────────────────────────────────────────────

export type SimulationEventMap = {
  /** Sensor metrics updated for a specific sensor */
  'sensor:metrics': { sensorId: string; metrics: SensorMetrics }
  /** Sensor status changed */
  'sensor:status': { sensorId: string; sensor: Sensor }
  /** Rolling capture buffer state updated */
  'capture:rolling': { sensorId: string; bufferPercent: number; segmentCount: number; totalBytes: number }
  /** A new rolling capture segment was created */
  'capture:segment': { sensorId: string; segment: CaptureSegment }
  /** Manual capture started */
  'capture:manual:started': { sensorId: string; session: CaptureSession }
  /** Manual capture progress tick */
  'capture:manual:progress': { sensorId: string; session: CaptureSession }
  /** Manual capture stopped and finalizing */
  'capture:manual:finalizing': { sensorId: string; captureId: string }
  /** Manual capture ready */
  'capture:manual:ready': { sensorId: string; capture: Capture }
  /** A new trigger arrived */
  'trigger:new': { trigger: Trigger }
  /** Trigger status updated */
  'trigger:update': { trigger: Trigger }
  /** Auto-preservation started */
  'preservation:started': { triggerId: string; captureId: string; reason: string }
  /** Auto-preservation complete */
  'preservation:complete': { triggerId: string; captureId: string }
  /** Analysis stage updated */
  'investigation:stage': { investigationId: string; stage: AnalysisStage; stageIndex: number }
  /** Investigation progress updated */
  'investigation:progress': { investigationId: string; progress: InvestigationProgress }
  /** Investigation completed */
  'investigation:complete': { investigationId: string }
  /** General notification */
  'notification': { type: 'info' | 'warning' | 'error' | 'success'; title: string; message: string }
}

export type SimulationEventKey = keyof SimulationEventMap

type Listener<K extends SimulationEventKey> = (data: SimulationEventMap[K]) => void

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic pseudo-random (seeded LCG for reproducible values)
// ─────────────────────────────────────────────────────────────────────────────

class SeededRandom {
  private seed: number

  constructor(seed = 42) {
    this.seed = seed
  }

  /** Returns a float in [0, 1) */
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0xffffffff
    return (this.seed >>> 0) / 0x100000000
  }

  /** Returns a float in [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /** Returns an int in [min, max] */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  /** Returns ±1 */
  sign(): number {
    return this.next() > 0.5 ? 1 : -1
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutable simulation state
// ─────────────────────────────────────────────────────────────────────────────

interface SensorSimState {
  metrics: SensorMetrics
  captureEngine: {
    healthy: boolean
    rollingCapture: boolean
    manualCapture: CaptureSession | null
    autoPreservation: boolean
    queuedUploads: number
  }
  segmentCount: number
  totalBufferBytes: number
  lastSegmentTime: number
}

interface ManualCaptureState {
  sensorId: string
  captureId: string
  startTime: number
  elapsedSeconds: number
  sizeBytes: number
  finalizingAt?: number
}

interface AutoPreservationState {
  triggerId: string
  captureId: string
  startedAt: number
  phase: 'preserving' | 'complete'
  preBytes: number
  postBytes: number
}

interface InvestigationSimState {
  investigationId: string
  currentStageIndex: number
  stages: AnalysisStage[]
  progress: InvestigationProgress
  startedAt: number
  stageStartedAt: number
}

// ─────────────────────────────────────────────────────────────────────────────
// SimulationEngine class
// ─────────────────────────────────────────────────────────────────────────────

export class SimulationEngine {
  private listeners: Map<SimulationEventKey, Set<Listener<SimulationEventKey>>> = new Map()
  private intervals: ReturnType<typeof setInterval>[] = []
  private timeouts: ReturnType<typeof setTimeout>[] = []
  private rng = new SeededRandom(42)
  private running = false
  private tickCount = 0

  // State maps
  private sensorState: Map<string, SensorSimState> = new Map()
  private manualCapture: ManualCaptureState | null = null
  private autoPreservation: AutoPreservationState | null = null
  private investigationSim: InvestigationSimState | null = null
  private triggerQueue: Trigger[] = []
  private captureIdCounter = 2000
  private segmentIdCounter = 1000

  constructor() {
    this.initializeSensorState()
    this.initializeInvestigationSim()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────────────────────────────────

  private initializeSensorState(): void {
    for (const sensor of MOCK_SENSORS) {
      this.sensorState.set(sensor.id, {
        metrics: { ...sensor.metrics },
        captureEngine: { ...sensor.captureEngine },
        segmentCount: 12,
        totalBufferBytes: sensor.metrics.bufferSize * sensor.metrics.bufferPercent / 100,
        lastSegmentTime: Date.now() - 45000, // 45s ago
      })
    }
  }

  private initializeInvestigationSim(): void {
    const inv = MOCK_INVESTIGATIONS[0]
    if (!inv) return

    // Only simulate running investigations; completed ones are static
    if (inv.status === 'completed') return

    this.investigationSim = {
      investigationId: inv.id,
      currentStageIndex: 0,
      stages: inv.stages.map(s => ({ ...s })),
      progress: { ...inv.progress },
      startedAt: Date.now(),
      stageStartedAt: Date.now(),
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Start / Stop
  // ─────────────────────────────────────────────────────────────────────────

  start(): void {
    if (this.running) return
    this.running = true

    // 1. Sensor metrics — every 2 seconds
    this.intervals.push(
      setInterval(() => this.tickSensorMetrics(), 2000)
    )

    // 2. Rolling capture segments — every 60 seconds
    this.intervals.push(
      setInterval(() => this.tickRollingCapture(), 60000)
    )

    // 3. Manual capture progress — every 1 second (when active)
    this.intervals.push(
      setInterval(() => this.tickManualCapture(), 1000)
    )

    // 4. Auto-preservation progress — every 500ms (when active)
    this.intervals.push(
      setInterval(() => this.tickAutoPreservation(), 500)
    )

    // 5. Trigger queue — every 30-90 seconds
    this.scheduleNextTrigger()

    // 6. Investigation stages — every 5 seconds (when running)
    this.intervals.push(
      setInterval(() => this.tickInvestigation(), 5000)
    )
  }

  stop(): void {
    this.running = false
    for (const interval of this.intervals) clearInterval(interval)
    for (const timeout of this.timeouts) clearTimeout(timeout)
    this.intervals = []
    this.timeouts = []
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sensor metrics simulation
  // ─────────────────────────────────────────────────────────────────────────

  private tickSensorMetrics(): void {
    this.tickCount++

    for (const [sensorId, state] of this.sensorState.entries()) {
      const sensor = MOCK_SENSORS.find(s => s.id === sensorId)
      if (!sensor || sensor.status === 'offline') continue
      if (sensor.status === 'degraded') {
        // Degraded sensor: occasionally flicker metrics
        if (this.tickCount % 8 === 0) {
          state.metrics.mbps = 0
          state.metrics.pps = 0
          state.metrics.flowsPerSec = 0
        }
        this.emit('sensor:metrics', { sensorId, metrics: { ...state.metrics } })
        continue
      }

      const baseMetrics = sensor.metrics

      // Apply small random deltas with mean-reversion to baseline
      const revert = 0.05 // 5% pull back to baseline per tick
      state.metrics.mbps = this.applyDelta(state.metrics.mbps, baseMetrics.mbps, 0.05, revert, 10, 1500)
      state.metrics.pps = this.applyDelta(state.metrics.pps, baseMetrics.pps, 0.03, revert, 100, 30000)
      state.metrics.flowsPerSec = this.applyDelta(state.metrics.flowsPerSec, baseMetrics.flowsPerSec, 0.04, revert, 10, 5000)
      state.metrics.activeHosts = Math.max(1, state.metrics.activeHosts + (this.rng.sign() * this.rng.int(0, 3)))

      // Buffer grows as data arrives
      const newBytes = state.metrics.mbps * 125000 * 2 // bytes per 2s tick
      state.totalBufferBytes += newBytes
      // Buffer wraps (ring buffer — oldest data evicted)
      if (state.totalBufferBytes > state.metrics.bufferSize) {
        state.totalBufferBytes = state.metrics.bufferSize * (0.75 + this.rng.range(0, 0.15))
      }
      state.metrics.bufferPercent = Math.min(100, Math.round(
        (state.totalBufferBytes / state.metrics.bufferSize) * 100
      ))

      this.emit('sensor:metrics', { sensorId, metrics: { ...state.metrics } })

      // Emit rolling capture state
      this.emit('capture:rolling', {
        sensorId,
        bufferPercent: state.metrics.bufferPercent,
        segmentCount: state.segmentCount,
        totalBytes: state.totalBufferBytes,
      })
    }
  }

  private applyDelta(
    current: number,
    baseline: number,
    maxDeltaPct: number,
    revertStrength: number,
    min: number,
    max: number
  ): number {
    const delta = this.rng.range(-maxDeltaPct, maxDeltaPct) * current
    const revert = (baseline - current) * revertStrength
    return Math.round(Math.min(max, Math.max(min, current + delta + revert)))
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Rolling capture segments
  // ─────────────────────────────────────────────────────────────────────────

  private tickRollingCapture(): void {
    for (const [sensorId, state] of this.sensorState.entries()) {
      const sensor = MOCK_SENSORS.find(s => s.id === sensorId)
      if (!sensor || sensor.status !== 'online' || !state.captureEngine.rollingCapture) continue

      const segId = `SEG-ROLL-${sensorId}-${++this.segmentIdCounter}`
      const now = new Date().toISOString()
      const segStartTime = new Date(Date.now() - 60000).toISOString()
      const segBytes = Math.round(state.metrics.mbps * 125000 * 60) // bytes per 60s

      const segment: CaptureSegment = {
        id: segId,
        captureId: `CAP-ROLL-${sensorId}`,
        index: state.segmentCount,
        startTime: segStartTime,
        endTime: now,
        sizeBytes: segBytes,
        sha256: this.fakeHash(),
        status: 'complete',
      }

      state.segmentCount++
      state.lastSegmentTime = Date.now()

      this.emit('capture:segment', { sensorId, segment })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Manual capture lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  startManualCapture(sensorId: string): string {
    if (this.manualCapture) {
      throw new Error('A manual capture is already in progress')
    }

    const captureId = `CAP-${++this.captureIdCounter}`
    const session: CaptureSession = {
      captureId,
      startTime: new Date().toISOString(),
      elapsedSeconds: 0,
      sizeBytes: 0,
    }

    this.manualCapture = {
      sensorId,
      captureId,
      startTime: Date.now(),
      elapsedSeconds: 0,
      sizeBytes: 0,
    }

    // Update sensor state
    const state = this.sensorState.get(sensorId)
    if (state) state.captureEngine.manualCapture = session

    this.emit('capture:manual:started', { sensorId, session })
    this.emit('notification', {
      type: 'info',
      title: 'Manual capture started',
      message: `Recording on ${sensorId} — capture ID: ${captureId}`,
    })

    return captureId
  }

  stopManualCapture(): void {
    if (!this.manualCapture) return

    const { sensorId, captureId, elapsedSeconds } = this.manualCapture
    this.manualCapture.finalizingAt = Date.now()

    const state = this.sensorState.get(sensorId)
    if (state) state.captureEngine.manualCapture = null

    this.emit('capture:manual:finalizing', { sensorId, captureId })
    this.emit('notification', {
      type: 'info',
      title: 'Manual capture stopping',
      message: `Finalizing ${captureId} — duration: ${Math.floor(elapsedSeconds)}s`,
    })

    // Simulate finalization delay (3-6 seconds)
    const t = setTimeout(() => {
      const sizeBytes = this.manualCapture?.sizeBytes ?? 0
      const capture: Capture = {
        id: captureId,
        type: 'MANUAL',
        status: 'READY',
        sensorId,
        sensorName: MOCK_SENSORS.find(s => s.id === sensorId)?.name ?? sensorId,
        startTime: new Date(Date.now() - elapsedSeconds * 1000).toISOString(),
        endTime: new Date().toISOString(),
        duration: Math.floor(elapsedSeconds),
        sizeBytes,
        triggerIds: [],
        sha256: this.fakeHash(),
        customerId: 'CUST-001',
        engagementId: 'ENG-001',
        metadata: {
          protocols: ['TLS 1.3', 'DNS', 'HTTP/2', 'TCP', 'UDP'],
        },
      }

      this.manualCapture = null
      this.emit('capture:manual:ready', { sensorId, capture })
      this.emit('notification', {
        type: 'success',
        title: 'Manual capture ready',
        message: `${captureId} finalized — ${Math.round(sizeBytes / 1048576)} MB captured.`,
      })
    }, 4000)
    this.timeouts.push(t)
  }

  private tickManualCapture(): void {
    if (!this.manualCapture || this.manualCapture.finalizingAt !== undefined) return

    const { sensorId } = this.manualCapture
    const state = this.sensorState.get(sensorId)
    if (!state) return

    this.manualCapture.elapsedSeconds = (Date.now() - this.manualCapture.startTime) / 1000
    this.manualCapture.sizeBytes += state.metrics.mbps * 125000 // bytes per second

    const session: CaptureSession = {
      captureId: this.manualCapture.captureId,
      startTime: new Date(this.manualCapture.startTime).toISOString(),
      elapsedSeconds: Math.floor(this.manualCapture.elapsedSeconds),
      sizeBytes: Math.round(this.manualCapture.sizeBytes),
    }

    if (state.captureEngine.manualCapture) {
      state.captureEngine.manualCapture = session
    }

    this.emit('capture:manual:progress', { sensorId, session })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Trigger queue
  // ─────────────────────────────────────────────────────────────────────────

  private scheduleNextTrigger(): void {
    if (!this.running) return
    // Random delay between 30 and 90 seconds
    const delayMs = this.rng.int(30000, 90000)
    const t = setTimeout(() => {
      this.generateTrigger()
      this.scheduleNextTrigger()
    }, delayMs)
    this.timeouts.push(t)
  }

  private generateTrigger(): void {
    const scores = [38, 52, 61, 44, 57, 33, 48, 67, 41, 55]
    const hostIps = ['10.0.0.22', '10.0.0.31', '10.0.0.8', '10.0.0.19', '10.0.0.45']
    const dstIps = ['185.130.44.108', '204.11.56.48', '91.214.44.243', '5.188.86.114', '45.146.164.110']

    const score = scores[this.tickCount % scores.length]
    const severity = score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low'
    const srcIp = hostIps[this.tickCount % hostIps.length]
    const dstIp = dstIps[this.tickCount % dstIps.length]

    const signals: TriggerSignal[] = [
      {
        type: 'destination_novelty',
        label: 'Destination novelty',
        value: `${dstIp} — first contact this month`,
        weight: 0.40,
      },
      {
        type: 'ml_anomaly',
        label: 'ML behavioral anomaly',
        value: `Isolation Forest score: ${(0.5 + this.rng.range(0, 0.4)).toFixed(2)}`,
        weight: 0.35,
      },
      {
        type: 'outbound_volume',
        label: 'Outbound volume delta',
        value: `+${this.rng.int(120, 400)}% vs 7-day baseline`,
        weight: 0.25,
      },
    ]

    const triggerId = `TRG-SIM-${Date.now()}`
    const trigger: Trigger = {
      id: triggerId,
      score,
      severity: severity as Trigger['severity'],
      status: 'active',
      entityId: srcIp,
      entityType: 'host',
      signals,
      timestamp: new Date().toISOString(),
    }

    this.triggerQueue.push(trigger)
    this.emit('trigger:new', { trigger })

    if (score >= 85) {
      this.startAutoPreservation(trigger)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Auto-preservation
  // ─────────────────────────────────────────────────────────────────────────

  private startAutoPreservation(trigger: Trigger): void {
    if (this.autoPreservation) return // already preserving

    const captureId = `CAP-${++this.captureIdCounter}`
    const reason = `Auto-preservation triggered: composite score ${trigger.score}/100 exceeded threshold 85.`

    this.autoPreservation = {
      triggerId: trigger.id,
      captureId,
      startedAt: Date.now(),
      phase: 'preserving',
      preBytes: 0,
      postBytes: 0,
    }

    this.emit('preservation:started', { triggerId: trigger.id, captureId, reason })
    this.emit('notification', {
      type: 'error',
      title: `Auto-preservation triggered (${trigger.id})`,
      message: `Score ${trigger.score} on ${trigger.entityId}. Preserving ring buffer → ${captureId}`,
    })

    // Simulate updated trigger status
    const updatedTrigger: Trigger = {
      ...trigger,
      status: 'preserving',
      captureId,
      preservationReason: reason,
    }
    this.emit('trigger:update', { trigger: updatedTrigger })

    // Complete preservation after 8-12 seconds
    const t = setTimeout(() => {
      if (!this.autoPreservation) return
      this.autoPreservation.phase = 'complete'
      this.emit('preservation:complete', { triggerId: trigger.id, captureId })
      this.emit('trigger:update', {
        trigger: { ...updatedTrigger, status: 'preserved' },
      })
      this.emit('notification', {
        type: 'success',
        title: 'Auto-preservation complete',
        message: `${captureId} preserved. Pre-event + post-event buffer captured.`,
      })
      this.autoPreservation = null
    }, this.rng.int(8000, 12000))
    this.timeouts.push(t)
  }

  private tickAutoPreservation(): void {
    if (!this.autoPreservation || this.autoPreservation.phase !== 'preserving') return

    const sensorState = this.sensorState.get('SNS-042')
    if (!sensorState) return

    const elapsed = (Date.now() - this.autoPreservation.startedAt) / 1000
    this.autoPreservation.postBytes += sensorState.metrics.mbps * 125000 * 0.5 // every 500ms
    this.autoPreservation.preBytes = sensorState.metrics.mbps * 125000 * 900 * 0.15 // ~15min pre-event
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Investigation stage simulation
  // ─────────────────────────────────────────────────────────────────────────

  private tickInvestigation(): void {
    if (!this.investigationSim) return

    const sim = this.investigationSim
    if (sim.currentStageIndex >= sim.stages.length) {
      this.emit('investigation:complete', { investigationId: sim.investigationId })
      this.investigationSim = null
      return
    }

    const stage = sim.stages[sim.currentStageIndex]
    const now = new Date().toISOString()
    const stageElapsed = (Date.now() - sim.stageStartedAt) / 1000

    if (stage.status === 'pending') {
      // Start this stage
      stage.status = 'running'
      stage.startTime = now
      this.emit('investigation:stage', {
        investigationId: sim.investigationId,
        stage: { ...stage },
        stageIndex: sim.currentStageIndex,
      })
    } else if (stage.status === 'running') {
      // Simulate progress
      const stageDuration = this.getStageDuration(stage.name)
      if (stageElapsed >= stageDuration) {
        // Complete this stage
        stage.status = 'completed'
        stage.endTime = now
        if (stage.itemsTotal) stage.itemsProcessed = stage.itemsTotal

        this.emit('investigation:stage', {
          investigationId: sim.investigationId,
          stage: { ...stage },
          stageIndex: sim.currentStageIndex,
        })

        // Update progress based on stage
        this.updateInvestigationProgress(sim, stage.name)
        this.emit('investigation:progress', {
          investigationId: sim.investigationId,
          progress: { ...sim.progress },
        })

        // Move to next stage
        sim.currentStageIndex++
        sim.stageStartedAt = Date.now()
      } else {
        // Emit in-progress update
        if (stage.itemsTotal) {
          stage.itemsProcessed = Math.round((stageElapsed / stageDuration) * stage.itemsTotal)
        }
        this.emit('investigation:stage', {
          investigationId: sim.investigationId,
          stage: { ...stage },
          stageIndex: sim.currentStageIndex,
        })
      }
    }
  }

  private getStageDuration(stageName: string): number {
    const durations: Record<string, number> = {
      'Capture Validation':    2,
      'Packet Ingest':         8,
      'Flow Extraction':       12,
      'Deep Packet Inspection': 18,
      'Feature Extraction':    8,
      'Rule Engine':           6,
      'ML Anomaly Detection':  10,
      'Periodicity Analysis':  5,
      'Finding Correlation':   7,
      'AI Narrative Generation': 15,
      'Graph Index':           5,
      'Report Scaffold':       3,
    }
    return durations[stageName] ?? 10
  }

  private updateInvestigationProgress(sim: InvestigationSimState, stageName: string): void {
    switch (stageName) {
      case 'Packet Ingest':
        sim.progress.flowsProcessed = Math.round(sim.progress.flowsProcessed * 0.3)
        break
      case 'Flow Extraction':
        sim.progress.flowsProcessed = Math.round(28491 * 0.8)
        sim.progress.hostsIdentified = Math.round(287 * 0.6)
        break
      case 'Deep Packet Inspection':
        sim.progress.flowsProcessed = 28491
        sim.progress.hostsIdentified = 287
        sim.progress.protocolsFound = 6
        break
      case 'Finding Correlation':
        sim.progress.findingsSoFar = 3
        break
      case 'AI Narrative Generation':
        sim.progress.findingsSoFar = 5
        break
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Start a fresh investigation sim (for demo re-runs)
  // ─────────────────────────────────────────────────────────────────────────

  startInvestigationSim(investigationId: string): void {
    const inv = MOCK_INVESTIGATIONS.find(i => i.id === investigationId)
    if (!inv) return

    this.investigationSim = {
      investigationId,
      currentStageIndex: 0,
      stages: inv.stages.map(s => ({ ...s, status: 'pending' as const, startTime: undefined, endTime: undefined, itemsProcessed: 0 })),
      progress: { flowsProcessed: 0, hostsIdentified: 0, protocolsFound: 0, findingsSoFar: 0, errors: [] },
      startedAt: Date.now(),
      stageStartedAt: Date.now(),
    }

    this.emit('notification', {
      type: 'info',
      title: 'Investigation started',
      message: `Analysis pipeline running for ${investigationId}.`,
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API for current state
  // ─────────────────────────────────────────────────────────────────────────

  getSensorState(sensorId: string): SensorSimState | undefined {
    return this.sensorState.get(sensorId)
  }

  getCurrentSensorMetrics(sensorId: string): SensorMetrics | undefined {
    return this.sensorState.get(sensorId)?.metrics
  }

  getManualCaptureState(): ManualCaptureState | null {
    return this.manualCapture
  }

  getAutoPreservationState(): AutoPreservationState | null {
    return this.autoPreservation
  }

  getInvestigationSimState(): InvestigationSimState | null {
    return this.investigationSim
  }

  getTriggerQueue(): Trigger[] {
    return [...this.triggerQueue]
  }

  isRunning(): boolean {
    return this.running
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event emitter
  // ─────────────────────────────────────────────────────────────────────────

  on<K extends SimulationEventKey>(event: K, listener: Listener<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    const set = this.listeners.get(event)!
    set.add(listener as Listener<SimulationEventKey>)

    // Return unsubscribe function
    return () => {
      set.delete(listener as Listener<SimulationEventKey>)
    }
  }

  off<K extends SimulationEventKey>(event: K, listener: Listener<K>): void {
    this.listeners.get(event)?.delete(listener as Listener<SimulationEventKey>)
  }

  emit<K extends SimulationEventKey>(event: K, data: SimulationEventMap[K]): void {
    const listeners = this.listeners.get(event)
    if (!listeners) return
    for (const listener of listeners) {
      try {
        ;(listener as Listener<K>)(data)
      } catch (err) {
        console.error(`[SimulationEngine] Error in listener for "${event}":`, err)
      }
    }
  }

  once<K extends SimulationEventKey>(event: K, listener: Listener<K>): void {
    const unsubscribe = this.on(event, (data) => {
      listener(data)
      unsubscribe()
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────────────────

  private fakeHash(): string {
    const chars = '0123456789abcdef'
    let hash = ''
    for (let i = 0; i < 64; i++) {
      const idx = Math.floor(this.rng.next() * 16)
      hash += chars[idx]
    }
    return hash
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Global singleton instance of the simulation engine.
 * Auto-starts when imported in the browser.
 */
export const simulationEngine = new SimulationEngine()

// Auto-start in browser environment
if (typeof window !== 'undefined') {
  simulationEngine.start()
}

// ─────────────────────────────────────────────────────────────────────────────
// React hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * React hook to subscribe to a simulation event.
 *
 * Automatically subscribes on mount and unsubscribes on unmount.
 * The callback is called with the event data each time the event fires.
 *
 * @example
 * useSimulation('sensor:metrics', ({ sensorId, metrics }) => {
 *   if (sensorId === 'SNS-042') setMetrics(metrics)
 * })
 */
export function useSimulation<K extends SimulationEventKey>(
  event: K,
  callback: Listener<K>
): void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    const handler: Listener<K> = (data) => callbackRef.current(data)
    const unsubscribe = simulationEngine.on(event, handler)
    return unsubscribe
  }, [event])
}

/**
 * React hook to subscribe to multiple simulation events at once.
 *
 * @example
 * useSimulations([
 *   ['sensor:metrics', handleMetrics],
 *   ['trigger:new', handleTrigger],
 * ])
 */
export function useSimulations(
  subscriptions: Array<[SimulationEventKey, Listener<SimulationEventKey>]>
): void {
  useEffect(() => {
    const unsubscribers = subscriptions.map(([event, listener]) =>
      simulationEngine.on(event, listener)
    )
    return () => {
      for (const unsub of unsubscribers) unsub()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/**
 * React hook for manual capture control.
 * Returns helpers to start and stop a manual capture on a sensor.
 *
 * @example
 * const { startCapture, stopCapture, captureId } = useManualCapture('SNS-042')
 */
export function useManualCapture(sensorId: string) {
  const start = () => simulationEngine.startManualCapture(sensorId)
  const stop = () => simulationEngine.stopManualCapture()
  const currentState = simulationEngine.getManualCaptureState()
  return {
    startCapture: start,
    stopCapture: stop,
    isCapturing: currentState?.sensorId === sensorId,
    captureId: currentState?.sensorId === sensorId ? currentState.captureId : null,
    elapsedSeconds: currentState?.sensorId === sensorId ? currentState.elapsedSeconds : 0,
    sizeBytes: currentState?.sensorId === sensorId ? currentState.sizeBytes : 0,
  }
}
