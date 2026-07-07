import { useState } from 'react'
import {
  isGasConfigured,
  registerParticipant,
  submitFeedback,
  verifyRegistrationCode,
} from './api/sheetsApi'
import Certificate, { downloadCertificate } from './components/Certificate'
import './App.css'

const INITIAL_REGISTRATION = {
  fullName: '',
  email: '',
  organization: '',
  phone: '',
}

const INITIAL_FEEDBACK = {
  code: '',
  rating: '',
  comments: '',
}

function App() {
  const [page, setPage] = useState('register')

  return (
    <div className="app-shell">
      {!isGasConfigured() && (
        <div className="config-banner" role="status">
          Google Sheets is not connected yet. Add <code>VITE_GAS_WEB_APP_URL</code> to your{' '}
          <code>.env</code> file. See <code>google-apps-script/SETUP.md</code>.
        </div>
      )}

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
          className={page === 'feedback' ? 'nav-tab active' : 'nav-tab'}
          onClick={() => setPage('feedback')}
        >
          Feedback & Certificate
        </button>
      </nav>

      {page === 'register' ? <RegistrationPage /> : <FeedbackPage />}
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

    if (!form.organization.trim()) {
      nextErrors.organization = 'Organization is required.'
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

      setRegistration(result)
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
            <span className="registration-number">{registration.registrationCode}</span>
          </div>

          <p className="registration-note">
            Save this code. You will need it after the webinar to submit feedback and download
            your e-certificate.
          </p>

          <div className="summary">
            <h2>Registration Details</h2>
            <dl>
              <div>
                <dt>Email</dt>
                <dd>{registration.email}</dd>
              </div>
              <div>
                <dt>Organization</dt>
                <dd>{registration.organization}</dd>
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
        <p className="eyebrow">Before the Webinar</p>
        <h1>DUNONG WEBINAR</h1>
        <p className="subtitle">
          Register to receive a unique code. After the webinar, use that code on the Feedback
          page to verify your attendance and download your e-certificate.
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
            <label htmlFor="organization">Organization *</label>
            <input
              id="organization"
              name="organization"
              type="text"
              value={form.organization}
              onChange={handleChange}
              placeholder="Company or institution"
              autoComplete="organization"
            />
            {errors.organization && (
              <span className="error">{errors.organization}</span>
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

function FeedbackPage() {
  const [step, setStep] = useState('form')
  const [form, setForm] = useState(INITIAL_FEEDBACK)
  const [errors, setErrors] = useState({})
  const [certificateData, setCertificateData] = useState(null)
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

    if (!form.code.trim()) {
      nextErrors.code = 'Registration code is required.'
    }

    if (!form.rating) {
      nextErrors.rating = 'Please select a rating.'
    }

    if (!form.comments.trim()) {
      nextErrors.comments = 'Please enter your feedback.'
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
      const verification = await verifyRegistrationCode(form.code)

      if (!verification.success || !verification.valid) {
        setSubmitError(
          verification.message ||
            'Registration code not found. Only registered participants can submit feedback.',
        )
        return
      }

      const result = await submitFeedback({
        code: form.code,
        rating: Number(form.rating),
        comments: form.comments,
      })

      if (!result.success) {
        setSubmitError(result.message || 'Feedback submission failed.')
        return
      }

      setCertificateData(result)
      setStep('certificate')
    } catch (error) {
      setSubmitError(error.message || 'Unable to connect to Google Sheets.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleReset() {
    setStep('form')
    setForm(INITIAL_FEEDBACK)
    setErrors({})
    setCertificateData(null)
    setSubmitError('')
  }

  if (step === 'certificate' && certificateData) {
    return (
      <div className="page">
        <header className="header">
          <p className="eyebrow">After the Webinar</p>
          <h1>Your E-Certificate</h1>
          <p className="subtitle">{certificateData.message}</p>
        </header>

        <Certificate
          fullName={certificateData.fullName}
          registrationCode={certificateData.registrationCode}
          organization={certificateData.organization}
        />

        <div className="certificate-actions">
          <button type="button" className="btn btn-primary" onClick={downloadCertificate}>
            Download Certificate (PDF)
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleReset}>
            Submit Another Feedback
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="header">
        <p className="eyebrow">After the Webinar</p>
        <h1>Feedback & E-Certificate</h1>
        <p className="subtitle">
          Enter the registration code you received before the webinar. Your code will be
          verified in Google Sheets before your e-certificate is issued.
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
              value={form.code}
              onChange={handleChange}
              placeholder="DUNONG-20260707-ABC123"
              autoComplete="off"
            />
            {errors.code && <span className="error">{errors.code}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="rating">Webinar Rating *</label>
            <select
              id="rating"
              name="rating"
              value={form.rating}
              onChange={handleChange}
            >
              <option value="">Select a rating</option>
              <option value="5">5 - Excellent</option>
              <option value="4">4 - Good</option>
              <option value="3">3 - Average</option>
              <option value="2">2 - Fair</option>
              <option value="1">1 - Poor</option>
            </select>
            {errors.rating && <span className="error">{errors.rating}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="comments">Your Feedback *</label>
            <textarea
              id="comments"
              name="comments"
              rows="5"
              value={form.comments}
              onChange={handleChange}
              placeholder="Share what you learned and suggestions for future webinars."
            />
            {errors.comments && <span className="error">{errors.comments}</span>}
          </div>

          {submitError && <p className="form-error">{submitError}</p>}

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Verifying & Submitting...' : 'Submit Feedback & Get Certificate'}
          </button>
        </form>
      </section>
    </div>
  )
}

export default App
