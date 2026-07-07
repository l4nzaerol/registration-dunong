import { useState } from 'react'
import './App.css'

const INITIAL_FORM = {
  fullName: '',
  email: '',
  organization: '',
  phone: '',
}

function generateRegistrationNumber() {
  const date = new Date()
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('')

  const randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()

  return `DUNONG-${datePart}-${randomPart}`
}

function App() {
  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [registrationNumber, setRegistrationNumber] = useState(null)

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

  function handleSubmit(event) {
    event.preventDefault()

    const nextErrors = validate()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setRegistrationNumber(generateRegistrationNumber())
  }

  function handleRegisterAnother() {
    setForm(INITIAL_FORM)
    setErrors({})
    setRegistrationNumber(null)
  }

  if (registrationNumber) {
    return (
      <div className="page">
        <section className="card success-card">
          <div className="success-icon" aria-hidden="true">
            ✓
          </div>
          <h1>Registration Successful</h1>
          <p className="success-message">
            Thank you, <strong>{form.fullName}</strong>. You are registered for the
            webinar.
          </p>

          <div className="registration-number-box">
            <span className="registration-label">Your Registration Number</span>
            <span className="registration-number">{registrationNumber}</span>
          </div>

          <p className="registration-note">
            Please save this number. You may need it to confirm your attendance.
          </p>

          <div className="summary">
            <h2>Registration Details</h2>
            <dl>
              <div>
                <dt>Email</dt>
                <dd>{form.email}</dd>
              </div>
              <div>
                <dt>Organization</dt>
                <dd>{form.organization}</dd>
              </div>
              {form.phone && (
                <div>
                  <dt>Phone</dt>
                  <dd>{form.phone}</dd>
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
        <p className="eyebrow">Webinar Registration</p>
        <h1>DUNONG WEBINAR
        </h1>
        <p className="subtitle">
          Fill in your details below to secure your spot. You will receive a unique
          registration number after submitting.
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

          <button type="submit" className="btn btn-primary">
            Complete Registration
          </button>
        </form>
      </section>
    </div>
  )
}

export default App
