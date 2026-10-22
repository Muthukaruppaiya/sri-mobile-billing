let counter = 0

/** Local row key. crypto.randomUUID only exists on HTTPS / localhost, so don't rely on it. */
export function uid() {
  counter += 1
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
