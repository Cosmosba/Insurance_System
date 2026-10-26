import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FileText, Upload, X,
} from 'lucide-react'
import {
  createStaffUsersBatch,
  previewStaffUserImport,
} from '../../services/userData'
import { parseStaffUpload } from '../../services/staffImportFile'

const TEMPLATE_COLUMNS = [
  'First Name', 'Last Name', 'Email', 'Phone', 'Employee ID', 'Department', 'Role', 'Status',
]

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
  downloadCsv('emple-staff-upload-template.csv', TEMPLATE_COLUMNS, [])
}

function downloadRejectedReport(records) {
  downloadCsv(
    'emple-staff-upload-errors.csv',
    ['Row Number', ...TEMPLATE_COLUMNS, 'Errors'],
    records.map(record => [
      record.rowNumber,
      record.fields.firstName,
      record.fields.lastName,
      record.fields.email,
      record.fields.phone,
      record.fields.employeeId,
      record.fields.department,
      record.fields.role,
      record.fields.status,
      record.errors.join('; '),
    ]),
  )
}

function formatFileSize(size) {
  return size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function usesElevatedRole(preview) {
  return preview?.records.some(record => (
    record.status === 'valid'
    && String(record.fields.role).trim().toLocaleLowerCase().replace(/[\s-]+/g, '_') !== 'department_staff'
  )) ?? false
}

export default function StaffBulkUpload({ open, onClose, onImported }) {
  const dialogRef = useRef(null)
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [working, setWorking] = useState(false)
  const [confirmedRoleAssignment, setConfirmedRoleAssignment] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (open && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal()
    if (!open && dialogRef.current?.open) dialogRef.current.close()
  }, [open])

  function resetSelection() {
    setFile(null)
    setPreview(null)
    setError('')
    setResult(null)
    setConfirmedRoleAssignment(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleClose() {
    if (working) return
    if (dialogRef.current?.open) dialogRef.current.close()
    resetSelection()
    onClose()
  }

  async function selectFile(selectedFile) {
    if (!selectedFile || working) return
    setFile(selectedFile)
    setPreview(null)
    setError('')
    setResult(null)
    setConfirmedRoleAssignment(false)
    setWorking(true)
    try {
      const records = await parseStaffUpload(selectedFile)
      setPreview(previewStaffUserImport(records))
    } catch (parseError) {
      setError(parseError.message || 'Unable to read the selected file.')
    } finally {
      setWorking(false)
    }
  }

  async function handleImport() {
    if (!preview?.valid || (usesElevatedRole(preview) && !confirmedRoleAssignment)) return
    setWorking(true)
    setError('')
    try {
      const validRecords = preview.records
        .filter(record => record.status === 'valid')
        .map(record => ({ ...record.fields, rowNumber: record.rowNumber }))
      const importResult = createStaffUsersBatch(validRecords, { confirmedRoleAssignment })
      setResult({
        imported: importResult.imported,
        skipped: preview.duplicates,
        rejectedCount: preview.invalid,
        failedCount: 0,
        rejected: preview.records.filter(record => record.status !== 'valid'),
      })
      onImported(importResult.imported)
    } catch (importError) {
      if (importError.details?.saved) {
        const rejected = preview.records.filter(record => record.status !== 'valid')
        setResult({
          imported: importError.details.importedCount ?? preview.valid,
          skipped: preview.duplicates,
          rejectedCount: preview.invalid,
          failedCount: 0,
          rejected,
          warning: importError.message,
        })
        onImported(importError.details.importedCount ?? preview.valid)
      } else {
        if (Array.isArray(importError.details?.records)) {
          setError(importError.message || 'Staff records changed since preview.')
          try {
            setPreview(previewStaffUserImport(
              preview.records
                .map(record => ({ ...record.fields, rowNumber: record.rowNumber })),
            ))
          } catch (previewError) {
            setError(previewError.message || importError.message)
          }
        } else {
          const reason = importError.message || 'Unable to save staff records.'
          const failedRecords = preview.records
            .filter(record => record.status === 'valid')
            .map(record => ({ ...record, errors: [reason] }))
          setResult({
            imported: 0,
            skipped: preview.duplicates,
            rejectedCount: preview.invalid,
            failedCount: preview.valid,
            rejected: [
              ...preview.records.filter(record => record.status !== 'valid'),
              ...failedRecords,
            ],
            failureReason: reason,
          })
        }
      }
    } finally {
      setWorking(false)
    }
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragging(false)
    if (!working) void selectFile(event.dataTransfer.files?.[0])
  }

  const rejectedRecords = result?.rejected
    ?? preview?.records.filter(record => record.status !== 'valid')
    ?? []

  return (
    <dialog
      ref={dialogRef}
      className="um-dialog um-import-dialog"
      aria-labelledby="um-import-title"
      onCancel={event => {
        if (working) event.preventDefault()
        else handleClose()
      }}
      onClick={event => {
        if (event.target === dialogRef.current) handleClose()
      }}
    >
      <div className="um-import-content">
        <header className="um-dialog-header">
          <div>
            <span className="um-dialog-icon"><Upload size={17} aria-hidden="true" /></span>
            <h2 id="um-import-title">Bulk staff upload</h2>
            <p>Review staff profiles before adding them to the directory.</p>
          </div>
          <button
            type="button"
            className="um-import-close"
            onClick={handleClose}
            disabled={working}
            aria-label="Close bulk upload"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        {!result && (
          <>
            <section className="um-import-guidance">
              <div>
                <strong>Template columns</strong>
                <p>First Name, Last Name, Email, Role, and Status are required. Phone, Employee ID, and Department are optional.</p>
                <p>Department must match a registered department name or code. Role accepts Department Staff, Department Manager, or Superadmin. Status must be Active or Inactive.</p>
                <p>Department Manager is a staff role, not a department manager assignment. Assign a department manager separately in Department Management.</p>
                <p>Accepted: .csv, .xls, .xlsx · Maximum file size: 5 MB · Up to 1,000 staff rows.</p>
              </div>
              <button type="button" className="um-button um-button--secondary" onClick={downloadTemplate}>
                <Download size={15} aria-hidden="true" /> Download template
              </button>
            </section>

            <div
              className={`um-dropzone${dragging ? ' um-dropzone--active' : ''}`}
              onDragOver={event => { event.preventDefault(); setDragging(true) }}
              onDragLeave={event => {
                if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false)
              }}
              onDrop={handleDrop}
            >
              <input
                ref={inputRef}
                className="um-file-input"
                type="file"
                accept=".csv,.xls,.xlsx"
                aria-label="Choose staff upload file"
                disabled={working}
                onChange={event => void selectFile(event.target.files?.[0])}
              />
              <span className="um-dropzone-icon"><Upload size={21} aria-hidden="true" /></span>
              <strong>Drop your file here</strong>
              <span>or select a file from your device</span>
              <button
                type="button"
                className="um-button um-button--secondary"
                disabled={working}
                onClick={() => inputRef.current?.click()}
              >
                Choose file
              </button>
            </div>

            {file && (
              <div className="um-selected-file">
                <FileSpreadsheet size={17} aria-hidden="true" />
                <span>{file.name} · {formatFileSize(file.size)}</span>
                <button
                  type="button"
                  onClick={resetSelection}
                  disabled={working}
                  aria-label="Remove selected file"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            )}
            {error && <div className="um-import-alert" role="alert">{error}</div>}
            {working && <p className="um-import-progress" role="status">Reading and validating staff records…</p>}

            {preview && !working && (
              <section className="um-import-preview" aria-labelledby="um-preview-title">
                <div className="um-import-preview-heading">
                  <div>
                    <h3 id="um-preview-title">Review before importing</h3>
                    <p>{preview.total} staff record{preview.total === 1 ? '' : 's'} found.</p>
                  </div>
                  <FileText size={19} aria-hidden="true" />
                </div>
                <div className="um-import-counts">
                  <span><strong>{preview.total}</strong>Total</span>
                  <span className="um-count--valid"><strong>{preview.valid}</strong>Valid</span>
                  <span className="um-count--invalid"><strong>{preview.invalid}</strong>Invalid</span>
                  <span className="um-count--duplicate"><strong>{preview.duplicates}</strong>Duplicates</span>
                </div>
                {rejectedRecords.length > 0 && (
                  <button
                    type="button"
                    className="um-import-report-link"
                    onClick={() => downloadRejectedReport(rejectedRecords)}
                  >
                    <Download size={14} aria-hidden="true" /> Download rejected rows
                  </button>
                )}
                <div className="um-import-table-wrap">
                  <table className="um-import-table">
                    <thead>
                      <tr><th>Row</th><th>Staff member</th><th>Email</th><th>Department</th><th>Role</th><th>Result</th></tr>
                    </thead>
                    <tbody>{preview.records.map(record => (
                      <tr key={record.rowNumber}>
                        <td>{record.rowNumber}</td>
                        <td>{`${record.fields.firstName} ${record.fields.lastName}`.trim() || 'Not provided'}</td>
                        <td>{record.fields.email || 'Not provided'}</td>
                        <td>{record.fields.department || 'Unassigned'}</td>
                        <td>{record.fields.role || 'Not provided'}</td>
                        <td>
                          <span className={`um-import-status um-import-status--${record.status}`}>
                            {record.status === 'valid' ? 'Valid' : record.status === 'duplicate' ? 'Duplicate' : 'Invalid'}
                          </span>
                          {record.errors.length > 0 && <small>{record.errors.join(' ')}</small>}
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                {usesElevatedRole(preview) && (
                  <label className="um-import-confirm">
                    <input
                      type="checkbox"
                      checked={confirmedRoleAssignment}
                      onChange={event => setConfirmedRoleAssignment(event.target.checked)}
                    />
                    <span>I confirm the Department Manager and/or Superadmin role assignments shown above.</span>
                  </label>
                )}
                <p className="um-import-note">
                  Duplicate and invalid rows will not be imported. Existing staff profiles are never overwritten.
                  New profiles do not create login credentials.
                </p>
              </section>
            )}
          </>
        )}

        {result && (
          <section className="um-import-result" aria-labelledby="um-import-result-title">
            {result.warning
              ? <AlertTriangle size={29} aria-hidden="true" />
              : <CheckCircle2 size={29} aria-hidden="true" />}
            <h3 id="um-import-result-title">Import complete</h3>
            <p>Imported profiles are now available in the shared staff directory.</p>
            <div className="um-import-counts um-import-counts--result">
              <span className="um-count--valid"><strong>{result.imported}</strong>Imported</span>
              <span className="um-count--duplicate"><strong>{result.skipped}</strong>Skipped duplicates</span>
              <span className="um-count--invalid"><strong>{result.rejectedCount}</strong>Rejected</span>
              <span className="um-count--invalid"><strong>{result.failedCount}</strong>Failed</span>
            </div>
            {result.warning && <div className="um-import-alert" role="status">{result.warning}</div>}
            {result.failureReason && <div className="um-import-alert" role="alert">{result.failureReason}</div>}
            {result.failedCount > 0 && (
              <p className="um-import-note">
                No valid profiles were saved because the batch failed. Correct the issue and retry the import.
              </p>
            )}
            {result.rejected.length > 0 && (
              <div className="um-import-report">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{result.rejected.length} row{result.rejected.length === 1 ? '' : 's'} were not imported.</span>
                <button
                  type="button"
                  className="um-button um-button--secondary"
                  onClick={() => downloadRejectedReport(result.rejected)}
                >
                  <Download size={14} aria-hidden="true" /> Download error report
                </button>
              </div>
            )}
          </section>
        )}

        <footer className="um-import-footer">
          {result ? (
            <>
              {result.failedCount > 0 && (
                <button
                  type="button"
                  className="um-button um-button--secondary"
                  onClick={() => setResult(null)}
                >
                  Back to preview
                </button>
              )}
              <button type="button" className="um-button um-button--primary" onClick={handleClose}>Done</button>
            </>
          ) : (
            <>
              <button type="button" className="um-button um-button--secondary" disabled={working} onClick={handleClose}>
                Cancel
              </button>
              <button
                type="button"
                className="um-button um-button--primary"
                onClick={() => void handleImport()}
                disabled={
                  working
                  || !preview?.valid
                  || (usesElevatedRole(preview) && !confirmedRoleAssignment)
                }
              >
                {working ? 'Importing…' : `Import ${preview?.valid ?? 0} valid staff member${preview?.valid === 1 ? '' : 's'}`}
              </button>
            </>
          )}
        </footer>
      </div>
    </dialog>
  )
}
