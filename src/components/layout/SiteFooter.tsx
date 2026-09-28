import { Mail, Phone } from 'lucide-react'
import clsuLogo from '@/assets/clsu-logo.png'

export function SiteFooter() {
  return (
    <footer data-sigma-footer className="mt-auto border-t" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }} aria-label="SIGMA website footer">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-6 py-4 sm:px-8 md:flex-row md:items-center md:justify-between md:gap-8">
        <section className="flex min-w-0 items-center gap-3.5" aria-labelledby="footer-brand-title">
          <img src={clsuLogo} alt="Central Luzon State University seal" className="h-12 w-12 shrink-0 object-contain" />
          <div className="min-w-0 leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>Office of Admissions</p>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
              <h2 id="footer-brand-title" className="text-xl font-extrabold tracking-[0.04em]" style={{ color: 'var(--nav-header-dark)' }}>SIGMA</h2>
              <p className="text-xs font-semibold sm:text-sm" style={{ color: 'var(--text-secondary)' }}>Scholarship Management System</p>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:gap-5" aria-label="Office of Admissions contact information">
          <a className="flex items-center gap-2 transition-colors hover:underline" href="mailto:admissions@clsu.edu.ph" style={{ color: 'var(--text-secondary)' }}>
            <Mail size={16} className="shrink-0" aria-hidden="true" style={{ color: 'var(--btn-primary-bg)' }} />
            admissions@clsu.edu.ph
          </a>
          <a className="flex items-center gap-2 transition-colors hover:underline" href="tel:+63444560688" style={{ color: 'var(--text-secondary)' }}>
            <Phone size={16} className="shrink-0" aria-hidden="true" style={{ color: 'var(--btn-primary-bg)' }} />
            (044) 456-0688
          </a>
        </section>
      </div>

      <div className="border-t px-6 py-2 text-center" style={{ borderColor: 'var(--divider-light)', background: 'var(--bg-app)' }}>
        <p className="text-[11px] leading-4" style={{ color: 'var(--text-secondary)' }}>
          © 2026 Central Luzon State University
          <span className="mx-1.5 hidden text-gray-300 sm:inline" aria-hidden="true">·</span>
          <span className="block sm:inline" style={{ color: 'var(--text-muted)' }}>Developed for the CLSU Office of Admissions</span>
        </p>
      </div>
    </footer>
  )
}
