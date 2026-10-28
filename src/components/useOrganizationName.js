import { useEffect, useState } from 'react'
import { getSystemSettings, subscribeToSystemSettings } from '../services/systemSettings'

const DEFAULT_ORGANIZATION_NAME = 'emPLE Life Insurance'

function readOrganizationName() {
  try {
    return getSystemSettings().organizationName
  } catch {
    return DEFAULT_ORGANIZATION_NAME
  }
}

export default function useOrganizationName() {
  const [name, setName] = useState(readOrganizationName)

  useEffect(() => subscribeToSystemSettings((settings, error) => {
    if (!error) setName(settings.organizationName)
  }), [])

  return name
}
