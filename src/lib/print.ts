export type DocKind = 'sale' | 'jobcard' | 'service-bill' | 'purchase'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

/** Open a printable document in a new tab (auth token is shared via localStorage). */
export function openDoc(kind: DocKind, id: string, opts: { autoPrint?: boolean } = {}) {
  const qs = opts.autoPrint ? '?print=1' : ''
  window.open(`${basename}/print/${kind}/${id}${qs}`, '_blank', 'noopener')
}
