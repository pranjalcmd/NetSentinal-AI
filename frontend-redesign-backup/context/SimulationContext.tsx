'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import type { SensorMetrics, Trigger } from '@/lib/types'
import { simulationEngine, type SimulationEventMap } from '@/lib/mock/simulation'

export interface LiveFeedItem {
  id: string
  timestamp: string
  type: 'metrics' | 'trigger' | 'preservation' | 'segment'
  title: string
  detail: string
}

export interface SimulationContextValue {
  isSimulating: boolean
  sensorMetrics: Record<string, SensorMetrics>
  latestTrigger: Trigger | null
  triggers: Trigger[]
  liveFeed: LiveFeedItem[]
  startSimulation: () => void
  stopSimulation: () => void
  injectTestTrigger: (severity?: 'critical' | 'high' | 'medium') => void
}

const SimulationContext = createContext<SimulationContextValue | undefined>(undefined)

export interface SimulationProviderProps {
  children: React.ReactNode
  autoStart?: boolean
}

export const SimulationProvider: React.FC<SimulationProviderProps> = ({
  children,
  autoStart = true,
}) => {
  const [isSimulating, setIsSimulating] = useState<boolean>(autoStart)
  const [sensorMetrics, setSensorMetrics] = useState<Record<string, SensorMetrics>>({})
  const [latestTrigger, setLatestTrigger] = useState<Trigger | null>(null)
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [liveFeed, setLiveFeed] = useState<LiveFeedItem[]>([])

  const addFeedItem = useCallback((item: Omit<LiveFeedItem, 'id' | 'timestamp'>) => {
    const newItem: LiveFeedItem = {
      ...item,
      id: `FEED-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleTimeString(),
    }
    setLiveFeed((prev) => [newItem, ...prev.slice(0, 49)])
  }, [])

  useEffect(() => {
    if (autoStart) {
      simulationEngine.start()
      setIsSimulating(true)
    }

    // Subscribe to sensor metrics
    const unsubMetrics = simulationEngine.on('sensor:metrics', ({ sensorId, metrics }) => {
      setSensorMetrics((prev) => ({
        ...prev,
        [sensorId]: metrics,
      }))
    })

    // Subscribe to new triggers
    const unsubTrigger = simulationEngine.on('trigger:new', ({ trigger }) => {
      setLatestTrigger(trigger)
      setTriggers((prev) => [trigger, ...prev.slice(0, 99)])
      addFeedItem({
        type: 'trigger',
        title: `Trigger ${trigger.id} raised (${trigger.score} Risk)`,
        detail: `Severity ${trigger.severity.toUpperCase()} on entity ${trigger.entityId}`,
      })
    })

    // Subscribe to auto-preservation start
    const unsubPreserve = simulationEngine.on('preservation:started', ({ triggerId, captureId, reason }) => {
      addFeedItem({
        type: 'preservation',
        title: `Auto-preservation started for ${triggerId}`,
        detail: `Saving PCAP ${captureId}: ${reason}`,
      })
    })

    return () => {
      unsubMetrics()
      unsubTrigger()
      unsubPreserve()
    }
  }, [autoStart, addFeedItem])

  const startSimulation = useCallback(() => {
    simulationEngine.start()
    setIsSimulating(true)
  }, [])

  const stopSimulation = useCallback(() => {
    simulationEngine.stop()
    setIsSimulating(false)
  }, [])

  const injectTestTrigger = useCallback((severity: 'critical' | 'high' | 'medium' = 'high') => {
    const scoreMap = { critical: 92, high: 75, medium: 52 }
    const trigger: Trigger = {
      id: `TRG-${Math.floor(3000 + Math.random() * 7000)}`,
      score: scoreMap[severity],
      severity,
      status: 'active',
      entityId: '10.0.0.14',
      entityType: 'host',
      signals: [
        { type: 'dpi_risk', label: 'Suspicious Encrypted C2 Beacon', value: 'Port 443', weight: 0.5 },
        { type: 'periodicity', label: 'Fixed Interval Pulsing (30s)', value: '0.94', weight: 0.3 },
      ],
      timestamp: new Date().toISOString(),
    }
    setLatestTrigger(trigger)
    setTriggers((prev) => [trigger, ...prev])
    addFeedItem({
      type: 'trigger',
      title: `Manual Trigger Ingested (${severity.toUpperCase()})`,
      detail: `Injected test trigger score ${trigger.score}`,
    })
  }, [addFeedItem])

  const value = useMemo(
    () => ({
      isSimulating,
      sensorMetrics,
      latestTrigger,
      triggers,
      liveFeed,
      startSimulation,
      stopSimulation,
      injectTestTrigger,
    }),
    [
      isSimulating,
      sensorMetrics,
      latestTrigger,
      triggers,
      liveFeed,
      startSimulation,
      stopSimulation,
      injectTestTrigger,
    ]
  )

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>
}

export function useSimulationContext(): SimulationContextValue {
  const context = useContext(SimulationContext)
  if (!context) {
    throw new Error('useSimulationContext must be used within a SimulationProvider')
  }
  return context
}

export default SimulationContext
