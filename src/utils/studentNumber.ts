// SIGMA has historical records using YY-NNNN and newer Registrar exports
// using YYYY-NNNNN-AA (for example, 2023-04512-MN). Keep both formats
// valid so old data remains usable while current files import correctly.
export function normalizeStudentNumber(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/\s+/g, '')
}

export function isValidStudentNumber(value: string): boolean {
  return /^(?:[0-9]{2}-[0-9]{4}|[0-9]{4}-[0-9]{5}-[A-Z]{2})$/.test(value)
}
