import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
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

export async function downloadCertificate() {
  const element = document.getElementById('e-certificate')
  if (!element) {
    throw new Error('Certificate not found.')
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 10
  const maxWidth = pageWidth - margin * 2
  const maxHeight = pageHeight - margin * 2

  const imgRatio = canvas.width / canvas.height
  let renderWidth = maxWidth
  let renderHeight = renderWidth / imgRatio

  if (renderHeight > maxHeight) {
    renderHeight = maxHeight
    renderWidth = renderHeight * imgRatio
  }

  const x = (pageWidth - renderWidth) / 2
  const y = (pageHeight - renderHeight) / 2

  pdf.addImage(imgData, 'PNG', x, y, renderWidth, renderHeight)
  pdf.save('Dunong-Webinar-Certificate.pdf')
}
