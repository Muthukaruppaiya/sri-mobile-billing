import { PageHeader, Panel } from '../components/ui'

export function ComingSoonPage({
  title,
  phase,
  detail,
}: {
  title: string
  phase: string
  detail: string
}) {
  return (
    <div className="section-gap">
      <PageHeader title={title} subtitle={`${phase} — schema ready, UI next`} />
      <Panel style={{ padding: 24 }} dashed>
        <h2 className="section-title" style={{ marginBottom: 8 }}>
          Coming soon
        </h2>
        <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
          {detail}
        </p>
      </Panel>
    </div>
  )
}
