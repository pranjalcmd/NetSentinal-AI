'use client'

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'
import type { Capture, CaptureSession, CaptureSegment } from '@/lib/types'
import { MOCK_CAPTURES } from '@/lib/mock/data'
import { simulationEngine } from '@/lib/mock/simulation'

export interface UploadJob {
  id: string
  filename: string
  progressPercent: number
  status: 'pending' | 'uploading' | 'complete' | 'failed'
  sizeBytes: number
  error?: string
}

export interface RollingBufferStatus {
  sensorId: string
  bufferPercent: number
  segmentCount: number
  totalBytes: number
}

export interface CaptureContextValue {
  captures: Capture[]
  activeManualSession: CaptureSession | null
  activeSensorId: string | null
  rollingBuffer: RollingBufferStatus | null
  activeUploads: UploadJob[]
  isCapturing: boolean
  startManualCapture: (sensorId: string) => void
  stopManualCapture: () => void
  uploadPcap: (file: File) => Promise<Capture>
  getCaptureById: (id: string) => Capture | undefined
  deleteCapture: (id: string) => void
  refreshCaptures: () => void
}

const CaptureContext = createContext<CaptureContextValue | undefined>(undefined)

export interface CaptureProviderProps {
  children: React.ReactNode
  initialCaptures?: Capture[]
}

export const CaptureProvider: React.FC<CaptureProviderProps> = ({
  children,
  initialCaptures = MOCK_CAPTURES,
}) => {
  const [captures, setCaptures] = useState<Capture[]>(initialCaptures)
  const [activeManualSession, setActiveManualSession] = useState<CaptureSession | null>(null)
  const [activeSensorId, setActiveSensorId] = useState<string | null>(null)
  const [rollingBuffer, setRollingBuffer] = useState<RollingBufferStatus | null>({
    sensorId: 'SNS-042',
    bufferPercent: 68.4,
    segmentCount: 12,
    totalBytes: 717225984,
  })
  const [activeUploads, setActiveUploads] = useState<UploadJob[]>([])

  // Subscribe to simulation engine manual capture events
  useEffect(() => {
    const unsubStart = simulationEngine.on('capture:manual:started', ({ sensorId, session }) => {
      setActiveSensorId(sensorId)
      setActiveManualSession(session)
    })

    const unsubProgress = simulationEngine.on('capture:manual:progress', ({ sensorId, session }) => {
      setActiveSensorId(sensorId)
      setActiveManualSession(session)
    })

    const unsubReady = simulationEngine.on('capture:manual:ready', ({ capture }) => {
      setActiveManualSession(null)
      setActiveSensorId(null)
      setCaptures((prev) => [capture, ...prev])
    })

    const unsubRolling = simulationEngine.on('capture:rolling', (data) => {
      setRollingBuffer(data)
    })

    return () => {
      unsubStart()
      unsubProgress()
      unsubReady()
      unsubRolling()
    }
  }, [])

  const startManualCapture = useCallback((sensorId: string) => {
    simulationEngine.startManualCapture(sensorId)
    setActiveSensorId(sensorId)
  }, [])

  const stopManualCapture = useCallback(() => {
    simulationEngine.stopManualCapture()
  }, [])

  const uploadPcap = useCallback(async (file: File): Promise<Capture> => {
    const uploadId = `UPLOAD-${Date.now()}`
    const newUpload: UploadJob = {
      id: uploadId,
      filename: file.name,
      progressPercent: 0,
      status: 'uploading',
      sizeBytes: file.size,
    }

    setActiveUploads((prev) => [newUpload, ...prev])

    // Simulate progressive upload
    for (let progress = 20; progress <= 100; progress += 20) {
      await new Promise((resolve) => setTimeout(resolve, 300))
      setActiveUploads((prev) =>
        prev.map((job) =>
          job.id === uploadId
            ? { ...job, progressPercent: progress, status: progress === 100 ? 'complete' : 'uploading' }
            : job
        )
      )
    }

    const createdCapture: Capture = {
      id: `CAP-${Math.floor(2000 + Math.random() * 8000)}`,
      type: 'UPLOADED',
      status: 'ANALYZED',
      sensorId: 'SNS-042',
      sensorName: 'ACME-SENSOR-01',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      endTime: new Date().toISOString(),
      duration: 3600,
      sizeBytes: file.size,
      triggerIds: [],
      customerId: 'CUST-001',
      engagementId: 'ENG-001',
      filename: file.name,
      uploadedAt: new Date().toISOString(),
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      metadata: {
        packets: Math.floor(file.size / 128),
        flows: Math.floor(file.size / 1024),
        hosts: 14,
        protocols: ['HTTP', 'DNS', 'TLS 1.3', 'TCP'],
      },
    }

    setCaptures((prev) => [createdCapture, ...prev])
    setTimeout(() => {
      setActiveUploads((prev) => prev.filter((job) => job.id !== uploadId))
    }, 2000)

    return createdCapture
  }, [])

  const getCaptureById = useCallback(
    (id: string) => captures.find((c) => c.id === id),
    [captures]
  )

  const deleteCapture = useCallback((id: string) => {
    setCaptures((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const refreshCaptures = useCallback(() => {
    setCaptures([...MOCK_CAPTURES])
  }, [])

  const value = useMemo(
    () => ({
      captures,
      activeManualSession,
      activeSensorId,
      rollingBuffer,
      activeUploads,
      isCapturing: Boolean(activeManualSession),
      startManualCapture,
      stopManualCapture,
      uploadPcap,
      getCaptureById,
      deleteCapture,
      refreshCaptures,
    }),
    [
      captures,
      activeManualSession,
      activeSensorId,
      rollingBuffer,
      activeUploads,
      startManualCapture,
      stopManualCapture,
      uploadPcap,
      getCaptureById,
      deleteCapture,
      refreshCaptures,
    ]
  )

  return <CaptureContext.Provider value={value}>{children}</CaptureContext.Provider>
}

export function useCaptureContext(): CaptureContextValue {
  const context = useContext(CaptureContext)
  if (!context) {
    throw new Error('useCaptureContext must be used within a CaptureProvider')
  }
  return context
}

export default CaptureContext
