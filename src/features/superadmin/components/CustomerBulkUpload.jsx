import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FileText, Upload, X,
} from 'lucide-react'
import { importCustomerRecords, previewCustomerImport } from '../../../services/customerDirectoryData'
import { parseCustomerUpload } from '../../../services/customerImportFile'

const TEMPLATE_COLUMNS = [
  'First Name', 'Last Name', 'Email', 'Phone', 'Alternate Phone',
  'Date of Birth', 'Gender', 'Address',
]
const IMPORT_HISTORY_KEY = 'emple_customer_import_history_v1'

function readImportHistory() {
  try {
    const saved = window.sessionStorage.getItem(IMPORT_HISTORY_KEY)
    if (saved === null) return []
    const parsed = JSON.parse(saved)
    return Array.isArray(parsed) && parsed.every(item => typeof item === 'string') ? parsed : []
  } catch {
    return []
  }
}

function formatFileSize(size) {
  return size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function csvCell(value) {
  let text = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

function downloadCsv(filename, columns, rows) {
  const content = [columns, ...rows]
    .map(row => row.map(csvCell).join(','))
    .join('\r\n')
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function downloadTemplate() {
  downloadCsv('emple-customer-upload-template.csv', TEMPLATE_COLUMNS, [])
}

function downloadRejectedReport(rejected) {
  downloadCsv(
    'emple-customer-upload-rejected.csv',
    ['Row Number', ...TEMPLATE_COLUMNS, 'Errors'],
    rejected.map(record => [
      record.rowNumber,
      record.fields.firstName,
      record.fields.lastName,
      record.fields.email,
      record.fields.phone,
      record.fields.altPhone,
      record.fields.dateOfBirth,
      record.fields.gender,
      record.fields.address,
      record.errors.join('; '),
    ]),
  )
}

export default function CustomerBulkUpload({ open, onClose, onImported }) {
  const dialogRef = useRef(null)
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [fingerprint, setFingerprint] = useState('')
  const [importHistory, setImportHistory] = useState(readImportHistory)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [working, setWorking] = useState(false)
  const [result, setResult] = useState(null)

  const repeatedFile = Boolean(fingerprint && importHistory.includes(fingerprint))

  useEffect(() => {
    if (open && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal()
    if (!open && dialogRef.current?.open) dialogRef.current.close()
  }, [open])

  function resetSelection() {
    setFile(null)
    setPreview(null)
    setFingerprint('')
    setError('')
    setResult(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleClose() {
    if (dialogRef.current?.open) dialogRef.current.close()
    onClose()
  }

  async function selectFile(selectedFile) {
    if (!selectedFile || working) return
    setFile(selectedFile)
    setPreview(null)
    setFingerprint('')
    setError('')
    setResult(null)
    setWorking(true)
    try {
      const parsed = await parseCustomerUpload(selectedFile)
      setFingerprint(parsed.fingerprint)
      setPreview(previewCustomerImport(parsed.records))
    } catch (parseError) {
      setError(parseError.message || 'Unable to read the selected file.')
    } finally {
      setWorking(false)
    }
  }

  async function handleImport() {
    if (!preview || repeatedFile) return
    setWorking(true)
    setError('')
    try {
      const validRecords = preview.records
        .filter(record => record.status === 'valid')
        .map(record => ({ ...record.fields, rowNumber: record.rowNumber }))
      const importResult = await importCustomerRecords(validRecords)
      setResult({
        ...importResult,
        skipped: preview.duplicates + importResult.skipped,
        failed: preview.invalid + importResult.failed,
        rejected: [
          ...preview.records.filter(record => record.status !== 'valid'),
          ...importResult.rejected,
        ],
      })
      if (importResult.warning) setError(importResult.warning)
      if (importResult.imported > 0) {
        const updatedHistory = [...new Set([...importHistory, fingerprint])]
        try {
          window.sessionStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(updatedHistory))
          setImportHistory(updatedHistory)
        } catch {
          setError('Import completed, but this browser could not save repeat-upload protection.')
        }
        onImported(importResult.imported)
      }
    } catch (importError) {
      setError(importError.message || 'Unable to import these customer records.')
    } finally {
      setWorking(false)
    }
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragging(false)
    if (!working) void selectFile(event.dataTransfer.files?.[0])
  }

  const reportRecords = result?.rejected ?? []

  return (
    <dialog
      ref={dialogRef}
      className="cm-dialog cm-import-dialog"
      aria-labelledby="cm-import-title"
      onCancel={handleClose}
      onClick={event => {
        if (event.target === dialogRef.current) handleClose()
      }}
    >
      <div className="cm-import-content">
        <header className="cm-dialog-header">
          <div>
            <h2 id="cm-import-title">Bulk customer upload</h2>
            <p>Import customer directory records from a CSV or Excel file.</p>
          </div>
          <button type="button" className="cm-close" onClick={handleClose} disabled={working} aria-label="Close bulk upload">
            <X size={19} />
          </button>
        </header>

        {!result && (
          <>
            <section className="cm-import-guidance">
              <div>
                <strong>Required columns</strong>
                <p>First Name, Last Name, Email, and Phone are required. Alternate Phone, Date of Birth, Gender, and Address are optional.</p>
                <p>Accepted file types: .csv, .xls, .xlsx · Maximum size: 5 MB · Up to 1,000 records.</p>
              </div>
              <button type="button" className="cm-button cm-button--secondary cm-template-button" onClick={downloadTemplate}>
                <Download size={15} aria-hidden="true" /> Download template
              </button>
            </section>

            <div
              className={`cm-dropzone${dragging ? ' cm-dropzone--active' : ''}`}
              onDragOver={event => { event.preventDefault(); setDragging(true) }}
              onDragLeave={event => {
                if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false)
              }}
              onDrop={handleDrop}
            >
              <input
                ref={inputRef}
                className="cm-file-input"
                type="file"
                accept=".csv,.xls,.xlsx"
                aria-label="Choose customer upload file"
                disabled={working}
                onChange={event => void selectFile(event.target.files?.[0])}
              />
              <span className="cm-dropzone-icon"><Upload size={21} aria-hidden="true" /></span>
              <strong>Drop your file here</strong>
              <span>or select a file from your device</span>
              <button type="button" className="cm-button cm-button--secondary" disabled={working} onClick={() => inputRef.current?.click()}>
                Choose file
              </button>
            </div>

            {file && (
              <div className="cm-selected-file">
                <FileSpreadsheet size={17} aria-hidden="true" />
                <span>{file.name} · {formatFileSize(file.size)}</span>
                <button type="button" onClick={resetSelection} disabled={working} aria-label="Remove selected file"><X size={16} /></button>
              </div>
            )}
            {error && <div className="cm-alert cm-alert--error" role="alert">{error}</div>}
            {repeatedFile && (
              <div className="cm-alert cm-alert--warning" role="alert">
                This exact file was already imported during this browser session. Select another file to avoid duplicate imports.
              </div>
            )}
            {working && <p className="cm-import-progress" role="status">Reading and validating customer records…</p>}

            {preview && !working && (
              <section className="cm-preview" aria-labelledby="cm-preview-title">
                <div className="cm-preview-heading">
                  <div><h3 id="cm-preview-title">Review before importing</h3><p>{preview.total} customer records found in the file.</p></div>
                  <FileText size={19} aria-hidden="true" />
                </div>
                <div className="cm-import-counts">
                  <span><strong>{preview.total}</strong>Total</span>
                  <span className="cm-count--valid"><strong>{preview.valid}</strong>Valid</span>
                  <span className="cm-count--invalid"><strong>{preview.invalid}</strong>Invalid</span>
                  <span className="cm-count--duplicate"><strong>{preview.duplicates}</strong>Duplicates</span>
                </div>
                {(preview.invalid > 0 || preview.duplicates > 0) && (
                  <button
                    type="button"
                    className="cm-rejected-preview-link"
                    onClick={() => downloadRejectedReport(preview.records.filter(record => record.status !== 'valid'))}
                  >
                    <Download size={14} aria-hidden="true" /> Download rejected rows
                  </button>
                )}
                <div className="cm-import-table-wrap">
                  <table className="cm-import-table">
                    <thead><tr><th>Row</th><th>Customer</th><th>Email</th><th>Phone</th><th>Result</th></tr></thead>
                    <tbody>{preview.records.map(record => (
                      <tr key={record.rowNumber}>
                        <td>{record.rowNumber}</td>
                        <td>{`${record.fields.firstName} ${record.fields.lastName}`.trim() || 'Not provided'}</td>
                        <td>{record.fields.email || 'Not provided'}</td>
                        <td>{record.fields.phone || 'Not provided'}</td>
                        <td>
                          <span className={`cm-row-status cm-row-status--${record.status}`}>
                            {record.status === 'valid' ? 'Valid' : record.status === 'duplicate' ? 'Duplicate' : 'Invalid'}
                          </span>
                          {record.errors.length > 0 && <small>{record.errors.join(' ')}</small>}
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <p className="cm-import-note">
                  Existing records will not be overwritten. Duplicate email or phone numbers and invalid records will not be imported.
                </p>
              </section>
            )}
          </>
        )}

        {result && (
          <section className="cm-import-result" aria-labelledby="cm-result-title">
            <CheckCircle2 size={29} aria-hidden="true" />
            <h3 id="cm-result-title">Import complete</h3>
            <p>Your existing customer records and linked information were preserved.</p>
            <div className="cm-import-counts cm-import-counts--result">
              <span className="cm-count--valid"><strong>{result.imported}</strong>Imported</span>
              <span className="cm-count--duplicate"><strong>{result.skipped}</strong>Skipped duplicates</span>
              <span className="cm-count--invalid"><strong>{result.failed}</strong>Failed validation</span>
            </div>
            {error && <div className="cm-alert cm-alert--warning" role="status">{error}</div>}
            {reportRecords.length > 0 && (
              <div className="cm-import-report">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{reportRecords.length} record{reportRecords.length === 1 ? '' : 's'} were not imported.</span>
                <button type="button" className="cm-button cm-button--secondary" onClick={() => downloadRejectedReport(reportRecords)}>
                  <Download size={14} aria-hidden="true" /> Download rejected report
                </button>
              </div>
            )}
          </section>
        )}

        <footer className="cm-dialog-footer">
          {result ? (
            <button type="button" className="cm-button cm-button--primary" onClick={handleClose}>Done</button>
          ) : (
            <>
              <button type="button" className="cm-button cm-button--secondary" disabled={working} onClick={handleClose}>Cancel</button>
              <button
                type="button"
                className="cm-button cm-button--primary"
                onClick={() => void handleImport()}
                disabled={working || !preview?.valid || repeatedFile}
              >
                {working ? 'Importing…' : `Import ${preview?.valid ?? 0} valid customer${preview?.valid === 1 ? '' : 's'}`}
              </button>
            </>
          )}
        </footer>
      </div>
    </dialog>
  )
}
