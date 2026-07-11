const API_URL = '/api/gas'
const GAS_URL = import.meta.env.VITE_GAS_WEB_APP_URL

function ensureDirectGasConfigured() {
  if (!GAS_URL || GAS_URL.includes('PASTE_YOUR')) {
    throw new Error(
      'Google Apps Script URL is not configured. Set VITE_GAS_WEB_APP_URL in your environment (Vercel project settings for production).',
    )
  }
}

async function parseGasResponse(response) {
  const text = await response.text()

  try {
    const data = JSON.parse(text)
    if (!response.ok && data.message) {
      throw new Error(data.message)
    }
    return data
  } catch (error) {
    if (error instanceof Error && !error.message.startsWith('Unexpected response')) {
      throw error
    }
    throw new Error('Unexpected response from Google Apps Script.')
  }
}

async function postToUrl(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
  })

  return parseGasResponse(response)
}

async function callGas(payload) {
  const requestOptions = {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
  }

  // Try server-side proxy first (Vercel api/gas.js or Vite dev middleware).
  // This works even when VITE_GAS_WEB_APP_URL is only set server-side.
  try {
    const proxyResponse = await fetch(API_URL, requestOptions)
    if (proxyResponse.status !== 404) {
      if (!proxyResponse.ok && GAS_URL && !GAS_URL.includes('PASTE_YOUR')) {
        // Proxy misconfigured on the host — try direct GAS call if the URL is in the build.
        try {
          return await postToUrl(GAS_URL, payload)
        } catch {
          // Fall through to the proxy error below.
        }
      }

      return parseGasResponse(proxyResponse)
    }
  } catch {
    // Proxy unavailable — fall back to direct GAS call.
  }

  ensureDirectGasConfigured()

  try {
    return await postToUrl(GAS_URL, payload)
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        'Unable to connect to the registration server. Check your internet connection and try again.',
      )
    }
    throw error
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

export async function checkCertificateStatus(code) {
  return callGas({
    action: 'checkCertificateStatus',
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
  // In production, /api/gas reads GAS_WEB_APP_URL server-side on Vercel.
  if (import.meta.env.PROD) {
    return true
  }

  return Boolean(GAS_URL && !GAS_URL.includes('PASTE_YOUR'))
}
