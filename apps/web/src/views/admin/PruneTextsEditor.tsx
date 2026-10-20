// apps/web/src/views/admin/PruneTextsEditor.tsx
// Editor do texto da trava de quem nunca consentiu (spec 107 FR-010, S-5).
// A prévia é TEXTO PURO (nó de texto do React, sem HTML). O servidor valida de novo com o mesmo
// schema do core; aqui ele só antecipa o erro.

import { useState, useEffect, useMemo, useCallback } from 'react'
import { consentCopyBodySchema, renderDeadlineCopy } from '@dosiq/core'
import Button from '@shared/components/ui/Button'
import { pruneAdminService } from '@services/api/pruneAdminService'

const EXEMPLO_DATA = '20/01/2027'

export default function PruneTextsEditor() {
  const [body, setBody] = useState('')
  const [version, setVersion] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const validation = useMemo(() => consentCopyBodySchema.safeParse(body), [body])
  const issues = validation.success === false ? validation.error.issues.map((i) => i.message) : []

  useEffect(() => {
    pruneAdminService
      .getTexts()
      .then((res: any) => {
        setBody(res.data?.body ?? '')
        setVersion(res.data?.version ?? null)
      })
      .catch((err: Error) => setFeedback({ type: 'error', text: err.message }))
  }, [])

  const save = useCallback(async () => {
    setSaving(true)
    setFeedback(null)
    try {
      const res: any = await pruneAdminService.updateTexts(body)
      setVersion(res.data?.version ?? null)
      setFeedback({ type: 'success', text: 'Texto salvo. O app passa a mostrar a nova versão.' })
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }, [body])

  return (
    <section className="prune-admin__texts">
      <h2>Texto da trava no app {version !== null && <small>(versão {version})</small>}</h2>
      <p className="prune-admin__hint">
        Mostrado a quem nunca autorizou o uso de dados. Texto puro, 20 a 600 caracteres, com {'{data}'} uma única vez.
      </p>
      <textarea
        aria-label="Texto da trava"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={600}
        rows={5}
        disabled={saving}
      />
      {issues.length > 0 && (
        <ul className="prune-admin__issues">
          {issues.map((i) => <li key={i}>{i}</li>)}
        </ul>
      )}
      <div className="prune-admin__preview" aria-label="Prévia">
        {renderDeadlineCopy(validation.success ? body : null, EXEMPLO_DATA)}
      </div>
      {feedback && <p className={`prune-admin__message prune-admin__message--${feedback.type}`}>{feedback.text}</p>}
      <Button onClick={save} variant="primary" size="sm" disabled={saving || issues.length > 0}>
        Salvar texto
      </Button>
    </section>
  )
}
