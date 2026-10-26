const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_RECORDS = 1000
const ALLOWED_EXTENSIONS = new Set(['csv', 'xls', 'xlsx'])

const COLUMN_ALIASES = {
  firstname: 'firstName',
  lastname: 'lastName',
  email: 'email',
  emailaddress: 'email',
  phone: 'phone',
  phonenumber: 'phone',
  alternatephone: 'altPhone',
  altphone: 'altPhone',
  dateofbirth: 'dateOfBirth',
  gender: 'gender',
  address: 'address',
}

const REQUIRED_FIELDS = ['firstName', 'lastName', 'email', 'phone']

function normalizeHeading(value) {
  return String(value ?? '').trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
}

function getExtension(name) {
  return String(name).split('.').pop()?.toLocaleLowerCase() ?? ''
}

async function fingerprint(buffer) {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer)
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
  }
  let hash = 2166136261
  for (const byte of new Uint8Array(buffer)) {
    hash ^= byte
    hash = Math.imul(hash, 16777619)
  }
  return `fnv-${(hash >>> 0).toString(16)}-${buffer.byteLength}`
}

export async function parseCustomerUpload(file) {
  if (!file || typeof file.name !== 'string') throw new Error('Select a CSV or Excel file.')
  const extension = getExtension(file.name)
  if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error('Choose a .csv, .xls, or .xlsx file.')
  if (!file.size) throw new Error('The selected file is empty.')
  if (file.size > MAX_FILE_BYTES) throw new Error('Files must be 5 MB or smaller.')

  let buffer
  let workbook
  let utils
  try {
    buffer = await file.arrayBuffer()
    const xlsx = await import('@e965/xlsx')
    utils = xlsx.utils
    workbook = xlsx.read(buffer, {
      type: 'array',
      cellDates: false,
      dense: true,
      bookVBA: false,
      WTF: false,
    })
  } catch {
    throw new Error('The file could not be read. Check that it is a valid CSV or Excel workbook.')
  }

  const sheetName = workbook.SheetNames[0]
  const sheet = sheetName ? workbook.Sheets[sheetName] : null
  if (!sheet) throw new Error('The file does not contain a worksheet.')
  const denseRows = Array.isArray(sheet) ? sheet : sheet['!data']
  const hasFormulaCells = Array.isArray(denseRows)
    ? denseRows.some(row => Array.isArray(row) && row.some(cell => cell && typeof cell === 'object' && cell.f))
    : Object.entries(sheet).some(([key, cell]) => !key.startsWith('!') && cell && typeof cell === 'object' && cell.f)
  if (hasFormulaCells) {
    throw new Error('Formula cells are not supported. Replace formulas with their values and upload again.')
  }

  let rows
  try {
    rows = utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '', blankrows: true })
  } catch {
    throw new Error('The worksheet could not be read. Check its formatting and try again.')
  }
  const headerIndex = rows.findIndex(row => row.some(value => String(value ?? '').trim()))
  if (headerIndex < 0) {
    throw new Error('The file contains no customer records.')
  }

  const headers = rows[headerIndex].map(normalizeHeading)
  if (headers.length > 64) throw new Error('The worksheet contains too many columns. Use the supplied template.')
  const fieldIndexes = new Map()
  headers.forEach((header, index) => {
    const field = COLUMN_ALIASES[header]
    if (field) {
      if (fieldIndexes.has(field)) throw new Error(`The column "${field}" appears more than once.`)
      fieldIndexes.set(field, index)
    }
  })
  const missing = REQUIRED_FIELDS.filter(field => !fieldIndexes.has(field))
  if (missing.length) {
    const labels = { firstName: 'First Name', lastName: 'Last Name', email: 'Email', phone: 'Phone' }
    throw new Error(`Missing required column${missing.length > 1 ? 's' : ''}: ${missing.map(field => labels[field]).join(', ')}.`)
  }

  const records = []
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index]
    if (row.every(value => !String(value ?? '').trim())) continue
    if (records.length >= MAX_RECORDS) {
      throw new Error(`The file exceeds the ${MAX_RECORDS.toLocaleString()}-record limit. Split it into smaller uploads.`)
    }
    const record = { rowNumber: index + 1 }
    for (const [field, columnIndex] of fieldIndexes) {
      record[field] = String(row[columnIndex] ?? '').trim()
    }
    records.push(record)
  }
  if (!records.length) throw new Error('The file contains no customer records below its header row.')

  return {
    records,
    fingerprint: await fingerprint(buffer),
  }
}
