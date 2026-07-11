import { useEffect, useRef, useState } from 'react'
import {
  isGasConfigured,
  issueCertificate,
  registerParticipant,
} from './api/sheetsApi'
import Certificate, { downloadCertificate } from './components/Certificate'
import './App.css'

const GOOGLE_FORM_URL = import.meta.env.VITE_GOOGLE_FORM_URL || ''
const APP_MODE = import.meta.env.VITE_APP_MODE || 'both'
const IS_REGISTER_ONLY = APP_MODE === 'register'
const IS_CERTIFICATE_ONLY = APP_MODE === 'certificate'
const SHOW_BOTH_TABS = APP_MODE === 'both'

const INITIAL_REGISTRATION = {
  fullName: '',
  email: '',
  address: '',
  phone: '',
}

function getCodeFromUrl() {
  return new URLSearchParams(window.location.search).get('code')?.trim() || ''
}

function shouldAutoDownload() {
  return new URLSearchParams(window.location.search).get('download') === '1'
}

function CopyCodeButton({ code }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = code
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      type="button"
      className="btn btn-copy"
      onClick={handleCopy}
      aria-label="Copy registration code"
    >
      {copied ? 'Copied!' : 'Copy Code'}
    </button>
  )
}

function getInitialPage() {
  if (IS_REGISTER_ONLY) {
    return 'register'
  }

  if (IS_CERTIFICATE_ONLY) {
    return 'certificate'
  }

  if (getCodeFromUrl()) {
    return 'certificate'
  }

  if (new URLSearchParams(window.location.search).get('tab') === 'certificate') {
    return 'certificate'
  }

  return 'register'
}

function App() {
  const [page, setPage] = useState(getInitialPage)

  return (
    <div className="app-shell">
      {!isGasConfigured() && (
        <div className="config-banner" role="status">
          Google Sheets is not connected yet. Add <code>VITE_GAS_WEB_APP_URL</code> to your{' '}
          <code>.env</code> file. See <code>google-apps-script/SETUP.md</code>.
        </div>
      )}

      {SHOW_BOTH_TABS && (
        <nav className="nav-tabs" aria-label="Webinar pages">
          <button
            type="button"
            className={page === 'register' ? 'nav-tab active' : 'nav-tab'}
            onClick={() => setPage('register')}
          >
            Registration
          </button>
          <button
            type="button"
            className={page === 'certificate' ? 'nav-tab active' : 'nav-tab'}
            onClick={() => setPage('certificate')}
          >
            E-Certificate
          </button>
        </nav>
      )}

      {page === 'register' ? (
        IS_REGISTER_ONLY && getCodeFromUrl() ? (
          <CertificateUnavailablePage />
        ) : (
          <RegistrationPage />
        )
      ) : (
        <CertificatePage />
      )}
    </div>
  )
}

function RegistrationPage() {
  const [form, setForm] = useState(INITIAL_REGISTRATION)
  const [errors, setErrors] = useState({})
  const [registration, setRegistration] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  function handleChange(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  function validate() {
    const nextErrors = {}

    if (!form.fullName.trim()) {
      nextErrors.fullName = 'Full name is required.'
    }

    if (!form.email.trim()) {
      nextErrors.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = 'Enter a valid email address.'
    }

    if (!form.address.trim()) {
      nextErrors.address = 'Address is required.'
    }

    if (form.phone.trim() && !/^[\d\s+\-()]+$/.test(form.phone)) {
      nextErrors.phone = 'Enter a valid phone number.'
    }

    return nextErrors
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitError('')

    const nextErrors = validate()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSubmitting(true)

    try {
      const result = await registerParticipant(form)

      if (!result.success) {
        setSubmitError(result.message || 'Registration failed. Please try again.')
        return
      }

      setRegistration({
        ...result,
        address: result.address || form.address,
      })
    } catch (error) {
      setSubmitError(error.message || 'Unable to connect to Google Sheets.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleRegisterAnother() {
    setForm(INITIAL_REGISTRATION)
    setErrors({})
    setRegistration(null)
    setSubmitError('')
  }

  if (registration) {
    return (
      <div className="page">
        <section className="card success-card">
          <div className="success-icon" aria-hidden="true">
            ✓
          </div>
          <h1>Registration Successful</h1>
          <p className="success-message">
            Thank you, <strong>{registration.fullName}</strong>. You are registered for the
            Dunong Webinar.
          </p>

          <div className="registration-number-box">
            <span className="registration-label">Your Registration Code</span>
            <div className="registration-code-row">
              <span className="registration-number">{registration.registrationCode}</span>
              <CopyCodeButton code={registration.registrationCode} />
            </div>
          </div>

          <p className="registration-note">
            Save this code. After the webinar, submit the feedback Google Form using this code.
            A personalized e-certificate claim link will be sent to your registered email and shown
            in the form confirmation message.
          </p>

          {GOOGLE_FORM_URL && (
            <p className="registration-note">
              <a href={GOOGLE_FORM_URL} target="_blank" rel="noopener noreferrer">
                Open Feedback Form
              </a>{' '}
              (available after the webinar)
            </p>
          )}

          <div className="summary">
            <h2>Registration Details</h2>
            <dl>
              <div>
                <dt>Email</dt>
                <dd>{registration.email}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{registration.address}</dd>
              </div>
              {registration.phone && (
                <div>
                  <dt>Phone</dt>
                  <dd>{registration.phone}</dd>
                </div>
              )}
            </dl>
          </div>

          <button type="button" className="btn btn-secondary" onClick={handleRegisterAnother}>
            Register Another Person
          </button>
        </section>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="header">
        <p className="eyebrow"></p>
        <h1>DUNONG</h1>
        <p className="subtitle">
          A LEADERSHIP WEBINAR FOR ASPIRING YOUTH LEADERS
        </p>
      </header>

      <section className="card">
        <form className="registration-form" onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="fullName">Full Name *</label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                value={form.fullName}
                onChange={handleChange}
                placeholder="Juan Dela Cruz"
                autoComplete="name"
              />
              {errors.fullName && <span className="error">{errors.fullName}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address *</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
              />
              {errors.email && <span className="error">{errors.email}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="address">Address *</label>
            <input
              id="address"
              name="address"
              type="text"
              value={form.address}
              onChange={handleChange}
              placeholder="Street, city, province"
              autoComplete="street-address"
            />
            {errors.address && (
              <span className="error">{errors.address}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              placeholder="+63 912 345 6789"
              autoComplete="tel"
            />
            {errors.phone && <span className="error">{errors.phone}</span>}
          </div>

          {submitError && <p className="form-error">{submitError}</p>}

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving Registration...' : 'Complete Registration'}
          </button>
        </form>
      </section>
    </div>
  )
}

function CertificateUnavailablePage() {
  return (
    <div className="page">
      <header className="header">
        <p className="eyebrow">After the Webinar</p>
        <h1>E-Certificate</h1>
        <p className="subtitle">
          Certificate claiming opens on a separate site after the webinar. Check the link in your
          feedback form confirmation email, or contact the organizers if you need help.
        </p>
      </header>

      <section className="card">
        <p className="registration-note">
          Your registration code <strong>{getCodeFromUrl()}</strong> is saved. Use the certificate
          site once feedback has been submitted.
        </p>
      </section>
    </div>
  )
}

function CertificatePage() {
  const codeFromUrl = getCodeFromUrl()
  const [step, setStep] = useState(() => (codeFromUrl ? 'loading' : 'form'))
  const [code, setCode] = useState(() => codeFromUrl)
  const [errors, setErrors] = useState({})
  const [certificateData, setCertificateData] = useState(null)
  const [submitting, setSubmitting] = useState(Boolean(codeFromUrl))
  const [downloading, setDownloading] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [downloadError, setDownloadError] = useState('')
  const [feedbackRequired, setFeedbackRequired] = useState(false)
  const [autoDownloadPending, setAutoDownloadPending] = useState(false)
  const autoClaimStarted = useRef(false)

  async function fetchCertificate(registrationCode, options = {}) {
    const { autoDownload = false } = options
    setSubmitError('')
    setFeedbackRequired(false)

    const trimmedCode = registrationCode.trim()
    if (!trimmedCode) {
      setErrors({ code: 'Registration code is required.' })
      setStep('form')
      return
    }

    setSubmitting(true)
    setStep('loading')

    try {
      const result = await issueCertificate(trimmedCode)

      if (!result.success) {
        setFeedbackRequired(Boolean(result.feedbackRequired))
        setSubmitError(result.message || 'Unable to issue certificate.')
        setStep('form')
        setCode(trimmedCode)
        return
      }

      setCertificateData(result)
      setStep('certificate')
      setAutoDownloadPending(autoDownload)

      const url = new URL(window.location.href)
      url.searchParams.set('code', result.registrationCode)
      if (autoDownload) {
        url.searchParams.set('download', '1')
      } else {
        url.searchParams.delete('download')
      }
      window.history.replaceState({}, '', url)
    } catch (error) {
      setSubmitError(error.message || 'Unable to connect to Google Sheets.')
      setStep('form')
      setCode(trimmedCode)
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!codeFromUrl || autoClaimStarted.current) {
      return
    }

    autoClaimStarted.current = true
    fetchCertificate(codeFromUrl, { autoDownload: shouldAutoDownload() })
  }, [codeFromUrl])

  useEffect(() => {
    if (!autoDownloadPending || step !== 'certificate' || !certificateData) {
      return
    }

    let cancelled = false

    async function runAutoDownload() {
      setDownloading(true)
      setDownloadError('')

      try {
        await new Promise((resolve) => setTimeout(resolve, 500))
        if (!cancelled) {
          await downloadCertificate()
        }
      } catch (error) {
        if (!cancelled) {
          setDownloadError(error.message || 'Unable to download certificate. Please try again.')
        }
      } finally {
        if (!cancelled) {
          setDownloading(false)
          setAutoDownloadPending(false)
        }
      }
    }

    runAutoDownload()

    return () => {
      cancelled = true
    }
  }, [autoDownloadPending, step, certificateData])

  function handleChange(event) {
    setCode(event.target.value)
    if (errors.code) {
      setErrors({})
    }
  }

  async function handleDownload() {
    setDownloadError('')
    setDownloading(true)

    try {
      await downloadCertificate()
    } catch (error) {
      setDownloadError(error.message || 'Unable to download certificate. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setErrors({})
    await fetchCertificate(code)
  }

  function handleReset() {
    setStep('form')
    setCode('')
    setErrors({})
    setCertificateData(null)
    setSubmitError('')
    setDownloadError('')
    setFeedbackRequired(false)
    setAutoDownloadPending(false)

    const url = new URL(window.location.href)
    url.searchParams.delete('code')
    url.searchParams.delete('download')
    window.history.replaceState({}, '', url)
  }

  if (step === 'loading') {
    return (
      <div className="page">
        <header className="header">
          <p className="eyebrow">After the Webinar</p>
          <h1>Your E-Certificate</h1>
          <p className="subtitle">
            {submitting
              ? 'Generating your e-certificate with your name and registration code...'
              : 'Preparing your certificate...'}
          </p>
        </header>

        <section className="card">
          <p className="registration-note">Please wait a moment.</p>
        </section>
      </div>
    )
  }

  if (step === 'certificate' && certificateData) {
    return (
      <div className="page">
        <header className="header">
          <p className="eyebrow">After the Webinar</p>
          <h1>Your E-Certificate</h1>
          <p className="subtitle">
            {certificateData.fullName} — URN: {certificateData.registrationCode}
          </p>
        </header>

        <Certificate
          fullName={certificateData.fullName}
          registrationCode={certificateData.registrationCode}
        />

        <div className="certificate-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? 'Generating PDF...' : 'Download Certificate (PDF)'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleReset}>
            Get Another Certificate
          </button>
          {downloadError && <p className="form-error">{downloadError}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="header">
        <p className="eyebrow"></p>
        <h1>E-Certificate</h1>
          <p className="subtitle">
          Enter your registration code after submitting the feedback Google Form, or use the
          personalized link from your confirmation email — your certificate loads automatically.
        </p>
      </header>

      <section className="card">
        <form className="registration-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="code">Registration Code *</label>
            <input
              id="code"
              name="code"
              type="text"
              value={code}
              onChange={handleChange}
              placeholder="DUNONG-20260707-ABC123"
              autoComplete="off"
            />
            {errors.code && <span className="error">{errors.code}</span>}
          </div>

          {submitError && <p className="form-error">{submitError}</p>}

          {feedbackRequired && GOOGLE_FORM_URL && (
            <p className="registration-note">
              <a href={GOOGLE_FORM_URL} target="_blank" rel="noopener noreferrer">
                Open Feedback Form
              </a>
            </p>
          )}

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Verifying...' : 'Get E-Certificate'}
          </button>
        </form>
      </section>
    </div>
  )
}

export default App
