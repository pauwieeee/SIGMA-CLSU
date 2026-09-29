import { useEffect, useState } from 'react'

const STORAGE_KEY = 'sigma:analytics-academic-year'
const CHANGE_EVENT = 'sigma:analytics-academic-year-changed'

export function useAnalyticsAcademicYear() {
  const [academicYear, setAcademicYearState] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '')

  useEffect(() => {
    const sync = () => setAcademicYearState(localStorage.getItem(STORAGE_KEY) ?? '')
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  function setAcademicYear(value: string) {
    if (value) localStorage.setItem(STORAGE_KEY, value)
    else localStorage.removeItem(STORAGE_KEY)
    setAcademicYearState(value)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }

  return [academicYear, setAcademicYear] as const
}
