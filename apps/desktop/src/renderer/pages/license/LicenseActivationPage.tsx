/**
 * LicenseActivationPage — Professional activation screen
 * Shown when no valid license is found on startup.
 */

import { useState, useEffect } from 'react'
import { ipc } from '../../utils/ipcBridge'

type Step = 'idle' | 'loading' | 'success' | 'error'
type ReqStep = 'idle' | 'loading' | 'sent' | 'error'

export function LicenseActivationPage({ onActivated }: { onActivated: () => void }) {
  const [key,        setKey]        = useState('')
  const [step,       setStep]       = useState<Step>('idle')
  const [message,    setMessage]    = useState('')
  const [hardwareId, setHardwareId] = useState('')
  const [fullHwId,   setFullHwId]   = useState('')
  const [planInfo,   setPlanInfo]   = useState<{ planName: string; maxStudents: number; expiresAt: string | null } | null>(null)

  // Request modal state
  const [showModal,    setShowModal]    = useState(false)
  const [reqSchool,    setReqSchool]    = useState('')
  const [reqEmail,     setReqEmail]     = useState('')
  const [reqName,      setReqName]      = useState('')
  const [reqPlan,      setReqPlan]      = useState<'STD'|'PRO'|'ULT'>('STD')
  const [reqMessage,   setReqMessage]   = useState('')
  const [reqStep,      setReqStep]      = useState<ReqStep>('idle')
  const [reqFeedback,  setReqFeedback]  = useState('')

  useEffect(() => {
    ipc.license.get().then(res => {
      if (res?.data?.shortHardwareId) setHardwareId(res.data.shortHardwareId)
      if (res?.data?.hardwareId)      setFullHwId(res.data.hardwareId.replace('...', ''))
      if (res?.shortHardwareId)       setHardwareId(res.shortHardwareId)
    }).catch(() => {})
  }, [])

  const handleRequestKey = async () => {
    if (!reqSchool.trim())                           { setReqFeedback("Nom de l'école requis"); return }
    if (!reqEmail.trim() || !reqEmail.includes('@')) { setReqFeedback("Email valide requis"); return }

    setReqStep('loading')
    setReqFeedback('')
    try {
      // Use IPC — main process makes the HTTP call (no CSP restriction)
      const res = await ipc.license.request({
        schoolName:   reqSchool.trim(),
        contactEmail: reqEmail.trim(),
        contactName:  reqName.trim(),
        plan:         reqPlan,
        hardwareId:   fullHwId || hardwareId,
        message:      reqMessage.trim(),
      })

      if (res?.success !== false && (res?.data?.success || res?.success)) {
        setReqStep('sent')
        setReqFeedback(res?.data?.message ?? res?.message ?? 'Demande envoyée !')
      } else {
        setReqStep('error')
        setReqFeedback(res?.error?.message ?? res?.data?.error ?? 'Erreur lors de la demande.')
      }
    } catch (e: any) {
      setReqStep('error')
      setReqFeedback(e.message ?? 'Erreur. Contactez lambertmillimono8@gmail.com directement.')
    }
  }

  const handleActivate = async () => {
    const trimmed = key.trim().toUpperCase()
    if (!trimmed) { setMessage('Veuillez saisir une clé de licence.'); return }

    setStep('loading')
    setMessage('')
    try {
      const res = await ipc.license.activate(trimmed)
      if (res?.success !== false) {
        setPlanInfo({
          planName:    res?.data?.planName ?? res?.planName ?? '',
          maxStudents: res?.data?.maxStudents ?? res?.maxStudents ?? 0,
          expiresAt:   res?.data?.expiresAt ?? res?.expiresAt ?? null,
        })
        setStep('success')
        setTimeout(() => onActivated(), 2000)
      } else {
        setMessage(res?.error?.message ?? 'Échec de l\'activation.')
        setStep('error')
      }
    } catch (e: any) {
      setMessage(e.message ?? 'Erreur de connexion au serveur de licences.')
      setStep('error')
    }
  }

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Illimitée'

  return (
    <div style={S.root}>
      {/* Background grid */}
      <div style={S.grid} />

      <div style={S.card}>
        {/* Logo */}
        <div style={S.logoWrap}>
          <div style={S.logoMark}>S</div>
          <div>
            <div style={S.logoTitle}>SGSI</div>
            <div style={S.logoSub}>SchoolManager Pro</div>
          </div>
        </div>

        {step === 'success' ? (
          /* Success state */
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={S.checkCircle}>✓</div>
            <div style={S.successTitle}>Licence activée !</div>
            {planInfo && (
              <div style={S.successMeta}>
                <span style={S.planBadge}>{planInfo.planName}</span>
                <span style={S.metaItem}>· {planInfo.maxStudents.toLocaleString()} élèves max</span>
                <span style={S.metaItem}>· Expire le {fmtDate(planInfo.expiresAt)}</span>
              </div>
            )}
            <div style={S.successSub}>Chargement de l'application…</div>
          </div>
        ) : (
          <>
            <div style={S.heading}>Activer votre licence</div>
            <div style={S.sub}>
              Entrez la clé de licence fournie par votre distributeur SGSI pour activer l'application.
            </div>

            {/* Key input */}
            <div style={S.fieldGroup}>
              <label style={S.label}>CLÉ DE LICENCE</label>
              <input
                style={S.input}
                type="text"
                placeholder="SGSI-PRO-XXXXXXXX-2027"
                value={key}
                onChange={e => setKey(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleActivate()}
                spellCheck={false}
                maxLength={32}
                disabled={step === 'loading'}
              />
              <div style={S.keyHint}>Format : SGSI-{'{STD|PRO|ULT}'}-XXXXXXXX-YYYY</div>
            </div>

            {/* Error */}
            {step === 'error' && message && (
              <div style={S.errorBox}>
                <span style={{ marginRight: 8 }}>⚠</span>{message}
              </div>
            )}

            {/* Hardware ID */}
            {hardwareId && (
              <div style={S.hwBox}>
                <span style={S.hwLabel}>ID machine</span>
                <span style={S.hwValue}>{hardwareId}…</span>
                <span style={S.hwNote}>(communiquez cet identifiant à votre distributeur)</span>
              </div>
            )}

            {/* Activate button */}
            <button
              style={{ ...S.btn, ...(step === 'loading' ? S.btnDisabled : {}) }}
              onClick={handleActivate}
              disabled={step === 'loading'}
            >
              {step === 'loading' ? (
                <span style={S.spinner} />
              ) : (
                '→ Activer la licence'
              )}
            </button>

            {/* Demander une clé */}
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <div style={S.dividerRow}>
                <div style={S.dividerLine} /><span style={S.dividerText}>Vous n'avez pas encore de clé ?</span><div style={S.dividerLine} />
              </div>
              <button style={S.requestBtn} onClick={() => { setShowModal(true); setReqStep('idle'); setReqFeedback('') }}>
                📩 Demander une clé d'activation
              </button>
            </div>

            {/* Plans info */}
            <div style={S.plansRow}>
              {[
                { code: 'STD', name: 'Standard',     max: '500',       color: '#6B7280' },
                { code: 'PRO', name: 'Professional', max: '2 000',     color: '#6366F1' },
                { code: 'ULT', name: 'Ultimate',     max: 'Illimité',  color: '#F59E0B' },
              ].map(p => (
                <div key={p.code} style={{ ...S.planCard, borderColor: p.color + '30' }}>
                  <div style={{ ...S.planCode, color: p.color }}>{p.code}</div>
                  <div style={S.planName}>{p.name}</div>
                  <div style={S.planMax}>{p.max} élèves</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Modal: Demande de clé ──────────────────────────── */}
        {showModal && (
          <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) { setShowModal(false) } }}>
            <div style={S.modal}>
              <div style={S.modalHeader}>
                <div style={S.modalTitle}>📩 Demander une clé d'activation</div>
                <button style={S.closeBtn} onClick={() => setShowModal(false)}>×</button>
              </div>

              {reqStep === 'sent' ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={S.sentIcon}>✓</div>
                  <div style={S.sentTitle}>Demande envoyée !</div>
                  <div style={S.sentDesc}>{reqFeedback}</div>
                  <div style={S.sentNote}>Vérifiez votre boîte email dans les prochaines heures.</div>
                  <button style={S.closeModalBtn} onClick={() => setShowModal(false)}>Fermer</button>
                </div>
              ) : (
                <>
                  <div style={S.modalDesc}>
                    Remplissez ce formulaire. L'administrateur SGSI recevra votre demande et vous enverra une clé par email.
                  </div>

                  <div style={S.modalForm}>
                    <div style={S.mfGroup}>
                      <label style={S.mfLabel}>Nom de l'école *</label>
                      <input style={S.mfInput} placeholder="Ex: Groupe Scolaire Al Amine" value={reqSchool} onChange={e => setReqSchool(e.target.value)} disabled={reqStep === 'loading'} />
                    </div>
                    <div style={S.mfGroup}>
                      <label style={S.mfLabel}>Votre nom complet *</label>
                      <input style={S.mfInput} placeholder="Ex: Mamadou Diallo" value={reqName} onChange={e => setReqName(e.target.value)} disabled={reqStep === 'loading'} />
                    </div>
                    <div style={S.mfGroup}>
                      <label style={S.mfLabel}>Email de contact *</label>
                      <input style={S.mfInput} type="email" placeholder="directeur@ecole.com" value={reqEmail} onChange={e => setReqEmail(e.target.value)} disabled={reqStep === 'loading'} />
                      <span style={{ fontSize: 11, color: '#3A3A58', marginTop: 2 }}>
                        L'administrateur SGSI vous contactera à cette adresse pour vous envoyer votre clé.
                      </span>
                    </div>
                    <div style={S.mfGroup}>
                      <label style={S.mfLabel}>Plan souhaité</label>
                      <div style={S.planSelector}>
                        {(['STD','PRO','ULT'] as const).map(p => {
                          const names = { STD: 'Standard (500 élèves)', PRO: 'Professional (2 000 élèves)', ULT: 'Ultimate (Illimité)' }
                          return (
                            <button key={p} style={{ ...S.planOpt, ...(reqPlan === p ? S.planOptActive : {}) }} onClick={() => setReqPlan(p)}>
                              <strong style={{ color: reqPlan === p ? '#818CF8' : '#6B7280' }}>{p}</strong>
                              <span style={{ fontSize: 10, color: '#6B7280', display: 'block', marginTop: 2 }}>{names[p]}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div style={S.mfGroup}>
                      <label style={S.mfLabel}>Message (optionnel)</label>
                      <textarea style={{ ...S.mfInput, resize: 'none' } as React.CSSProperties} rows={2} placeholder="Ex: Nous avons 350 élèves, école primaire..." value={reqMessage} onChange={e => setReqMessage(e.target.value)} disabled={reqStep === 'loading'} />
                    </div>

                    {reqFeedback && reqStep === 'error' && (
                      <div style={S.mfError}>{reqFeedback}</div>
                    )}

                    <button
                      style={{ ...S.btn, marginTop: 4, ...(reqStep === 'loading' ? S.btnDisabled : {}) }}
                      onClick={handleRequestKey}
                      disabled={reqStep === 'loading'}
                    >
                      {reqStep === 'loading' ? <span style={S.spinner} /> : '📩 Envoyer la demande'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div style={S.footer}>SGSI SchoolManager Pro v2 · Tous droits réservés</div>
      </div>
    </div>
  )
}

/* ── Styles ───────────────────────────────────────────────────── */
const S: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh', width: '100%',
    background: 'linear-gradient(135deg, #0F0F1A 0%, #1A1A2E 50%, #0F0F1A 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px 16px', fontFamily: "'Inter', 'Segoe UI', sans-serif",
    position: 'relative', overflow: 'hidden',
  },
  grid: {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage: 'linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)',
    backgroundSize: '40px 40px',
  },
  card: {
    width: '100%', maxWidth: 480, position: 'relative',
    background: 'rgba(26,26,46,0.8)', backdropFilter: 'blur(24px)',
    border: '1px solid rgba(99,102,241,0.2)',
    borderRadius: 20, padding: '40px 44px 32px',
    boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.1)',
  },
  logoWrap: {
    display: 'flex', alignItems: 'center', gap: 12,
    marginBottom: 36,
  },
  logoMark: {
    width: 42, height: 42, borderRadius: 10,
    background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, fontWeight: 900, color: '#fff',
    boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
  },
  logoTitle: { fontSize: 18, fontWeight: 800, color: '#F0EFFF', letterSpacing: '-0.03em' },
  logoSub:   { fontSize: 11, color: '#6B6B8A', letterSpacing: '0.05em' },

  heading: { fontSize: 22, fontWeight: 800, color: '#F0EFFF', letterSpacing: '-0.03em', marginBottom: 10 },
  sub:      { fontSize: 13, color: '#A0A0C0', lineHeight: 1.6, marginBottom: 28 },

  fieldGroup: { marginBottom: 20 },
  label:  { display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6B6B8A', marginBottom: 8 },
  input: {
    width: '100%', padding: '12px 16px', boxSizing: 'border-box',
    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: 10, color: '#F0EFFF', fontSize: 15, letterSpacing: '0.05em',
    fontFamily: 'monospace', outline: 'none', transition: 'border-color 150ms',
  },
  keyHint: { fontSize: 11, color: '#3A3A58', marginTop: 6, fontFamily: 'monospace' },

  errorBox: {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8, padding: '10px 14px',
    color: '#FCA5A5', fontSize: 13, marginBottom: 16, lineHeight: 1.5,
  },

  hwBox: {
    background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
    borderRadius: 8, padding: '10px 14px', marginBottom: 20,
    display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
  },
  hwLabel: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6366F1' },
  hwValue: { fontFamily: 'monospace', fontSize: 12, color: '#A5B4FC', fontWeight: 600 },
  hwNote:  { fontSize: 11, color: '#3A3A58' },

  btn: {
    width: '100%', padding: '13px', borderRadius: 10, border: 'none',
    background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
    color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: '0 4px 20px rgba(99,102,241,0.4)', transition: 'opacity 150ms',
    letterSpacing: '-0.01em',
  },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  spinner: {
    width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)',
    borderTop: '2px solid #fff', borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },

  plansRow: { display: 'flex', gap: 8, marginTop: 24 },
  planCard: {
    flex: 1, padding: '10px 8px', borderRadius: 8,
    background: 'rgba(255,255,255,0.02)', border: '1px solid',
    textAlign: 'center',
  },
  planCode: { fontSize: 11, fontWeight: 700, marginBottom: 3 },
  planName: { fontSize: 10, color: '#6B6B8A', marginBottom: 2 },
  planMax:  { fontSize: 11, fontWeight: 600, color: '#A0A0C0' },

  /* Success */
  checkCircle: {
    width: 64, height: 64, borderRadius: '50%',
    background: 'linear-gradient(135deg, #059669, #10B981)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 30, color: '#fff', margin: '0 auto 20px',
    boxShadow: '0 8px 24px rgba(5,150,105,0.4)',
  },
  successTitle: { fontSize: 22, fontWeight: 800, color: '#F0EFFF', marginBottom: 12 },
  successMeta:  { display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 },
  planBadge:    { background: 'rgba(99,102,241,0.2)', color: '#818CF8', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 },
  metaItem:     { fontSize: 12, color: '#A0A0C0', alignSelf: 'center' },
  successSub:   { fontSize: 13, color: '#6B6B8A' },

  footer: { marginTop: 32, textAlign: 'center', fontSize: 11, color: '#2A2A3A' },

  /* Divider */
  dividerRow:  { display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 14px' },
  dividerLine: { flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' },
  dividerText: { fontSize: 11, color: '#3A3A58', whiteSpace: 'nowrap' as const },

  /* Request button */
  requestBtn: {
    background: 'transparent',
    border: '1px solid rgba(99,102,241,0.4)',
    borderRadius: 10, padding: '10px 20px',
    color: '#818CF8', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', transition: 'all 150ms',
    width: '100%',
  },

  /* Modal overlay */
  overlay: {
    position: 'fixed' as const, inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  modal: {
    background: '#1A1A2E', border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: 18, padding: 0, width: '100%', maxWidth: 480,
    maxHeight: '90vh', overflowY: 'auto' as const,
    boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '22px 28px 0',
  },
  modalTitle:  { fontSize: 17, fontWeight: 700, color: '#F0EFFF' },
  closeBtn:    {
    background: 'none', border: 'none', color: '#6B6B8A',
    fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 4,
  },
  modalDesc: { padding: '12px 28px 0', fontSize: 13, color: '#A0A0C0', lineHeight: 1.6 },
  modalForm: { padding: '16px 28px 24px', display: 'flex', flexDirection: 'column' as const, gap: 14 },
  mfGroup:   { display: 'flex', flexDirection: 'column' as const, gap: 5 },
  mfLabel:   { fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#6B6B8A' },
  mfInput:   {
    padding: '10px 14px', background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8,
    color: '#F0EFFF', fontSize: 13, outline: 'none',
    fontFamily: "'Inter', 'Segoe UI', sans-serif", width: '100%', boxSizing: 'border-box' as const,
  },
  mfError: {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8, padding: '8px 12px', color: '#FCA5A5', fontSize: 12,
  },
  planSelector: { display: 'flex', gap: 8 },
  planOpt: {
    flex: 1, padding: '8px 6px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.15)',
    background: 'transparent', cursor: 'pointer', textAlign: 'center' as const,
    transition: 'all 150ms', fontSize: 13,
  },
  planOptActive: {
    background: 'rgba(99,102,241,0.15)', borderColor: 'rgba(99,102,241,0.4)',
  },

  /* Sent state */
  sentIcon:  {
    width: 56, height: 56, borderRadius: '50%',
    background: 'linear-gradient(135deg, #059669, #10B981)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 26, color: '#fff', margin: '0 auto 16px',
  },
  sentTitle:    { fontSize: 18, fontWeight: 700, color: '#F0EFFF', marginBottom: 10 },
  sentDesc:     { fontSize: 13, color: '#A0A0C0', lineHeight: 1.6, marginBottom: 8, padding: '0 20px' },
  sentNote:     { fontSize: 12, color: '#6B6B8A', marginBottom: 24 },
  closeModalBtn: {
    background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: 8, padding: '10px 28px',
    color: '#818CF8', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
}
