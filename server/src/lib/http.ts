import type { ZodError } from 'zod'

/** One readable line for the UI instead of a raw validation tree. */
export function zodMessage(err: ZodError) {
  const issue = err.issues[0]
  if (!issue) return 'Invalid input'
  const field = issue.path.filter((p) => typeof p === 'string').pop()
  if (!field || issue.message.toLowerCase().includes(String(field).toLowerCase())) {
    return issue.message
  }
  return `${String(field)}: ${issue.message}`
}
