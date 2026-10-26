const STORAGE_KEY = 'emple_customers_v1'

export function getStoredCustomerByEmail(email) {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === null) return null
  const records = JSON.parse(raw)
  if (!Array.isArray(records)) throw new Error('Customer records have an invalid format.')
  const normalizedEmail = String(email ?? '').trim().toLocaleLowerCase()
  const record = records.find(item => (
    item && typeof item.email === 'string'
    && item.email.trim().toLocaleLowerCase() === normalizedEmail
  ))
  return record ? { ...record } : null
}

export function updateStoredCustomerProfile(email, updates) {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === null) return false
  const records = JSON.parse(raw)
  if (!Array.isArray(records)) throw new Error('Customer records have an invalid format.')
  const normalizedEmail = String(email ?? '').trim().toLocaleLowerCase()
  const index = records.findIndex(item => (
    item && typeof item.email === 'string'
    && item.email.trim().toLocaleLowerCase() === normalizedEmail
  ))
  if (index < 0) return false
  const allowedFields = ['firstName', 'lastName', 'phone', 'altPhone', 'address']
  const safeUpdates = Object.fromEntries(
    allowedFields.filter(field => typeof updates[field] === 'string')
      .map(field => [field, updates[field]]),
  )
  records[index] = { ...records[index], ...safeUpdates, updatedAt: new Date().toISOString() }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  window.dispatchEvent(new Event('emple:customers-updated'))
  return true
}
