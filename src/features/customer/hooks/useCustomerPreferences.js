import { useEffect, useState } from 'react'
import {
  DEFAULT_CUSTOMER_PREFERENCES,
  getCustomerPreferences,
  subscribeToCustomerPreferences,
} from '../services/customerPreferences'

function readPreferences() {
  try {
    return { preferences: getCustomerPreferences(), error: '' }
  } catch (error) {
    return {
      preferences: { ...DEFAULT_CUSTOMER_PREFERENCES },
      error: error.message || 'Personal preferences could not be loaded.',
    }
  }
}

export default function useCustomerPreferences() {
  const [state, setState] = useState(readPreferences)

  useEffect(() => {
    const refresh = () => setState(readPreferences())
    window.addEventListener('emple:session-updated', refresh)
    const unsubscribe = subscribeToCustomerPreferences((preferences, error) => {
      setState({
        preferences,
        error: error?.message ?? '',
      })
    })
    return () => {
      window.removeEventListener('emple:session-updated', refresh)
      unsubscribe()
    }
  }, [])

  return state
}
