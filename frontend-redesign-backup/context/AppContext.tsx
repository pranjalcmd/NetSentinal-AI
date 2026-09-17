'use client'

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import type {
  Customer,
  Engagement,
  ConsultantContext,
  AppNotification,
  ListFilters,
} from '@/lib/types'
import {
  MOCK_CUSTOMER,
  MOCK_ENGAGEMENT,
  MOCK_NOTIFICATIONS,
} from '@/lib/mock/data'

export interface AppStateContextValue {
  customer: Customer
  engagement: Engagement
  consultant: ConsultantContext
  notifications: AppNotification[]
  activeFilters: ListFilters
  searchQuery: string
  unreadNotificationCount: number
  setCustomer: (customer: Customer) => void
  setEngagement: (engagement: Engagement) => void
  setConsultant: (consultant: ConsultantContext) => void
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void
  markNotificationAsRead: (id: string) => void
  clearNotifications: () => void
  setSearchQuery: (query: string) => void
  setFilters: (filters: Partial<ListFilters>) => void
  resetFilters: () => void
}

const defaultFilters: ListFilters = {
  search: '',
  severity: undefined,
  status: undefined,
}

const AppContext = createContext<AppStateContextValue | undefined>(undefined)

export interface AppProviderProps {
  children: React.ReactNode
  initialCustomer?: Customer
  initialEngagement?: Engagement
  initialConsultant?: ConsultantContext
  initialNotifications?: AppNotification[]
}

export const AppProvider: React.FC<AppProviderProps> = ({
  children,
  initialCustomer = MOCK_CUSTOMER,
  initialEngagement = MOCK_ENGAGEMENT,
  initialConsultant = { name: 'Alex Morgan', role: 'Senior Security Consultant' },
  initialNotifications = MOCK_NOTIFICATIONS || [],
}) => {
  const [customer, setCustomer] = useState<Customer>(initialCustomer)
  const [engagement, setEngagement] = useState<Engagement>(initialEngagement)
  const [consultant, setConsultant] = useState<ConsultantContext>(initialConsultant)
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications)
  const [activeFilters, setActiveFiltersState] = useState<ListFilters>(defaultFilters)
  const [searchQuery, setSearchQuery] = useState<string>('')

  const addNotification = useCallback(
    (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
      const newNotif: AppNotification = {
        ...notif,
        id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        read: false,
      }
      setNotifications((prev) => [newNotif, ...prev])
    },
    []
  )

  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  const setFilters = useCallback((filters: Partial<ListFilters>) => {
    setActiveFiltersState((prev) => ({ ...prev, ...filters }))
  }, [])

  const resetFilters = useCallback(() => {
    setActiveFiltersState(defaultFilters)
    setSearchQuery('')
  }, [])

  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  )

  const value = useMemo(
    () => ({
      customer,
      engagement,
      consultant,
      notifications,
      activeFilters,
      searchQuery,
      unreadNotificationCount,
      setCustomer,
      setEngagement,
      setConsultant,
      addNotification,
      markNotificationAsRead,
      clearNotifications,
      setSearchQuery,
      setFilters,
      resetFilters,
    }),
    [
      customer,
      engagement,
      consultant,
      notifications,
      activeFilters,
      searchQuery,
      unreadNotificationCount,
      addNotification,
      markNotificationAsRead,
      clearNotifications,
      setFilters,
      resetFilters,
    ]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext(): AppStateContextValue {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return context
}

export default AppContext
