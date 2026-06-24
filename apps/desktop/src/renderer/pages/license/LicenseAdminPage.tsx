/**
 * LicenseAdminPage — Gestion des licences intégrée dans SGSI
 * Accessible uniquement pour SUPER_ADMIN via Paramètres → Licences
 */

import { useState, useEffect } from 'react'
import { ipc } from '../../utils/ipcBridge'

type Plan = 'STD' | 'PRO' | 'ULT'
type GenStep = 'idle' | 'loading' | 'done' | 'error'
type SendStep = 'idle' | 'sending' | 'sent' | 'error'

const PLAN_INFO = {
  STD: { name: 'Standard',     max: '500 élèves',   color: '#6B7280' },
  PRO: { name: 'Professional', max: '2 000 élèves', color: '#6366F1' },
  ULT: { name: 'Ultimate',     max: 'Illimité',     color: '#F59E0B' },
}

export function LicenseAdminPage() {
  const [plan,       setPlan]       = useState<Plan>('PRO')
  const [school,     setSchool]     = useState('')
  const [email,      setEmail]      = useState('')
  const [year,       setYear]       = useState(new Date().getFullYear() + 1)
  const [genStep,    setGenStep]    = useState<GenStep>('idle')
  const [sendStep,   setSendStep]   = useState<SendStep>('idle')
  const [genKey,     setGenKey]     = useState('')
  const [genError,   setGenError]   = useState('')
  const [sendMsg,    setSendMsg]    = useState('')
  const [copied,     setCopied]     = useState(false)

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + i)

  const handleGenerate = async () => {
    if (!school.trim()) { setGenError("Nom de l'école requis"); return }
    setGenStep('loading')
    setGenError('')
    setGenKey('')
    setSendStep('idle')
    setSendMsg('')
    try {
      const res = await ipc.license.adminGenerate({ plan, schoolName: school.trim(), customerEmail: email.trim(), expiryYear: year, maxMachines: 1 })
      if (res?.data?.key || res?.key) {
        setGenKey(res?.data?.key ?? res?.key)
        setGenStep('done')
      } else {
        setGenError(res?.error?.message ?? res?.data?.error ?? 'Erreur génération')
        setGenStep('error')
      }
    } catch (e: any) {
      setGenError(e.message)
      setGenStep('error')
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(genKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleSend = async () => {
    if (!email.trim() || !email.includes('@')) { setSendMsg('Email du client requis'); setSendStep('error'); return }
    setSendStep('sending')
    setSendMsg('')
    try {
      const res = await ipc.license.sendKey({ licenseKey: genKey, clientEmail: email.trim(), schoolName: school.trim() })
      if (res?.data?.success || res?.success) {
        setSendStep('sent')
        setSendMsg(`✅ Clé envoyée à ${email}`)
      } else {
        setSendStep('error')
        setSendMsg(res?.error?.message ?? 'Erreur envoi email')
      }
    } catch (e: any) {
      setSendStep('error')
      setSendMsg(e.message)
    }
  }

  const reset = () => {
    setSchool(''); setEmail(''); setGenKey('')
    setGenStep('idle'); setSendStep('idle')
    setGenError(''); setSendMsg(''); setCopied(false)
  }

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div style={S.headerIcon}>🔑</div>
        <div>
          <div style={S.headerTitle}>Générer une clé de licence</div>
          <div style={S.headerSub}>Créez et envoyez une clé directement depuis l'application</div>
        </div>
      </div>

      {/* Step 1 — Info */}
      <div style={S.section}>
        <div style={S.stepLabel}><span style={S.stepNum}>1</span>Informations de l'école</div>

        <div style={S.field}>
          <label style={S.label}>Nom de l'école</label>
          <input style={S.input} placeholder="Ex: Groupe Scolaire Al Amine" value={school} onChange={e => setSchool(e.target.value)} />
        </div>
        <div style={S.field}>
          <label style={S.label}>Email du client <span style={{ color: '#6B7280', fontWeight: 400 }}>(pour lui envoyer la clé)</span></label>
          <input style={S.input} type="email" placeholder="directeur@ecole.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
      </div>

      {/* Step 2 — Plan */}
      <div style={S.section}>
        <div style={S.stepLabel}><span style={S.stepNum}>2</span>Choisir le plan</div>
        <div style={S.planGrid}>
          {(Object.entries(PLAN_INFO) as [Plan, typeof PLAN_INFO.STD][]).map(([p, info]) => (
            <button
              key={p}
              style={{ ...S.planCard, ...(plan === p ? { ...S.planCardActive, borderColor: info.color + '60', background: info.color + '12' } : {}) }}
              onClick={() => setPlan(p)}
            >
              <div style={{ ...S.planCode, color: info.color }}>{p}</div>
              <div style={S.planName}>{info.name}</div>
              <div style={S.planMax}>{info.max}</div>
            </button>
          ))}
        </div>

        <div style={S.field}>
          <label style={S.label}>Année d'expiration</label>
          <select style={S.select} value={year} onChange={e => setYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>31 décembre {y}</option>)}
          </select>
        </div>
      </div>

      {/* Step 3 — Generate */}
      <div style={S.section}>
        <div style={S.stepLabel}><span style={S.stepNum}>3</span>Générer la clé</div>

        {genError && <div style={S.errorBox}>{genError}</div>}

        <button style={{ ...S.genBtn, ...(genStep === 'loading' ? S.genBtnLoading : {}) }} onClick={handleGenerate} disabled={genStep === 'loading'}>
          {genStep === 'loading' ? <><span style={S.spin} /> Génération…</> : '🔑 Générer la clé maintenant'}
        </button>

        {/* Key result */}
        {genStep === 'done' && genKey && (
          <div style={S.keyBox}>
            <div style={S.keyLabel}>✅ Clé générée</div>
            <div style={S.keyValue}>{genKey}</div>
            <div style={S.keyMeta}>Plan {PLAN_INFO[plan].name} · {PLAN_INFO[plan].max} · Expire 31/12/{year}</div>
            <button style={S.copyBtn} onClick={handleCopy}>
              {copied ? '✅ Copié !' : '📋 Copier la clé'}
            </button>
          </div>
        )}
      </div>

      {/* Step 4 — Send */}
      {genStep === 'done' && (
        <div style={S.section}>
          <div style={S.stepLabel}><span style={S.stepNum}>4</span>Envoyer la clé par email</div>

          {sendStep === 'sent' ? (
            <div style={S.successBox}>
              <div style={S.successIcon}>✅</div>
              <div>
                <div style={S.successTitle}>{sendMsg}</div>
                <div style={S.successSub}>L'école peut maintenant activer son application avec cette clé.</div>
              </div>
            </div>
          ) : (
            <>
              {!email.trim() && <div style={S.warnBox}>⚠️ Entrez l'email du client à l'étape 1 pour pouvoir envoyer la clé.</div>}
              {sendMsg && sendStep === 'error' && <div style={S.errorBox}>{sendMsg}</div>}
              <button
                style={{ ...S.sendBtn, ...(sendStep === 'sending' ? S.genBtnLoading : {}) }}
                onClick={handleSend}
                disabled={sendStep === 'sending' || !email.trim()}
              >
                {sendStep === 'sending' ? <><span style={S.spin} /> Envoi en cours…</> : `📧 Envoyer à ${email || 'l\'email client'}`}
              </button>
            </>
          )}

          <button style={S.resetBtn} onClick={reset}>↩ Nouvelle licence</button>
        </div>
      )}
    </div>
  )
}

/* ── Styles ───────────────────────────────────────────────────── */
const S: Record<string, React.CSSProperties> = {
  root:   { fontFamily: "'Inter', 'Segoe UI', sans-serif", maxWidth: 620 },
  header: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid rgba(99,102,241,0.15)' },
  headerIcon:  { width: 46, height: 46, borderRadius: 12, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 },
  headerTitle: { fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' },
  headerSub:   { fontSize: 12, opacity: 0.55, marginTop: 3 },

  section:   { marginBottom: 24, padding: '20px', background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.1)', borderRadius: 12 },
  stepLabel: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 700, marginBottom: 16 },
  stepNum:   { width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #4F46E5)', color: '#fff', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  field: { marginBottom: 14 },
  label: { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.55, marginBottom: 6 },
  input: { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(0,0,0,0.15)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  select: { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(0,0,0,0.15)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },

  planGrid:    { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 },
  planCard:    { padding: '14px 10px', borderRadius: 10, border: '1px solid rgba(99,102,241,0.15)', background: 'transparent', cursor: 'pointer', textAlign: 'center', transition: 'all 150ms' },
  planCardActive: {},
  planCode: { fontSize: 18, fontWeight: 900, marginBottom: 4 },
  planName: { fontSize: 11, opacity: 0.6, marginBottom: 3 },
  planMax:  { fontSize: 12, fontWeight: 600 },

  genBtn:       { width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #6366F1, #4F46E5)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  genBtnLoading:{ opacity: 0.6, cursor: 'not-allowed' },

  keyBox:   { marginTop: 16, padding: '18px 20px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.3)', borderRadius: 10 },
  keyLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#059669', marginBottom: 10 },
  keyValue: { fontFamily: 'monospace', fontSize: 20, fontWeight: 900, color: '#059669', letterSpacing: 1, wordBreak: 'break-all', marginBottom: 8 },
  keyMeta:  { fontSize: 12, opacity: 0.55, marginBottom: 12 },
  copyBtn:  { padding: '7px 16px', borderRadius: 7, border: '1px solid rgba(5,150,105,0.4)', background: 'rgba(5,150,105,0.12)', color: '#059669', fontSize: 12, fontWeight: 700, cursor: 'pointer' },

  sendBtn: { width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 },
  resetBtn: { width: '100%', padding: '9px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.2)', background: 'transparent', fontSize: 13, cursor: 'pointer', opacity: 0.6 },

  successBox:  { display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.25)', borderRadius: 10, marginBottom: 12 },
  successIcon: { fontSize: 22, flexShrink: 0, marginTop: 1 },
  successTitle:{ fontSize: 14, fontWeight: 700, color: '#059669', marginBottom: 4 },
  successSub:  { fontSize: 12, opacity: 0.6 },
  warnBox:  { padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, fontSize: 12, color: '#F59E0B', marginBottom: 12 },
  errorBox: { padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 12, color: '#EF4444', marginBottom: 12 },
  spin: { display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
}
