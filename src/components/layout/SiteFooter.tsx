import { Mail, MapPin, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import clsuLogo from '@/assets/clsu-logo.png'

const footerLinks = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Student Records', to: '/students' },
  { label: 'Scholarships', to: '/scholarships' },
  { label: 'Reports & Analytics', to: '/reports' },
]

export function SiteFooter() {
  return (
    <footer
      className="mt-auto border-t"
      style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
      aria-label="SIGMA website footer"
    >
      <div className="mx-auto grid max-w-[1600px] gap-8 px-4 py-9 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.35fr_0.8fr_1.2fr] lg:px-8">
        <section className="flex items-start gap-4" aria-labelledby="footer-brand-title">
          <img src={clsuLogo} alt="Central Luzon State University seal" className="h-14 w-14 shrink-0 object-contain" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
              Office of Admissions
            </p>
            <h2 id="footer-brand-title" className="mt-1 text-2xl font-extrabold tracking-[0.04em]" style={{ color: 'var(--nav-header-dark)' }}>
              SIGMA
            </h2>
            <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Scholarship Management System</p>
            <p className="mt-2 max-w-sm text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
              Office of Admissions · Central Luzon State University
            </p>
          </div>
        </section>

        <nav aria-labelledby="footer-links-title">
          <h2 id="footer-links-title" className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Quick Links</h2>
          <ul className="mt-3 space-y-2.5">
            {footerLinks.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="inline-flex text-sm font-medium transition-colors duration-200 hover:underline"
                  style={{ color: 'var(--btn-primary-bg)' }}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section className="md:col-span-2 lg:col-span-1" aria-labelledby="footer-contact-title">
          <h2 id="footer-contact-title" className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Contact Information</h2>
          <ul className="mt-3 space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <li className="flex items-start gap-2.5">
              <MapPin size={17} className="mt-0.5 shrink-0" aria-hidden="true" style={{ color: 'var(--btn-primary-bg)' }} />
              <span>Office of Admissions, Central Luzon State University<br />Science City of Muñoz, Nueva Ecija 3120</span>
            </li>
            <li>
              <a className="flex items-center gap-2.5 transition-colors hover:underline" href="mailto:admissions@clsu.edu.ph" style={{ color: 'var(--text-secondary)' }}>
                <Mail size={17} className="shrink-0" aria-hidden="true" style={{ color: 'var(--btn-primary-bg)' }} />
                admissions@clsu.edu.ph
              </a>
            </li>
            <li>
              <a className="flex items-center gap-2.5 transition-colors hover:underline" href="tel:+63444560688" style={{ color: 'var(--text-secondary)' }}>
                <Phone size={17} className="shrink-0" aria-hidden="true" style={{ color: 'var(--btn-primary-bg)' }} />
                (044) 456-0688
              </a>
            </li>
          </ul>
        </section>
      </div>

      <div className="border-t px-4 py-4 text-center" style={{ borderColor: 'var(--divider-light)', background: 'var(--bg-app)' }}>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          © 2026 Central Luzon State University · SIGMA Scholarship Management System
        </p>
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>Developed for the CLSU Office of Admissions</p>
      </div>
    </footer>
  )
}
