import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthProvider'
import { supabase } from '@/lib/supabase'

type TourPhase = 'hidden' | 'welcome' | 'tour' | 'complete'

interface TourStep {
  path: string
  target: string
  title: string
  description: string
  bullets: string[]
  tip?: string
}

const steps: TourStep[] = [
  {
    path: '/dashboard', target: '[data-tour="dashboard-stats"]', title: 'Dashboard Overview',
    description: 'This is your Dashboard. These cards automatically update as your records change.',
    bullets: ['Total Students', 'Active Scholarships', 'Expiring Scholarships', 'Open Scholarship Conflict Cases'],
  },
  {
    path: '/students', target: '[data-tour="student-records"]', title: 'Student Records',
    description: 'This is where administrators manage scholar information.',
    bullets: ['Add and search students', 'Edit records and optional profile fields', 'Import Excel files', 'Use batch actions and export PDF reports'],
    tip: 'GWA, Address, Organization, Email, and Contact Number are optional during student creation.',
  },
  {
    path: '/students', target: '[data-tour="verify-enrollment"]', title: 'Verify Enrollment',
    description: 'Compare the official enrollment list with active scholarship records.',
    bullets: ['Select Academic Year and Semester', 'Paste official Student IDs', 'Review unmatched and unlisted records', 'Confirm only the changes you intend to apply'],
    tip: 'No student is marked Not Enrolled until an administrator reviews and confirms the record.',
  },
  {
    path: '/reports', target: '[data-tour="report-analytics"]', title: 'Reports & Analytics',
    description: 'Generate real-time reports using Academic Year, Semester, College, Program, Category, Scholarship, Status, and Enrollment filters.',
    bullets: ['Charts refresh with the selected filters', 'Review category totals and term trends', 'Export the current report as a PDF'],
  },
  {
    path: '/reports', target: '[data-tour="scholarship-conflicts"]', title: 'Scholarship Conflict Cases',
    description: 'SIGMA detects two or more Active scholarships for the same student in the same Academic Year and Semester.',
    bullets: ['Open the flagged student', 'Compare the conflicting scholarships', 'Review the academic term', 'Keep the case open until it is resolved'],
  },
  {
    path: '/reports', target: '[data-tour="scholarship-conflicts"]', title: 'Resolve Scholarship Conflict',
    description: 'Open a conflict case, review both records, and choose the outcome that accurately describes what happened.',
    bullets: ['Scholarship Deactivated or Record Corrected', 'Duplicate Entry Removed', 'Approved Exception or False Positive', 'Other, with a required audit note'],
    tip: 'Every resolution is saved in the case history for audit transparency.',
  },
  {
    path: '/reports', target: '[data-tour="sigmai-launcher"]', title: 'Meet SIGMAI 🤖',
    description: 'SIGMAI retrieves information from the system using natural-language questions.',
    bullets: ['“List DOST scholars in CEN”', '“How many scholars for A.Y. 2025–2026?”', '“Student 24-0760”', '“Show scholarship conflict cases”'],
    tip: 'SIGMAI answers using the records currently stored in SIGMA.',
  },
]

export function OnboardingTour() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [phase, setPhase] = useState<TourPhase>('hidden')
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)

  const saveCompletion = useCallback(async () => {
    if (!user) return
    localStorage.setItem(`sigma:onboarding:${user.id}`, 'complete')
    await (supabase as any).from('user_onboarding').upsert({ user_id: user.id, has_completed_onboarding: true, completed_at: new Date().toISOString() })
  }, [user])

  useEffect(() => {
    if (!user) return
    let active = true
    async function loadStatus() {
      if (localStorage.getItem(`sigma:onboarding:${user!.id}`) === 'complete') return
      const { data, error } = await (supabase as any)
        .from('user_onboarding')
        .select('has_completed_onboarding')
        .eq('user_id', user!.id)
        .maybeSingle()
      if (!active) return
      if (!error && data?.has_completed_onboarding === false) setPhase('welcome')
      // If the migration has not yet been applied, fail closed: existing users
      // are not interrupted and can still launch the tour from the profile menu.
    }
    void loadStatus()
    return () => { active = false }
  }, [user])

  useEffect(() => {
    const replay = () => {
      setStepIndex(0)
      setPhase('tour')
    }
    window.addEventListener('sigma:start-tour', replay)
    return () => window.removeEventListener('sigma:start-tour', replay)
  }, [])

  useEffect(() => {
    if (phase !== 'tour') return
    const step = steps[stepIndex]
    if (location.pathname !== step.path) {
      navigate(step.path)
      return
    }
    let cancelled = false
    const findTarget = () => {
      const element = document.querySelector(step.target)
      if (!element) return
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      window.setTimeout(() => {
        if (!cancelled) setRect(element.getBoundingClientRect())
      }, 350)
    }
    const timer = window.setTimeout(findTarget, 120)
    const update = () => {
      const element = document.querySelector(step.target)
      if (element) setRect(element.getBoundingClientRect())
    }
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [location.pathname, navigate, phase, stepIndex])

  const finish = useCallback(async (showCompletion = false) => {
    await saveCompletion()
    setRect(null)
    setPhase(showCompletion ? 'complete' : 'hidden')
  }, [saveCompletion])

  useEffect(() => {
    if (phase === 'hidden') return
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void finish(false)
      if (phase === 'tour' && event.key === 'ArrowRight' && stepIndex < steps.length - 1) setStepIndex((value) => value + 1)
      if (phase === 'tour' && event.key === 'ArrowLeft' && stepIndex > 0) setStepIndex((value) => value - 1)
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [finish, phase, stepIndex])

  if (phase === 'hidden') return null

  if (phase === 'welcome' || phase === 'complete') {
    const complete = phase === 'complete'
    return <div className="sigma-tour-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="sigma-tour-modal-title">
      <div className="sigma-tour-welcome">
        <div className="sigma-tour-welcome-icon">{complete ? '🎉' : '👋'}</div>
        <p className="sigma-tour-kicker">CLSU Scholarship Management System</p>
        <h2 id="sigma-tour-modal-title">{complete ? "You're All Set!" : 'Welcome to SIGMA!'}</h2>
        <p>{complete ? "You're now ready to use the SIGMA Scholarship Management System." : 'This one-minute guided tour will show you how to manage records, verify enrollment, review conflicts, generate reports, and use SIGMAI.'}</p>
        {!complete && <ul><li><Check size={16} /> Follow the real administrator workflow</li><li><Check size={16} /> Learn without changing any records</li><li><Check size={16} /> Replay anytime from the profile menu</li></ul>}
        <div className="sigma-tour-welcome-actions">
          <button className="sigma-tour-primary" onClick={() => { setStepIndex(0); setPhase('tour') }}>{complete ? 'Replay Tour' : 'Start Tour'}</button>
          <button className="sigma-tour-secondary" onClick={() => complete ? navigate('/dashboard') : void finish(false)}>{complete ? 'Go to Dashboard' : 'Skip for Now'}</button>
        </div>
        <small>You can replay this tour anytime from your profile menu → Website Tour.</small>
      </div>
    </div>
  }

  const step = steps[stepIndex]
  const spotlightLeft = rect ? Math.max(8, rect.left - 8) : 16
  const spotlightTop = rect ? Math.max(8, rect.top - 8) : 16
  const targetStyle = rect ? {
    left: spotlightLeft, top: spotlightTop,
    width: Math.max(1, Math.min(window.innerWidth - spotlightLeft - 8, rect.width + 16)),
    height: Math.max(1, Math.min(window.innerHeight - spotlightTop - 8, rect.height + 16)),
  } : { left: 16, top: 16, width: 1, height: 1 }

  return <div className="sigma-tour-layer" role="dialog" aria-modal="true" aria-label={`Website tour, step ${stepIndex + 1} of ${steps.length}`}>
    <div className="sigma-tour-spotlight" style={targetStyle} />
    <section className={`sigma-tour-card ${rect && rect.top > window.innerHeight / 2 ? 'sigma-tour-card-top' : ''}`}>
      <button className="sigma-tour-close" onClick={() => void finish(false)} aria-label="Skip website tour"><X size={18} /></button>
      <p className="sigma-tour-kicker">Step {stepIndex + 1} of {steps.length}</p>
      <h2>{step.title}</h2>
      <p>{step.description}</p>
      <ul>{step.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
      {step.tip && <div className="sigma-tour-tip"><strong>Tip:</strong> {step.tip}</div>}
      <div className="sigma-tour-progress" aria-label={`${stepIndex + 1} of ${steps.length} steps complete`}><span style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} /></div>
      <div className="sigma-tour-actions">
        <button className="sigma-tour-skip" onClick={() => void finish(false)}>Skip Tour</button>
        <div>
          <button className="sigma-tour-icon-button" disabled={stepIndex === 0} onClick={() => setStepIndex((value) => value - 1)}><ChevronLeft size={16} /> Back</button>
          <button className="sigma-tour-primary" onClick={() => stepIndex === steps.length - 1 ? void finish(true) : setStepIndex((value) => value + 1)}>{stepIndex === steps.length - 1 ? 'Finish' : <>Next <ChevronRight size={16} /></>}</button>
        </div>
      </div>
    </section>
  </div>
}
