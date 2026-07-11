const GAS_URL = import.meta.env.VITE_GAS_WEB_APP_URL

function ensureConfigured() {
  if (!GAS_URL || GAS_URL.includes('PASTE_YOUR')) {
    throw new Error(
      'Google Apps Script URL is not configured. Add VITE_GAS_WEB_APP_URL to your .env file.',
    )
  }
}

async function callGas(payload) {
  ensureConfigured()

  const response = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
  })

  const text = await response.text()

  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Unexpected response from Google Apps Script.')
  }
}

export async function registerParticipant(form) {
  const address = String(form.address || '').trim()

  return callGas({
    action: 'register',
    fullName: form.fullName,
    email: form.email,
    address,
    phone: form.phone,
  })
}

export async function verifyRegistrationCode(code) {
  return callGas({
    action: 'verify',
    code,
  })
}

export async function issueCertificate(code) {
  return callGas({
    action: 'issueCertificate',
    code,
  })
}

export function isGasConfigured() {
  return Boolean(GAS_URL && !GAS_URL.includes('PASTE_YOUR'))
}
