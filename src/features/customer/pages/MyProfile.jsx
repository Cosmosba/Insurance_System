import { useState, useRef } from 'react'
import { User, Mail, Phone, MapPin, Shield, Pencil, X, Check, AlertCircle, Camera } from 'lucide-react'
import { getProfile, saveProfile, getPhoto, savePhoto, getSession } from '../../../services/mockAuth'
import { hasPermission } from '../../../services/rolePermissions'
import useCustomerPreferences from '../hooks/useCustomerPreferences'
import { formatCustomerDate } from '../services/customerPreferences'
import '../styles/MyProfile.css'

// ── Validation helpers ────────────────────────────────────────────────────────

function validatePhone(v) {
  // Allow empty (optional) or a basic international/local format
  if (!v.trim()) return true
  return /^[+\d][\d\s\-().]{6,19}$/.test(v.trim())
}

function validate(fields) {
  const errors = {}
  if (!fields.firstName.trim())          errors.firstName = 'First name is required.'
  if (!fields.lastName.trim())           errors.lastName  = 'Last name is required.'
  if (!validatePhone(fields.phone))      errors.phone     = 'Enter a valid phone number.'
  if (fields.altPhone && !validatePhone(fields.altPhone))
                                         errors.altPhone  = 'Enter a valid phone number.'
  return errors
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ReadRow({ label, value, icon: Icon }) {
  return (
    <div className="pf-read-row">
      {Icon && <Icon size={15} className="pf-read-icon" aria-hidden="true" />}
      <div className="pf-read-body">
        <span className="pf-read-label">{label}</span>
        <span className="pf-read-value">{value || '—'}</span>
      </div>
    </div>
  )
}

function Field({ id, label, value, onChange, error, type = 'text', readOnly = false, required = false }) {
  return (
    <div className="pf-field">
      <label htmlFor={id} className="pf-label">
        {label}{required && <span className="pf-required" aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        className={`pf-input${error ? ' pf-input--error' : ''}${readOnly ? ' pf-input--readonly' : ''}`}
        value={value}
        onChange={readOnly ? undefined : e => onChange(e.target.value)}
        readOnly={readOnly}
        aria-readonly={readOnly}
        aria-describedby={error ? `${id}-err` : undefined}
        aria-required={required}
      />
      {error && (
        <span id={`${id}-err`} className="pf-field-error" role="alert">
          <AlertCircle size={12} aria-hidden="true" /> {error}
        </span>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MyProfile() {
  const { preferences } = useCustomerPreferences()
  const [profile,  setProfile]  = useState(() => getProfile())
  const [photo,    setPhoto]    = useState(() => getPhoto())
  const [editing,  setEditing]  = useState(false)
  const [draft,    setDraft]    = useState({})
  const [errors,   setErrors]   = useState({})
  const [saving,   setSaving]   = useState(false)
  const [banner,   setBanner]   = useState(null)
  const [photoErr, setPhotoErr] = useState(null)
  const fileInputRef = useRef(null)
  const canEditProfile = hasPermission(getSession(), 'profile.edit_own')

  function handlePhotoClick() {
    if (!canEditProfile) return
    setPhotoErr(null)
    fileInputRef.current?.click()
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // reset so same file can be re-selected
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setPhotoErr('Please select an image file (JPEG, PNG, etc.).')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoErr('Image must be smaller than 5 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target.result
      const result  = savePhoto(dataUrl)
      if (result.ok) {
        setPhoto(dataUrl)
        setPhotoErr(null)
      } else {
        setPhotoErr(result.message)
      }
    }
    reader.readAsDataURL(file)
  }

  function startEdit() {
    if (!canEditProfile) return
    setDraft({
      firstName: profile.firstName,
      lastName:  profile.lastName,
      phone:     profile.phone,
      altPhone:  profile.altPhone,
      address:   profile.address,
    })
    setErrors({})
    setBanner(null)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setErrors({})
    setDraft({})
  }

  function setField(key, value) {
    setDraft(d => ({ ...d, [key]: value }))
    // Clear the error for this field as the user types
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n })
  }

  async function handleSave() {
    const errs = validate(draft)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setSaving(true)
    setBanner(null)

    // Simulate async save (replace with real API call)
    await new Promise(r => setTimeout(r, 600))

    const result = saveProfile(draft)
    setSaving(false)

    if (result.ok) {
      setProfile(getProfile())
      setEditing(false)
      setDraft({})
      setErrors({})
      setBanner({ type: 'success', msg: 'Your profile has been updated for this session.' })
    } else {
      setBanner({ type: 'error', msg: result.message })
    }
  }

  if (!profile) {
    return (
      <div className="pf-page">
        <div className="pf-loading" aria-live="polite">Loading profile…</div>
      </div>
    )
  }

  const initials = `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase() || 'C'
  const fullName  = `${profile.firstName} ${profile.lastName}`.trim()

  return (
    <div className="pf-page">

      {/* ── Page heading ── */}
      <header className="pf-header">
        <div>
          <h1 className="pf-title">My Profile</h1>
          <p className="pf-subtitle">View and manage your personal information.</p>
        </div>
        {!editing && canEditProfile && (
          <button type="button" className="pf-edit-btn" onClick={startEdit} aria-label="Edit profile">
            <Pencil size={15} aria-hidden="true" />
            Edit Profile
          </button>
        )}
      </header>

      {/* ── Save banner ── */}
      {banner && (
        <div className={`pf-banner pf-banner--${banner.type}`} role="status" aria-live="polite">
          {banner.type === 'success'
            ? <Check size={16} aria-hidden="true" />
            : <AlertCircle size={16} aria-hidden="true" />}
          {banner.msg}
          <button type="button" className="pf-banner-close" onClick={() => setBanner(null)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Profile hero card ── */}
      <section aria-labelledby="pf-hero-heading">
        <h2 id="pf-hero-heading" className="pf-section-label">Account Overview</h2>
        <div className="pf-hero-card">

          {/* Avatar with upload overlay */}
          <div className="pf-avatar-wrap">
            {photo
              ? <img src={photo} alt={fullName} className="pf-avatar pf-avatar--photo" />
              : <div className="pf-avatar" aria-hidden="true">{initials}</div>
            }
            {canEditProfile && (
              <button
                type="button"
                className="pf-avatar-upload-btn"
                onClick={handlePhotoClick}
                aria-label="Upload profile photo"
              >
                <Camera size={14} aria-hidden="true" />
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="pf-file-input"
              onChange={handleFileChange}
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>

          <div className="pf-hero-info">
            <span className="pf-hero-name">{fullName}</span>
            <span className="pf-hero-email">{profile.email}</span>
            <span className="pf-hero-meta">
              <span className="pf-hero-id">{profile.customerId}</span>
              <span className={`pf-status-badge pf-status-badge--${profile.accountStatus === 'Active' ? 'active' : 'inactive'}`}>
                {profile.accountStatus}
              </span>
            </span>
            {photoErr && (
              <span className="pf-photo-err" role="alert">
                <AlertCircle size={12} aria-hidden="true" /> {photoErr}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── Personal information ── */}
      <section aria-labelledby="pf-personal-heading" className="pf-section">
        <h2 id="pf-personal-heading" className="pf-section-label">Personal Information</h2>
        <div className="pf-card">
          {editing ? (
            <div className="pf-form-grid">
              <Field
                id="pf-firstName" label="First Name" required
                value={draft.firstName} onChange={v => setField('firstName', v)}
                error={errors.firstName}
              />
              <Field
                id="pf-lastName" label="Last Name" required
                value={draft.lastName} onChange={v => setField('lastName', v)}
                error={errors.lastName}
              />
              <Field
                id="pf-dob" label="Date of Birth"
                value={formatCustomerDate(profile.dateOfBirth, preferences)} readOnly
              />
              <Field
                id="pf-gender" label="Gender"
                value={profile.gender} readOnly
              />
            </div>
          ) : (
            <div className="pf-read-grid">
              <ReadRow label="First Name"    value={profile.firstName}   icon={User} />
              <ReadRow label="Last Name"     value={profile.lastName}    icon={User} />
              <ReadRow label="Date of Birth" value={formatCustomerDate(profile.dateOfBirth, preferences)} icon={Shield} />
              <ReadRow label="Gender"        value={profile.gender}      icon={User} />
            </div>
          )}
        </div>
      </section>

      {/* ── Contact information ── */}
      <section aria-labelledby="pf-contact-heading" className="pf-section">
        <h2 id="pf-contact-heading" className="pf-section-label">Contact Information</h2>
        <div className="pf-card">
          {editing ? (
            <div className="pf-form-grid">
              <Field
                id="pf-email" label="Email Address"
                value={profile.email} readOnly
                type="email"
              />
              <Field
                id="pf-phone" label="Phone Number" required
                value={draft.phone} onChange={v => setField('phone', v)}
                error={errors.phone} type="tel"
              />
              <Field
                id="pf-altPhone" label="Alternative Phone"
                value={draft.altPhone} onChange={v => setField('altPhone', v)}
                error={errors.altPhone} type="tel"
              />
              <Field
                id="pf-address" label="Residential Address"
                value={draft.address} onChange={v => setField('address', v)}
              />
            </div>
          ) : (
            <div className="pf-read-grid">
              <ReadRow label="Email Address"       value={profile.email}    icon={Mail} />
              <ReadRow label="Phone Number"        value={profile.phone}    icon={Phone} />
              <ReadRow label="Alternative Phone"   value={profile.altPhone} icon={Phone} />
              <ReadRow label="Residential Address" value={profile.address}  icon={MapPin} />
            </div>
          )}
        </div>
      </section>

      {/* ── Account information (always read-only) ── */}
      <section aria-labelledby="pf-account-heading" className="pf-section">
        <h2 id="pf-account-heading" className="pf-section-label">Account Information</h2>
        <div className="pf-card">
          <div className="pf-read-grid">
            <ReadRow label="Customer Reference" value={profile.customerId}   icon={Shield} />
            <ReadRow label="Account Status"     value={profile.accountStatus} icon={Shield} />
            <ReadRow label="Member Since"       value={formatCustomerDate(profile.accountSince, preferences)} icon={Shield} />
            <ReadRow label="Email Address"      value={profile.email}         icon={Mail} />
          </div>
          <p className="pf-readonly-note">
            Account details are managed by emPLE Life Insurance and cannot be changed here.
          </p>
        </div>
      </section>

      {/* ── Edit action bar ── */}
      {editing && (
        <div className="pf-action-bar" role="group" aria-label="Profile edit actions">
          <button
            type="button"
            className="pf-cancel-btn"
            onClick={cancelEdit}
            disabled={saving}
          >
            <X size={15} aria-hidden="true" />
            Cancel
          </button>
          <button
            type="button"
            className="pf-save-btn"
            onClick={handleSave}
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? (
              <span className="pf-saving-spinner" aria-hidden="true" />
            ) : (
              <Check size={15} aria-hidden="true" />
            )}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}

    </div>
  )
}
