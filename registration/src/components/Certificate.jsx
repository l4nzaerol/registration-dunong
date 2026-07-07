import './Certificate.css'

export default function Certificate({ fullName, registrationCode, organization }) {
  const issuedDate = new Date().toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="certificate-wrapper">
      <div className="certificate" id="e-certificate">
        <div className="certificate-border">
          <p className="certificate-eyebrow">Certificate of Participation</p>
          <h2 className="certificate-title">DUNONG WEBINAR</h2>
          <p className="certificate-text">This is to certify that</p>
          <p className="certificate-name">{fullName}</p>
          {organization && <p className="certificate-org">{organization}</p>}
          <p className="certificate-text">
            has successfully participated in the Dunong Webinar and submitted the required
            feedback.
          </p>
          <div className="certificate-meta">
            <div>
              <span className="certificate-meta-label">Registration Code</span>
              <span className="certificate-meta-value">{registrationCode}</span>
            </div>
            <div>
              <span className="certificate-meta-label">Date Issued</span>
              <span className="certificate-meta-value">{issuedDate}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function downloadCertificate() {
  window.print()
}
