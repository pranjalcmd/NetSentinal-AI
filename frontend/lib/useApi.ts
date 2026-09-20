'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { ApiError } from './api'

/**
 * A clock that ticks every `intervalMs`, for values that age on screen —
 * a freshness badge must flip to stale on its own, not on the next reload.
 *
 * Reading the wall clock during render is impure; `useSyncExternalStore` is
 * the sanctioned way to subscribe to one. The snapshot is bucketed to the
 * interval so it stays stable between ticks, which the store contract requires.
 */
export function useNow(intervalMs = 30_000): number {
  return useSyncExternalStore(
    useCallback(
      (onChange: () => void) => {
        const id = setInterval(onChange, intervalMs)
        return () => clearInterval(id)
      },
      [intervalMs]
    ),
    useCallback(() => Math.floor(Date.now() / intervalMs) * intervalMs, [intervalMs]),
    () => 0 // server render has no clock; the first client tick fills it in
  )
}

/**
 * The four states PRD §7 requires of every backend-backed view: loading,
 * loaded, empty (data with zero records) and failed-with-a-cause.
 *
 * No data-fetching library: this reads once per mount and on an explicit
 * reload, which is all the dashboard does. Reach for SWR or TanStack Query
 * only when several components need to share one browser cache.
 */
export type Async<T> = {
  data: T | null
  error: ApiError | null
  loading: boolean
  reload: () => void
}

type State<T> = { data: T | null; error: ApiError | null; loading: boolean }

export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): Async<T> {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let live = true
    // State is only ever set from the settled promise, never synchronously in
    // the effect body: `reload` owns the switch back into the loading state,
    // and the initial state starts there already.
    fetcher()
      .then((result) => {
        if (live) setState({ data: result, error: null, loading: false })
      })
      .catch((cause) => {
        // Previous data stays on screen; the caller decides whether to show it
        // beside the error or replace it.
        const error = cause instanceof ApiError ? cause : new ApiError(0, String(cause), '')
        if (live) setState((prev) => ({ ...prev, error, loading: false }))
      })
    return () => {
      live = false
    }
    // `fetcher` is intentionally excluded: callers pass an inline closure that
    // is a new identity on every render. `deps` and `nonce` are the triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps])

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true }))
    setNonce((n) => n + 1)
  }, [])

  return { ...state, reload }
}
