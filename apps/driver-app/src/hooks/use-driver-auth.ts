import { useContext } from 'react'

import { DriverAuthContext, type DriverAuthContextValue } from '../providers/auth-context'

export function useDriverAuth<T>(
  selector: (value: DriverAuthContextValue) => T,
): T {
  const context = useContext(DriverAuthContext)

  if (!context) {
    throw new Error('useDriverAuth must be used inside DriverAuthProvider.')
  }

  return selector(context)
}
