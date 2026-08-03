// src/features/careers/JobApplyForm.tsx
// The real Phase 2 application form at /work/:slug/apply. No login required —
// recruiting shouldn't gate on having a Chillverse account, so every field
// the applicant needs is collected right here. Uploads go straight to the
// private job-applications bucket under a client-generated application id,
// then the row is inserted referencing those storage paths (see api.ts).
//
// Per the spec: if a required field is missing, the submit button stays
// disabled — no silent failed submissions.
import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, UploadCloud, CheckCircle2, X, FileText, Image as ImageIcon } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import Nav from '../../layout/Nav'
import Footer from '../../layout/Footer'
import Seo from '../../shared/components/Seo'
import {
  fetchJobBySlug, uploadApplicationFile, submitApplication, getRequiredDocs,
  type JobOpening,
} from './api'

const inputStyle: CSSProperties = {
  width: '100%', padding: '11px 13px', borderRadius: 10,
  background: 'var(--surface2, rgba(255,255,255,0.04))', border: '1px solid var(--border, rgba(255,255,255,0.1))',
  color: 'var(--ltext, #f2f0fb)', fontSize: 13.5, outline: 'none', fontFamily: 'inherit',
}
const labelStyle: CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--ltext-sec, #9b96c0)', marginBottom: 6, display: 'block',
}
const sectionStyle: CSSProperties = {
  background: 'var(--surface, rgba(255,255,255,0.02))', border: '1px solid var(--border, rgba(255,255,255,0.08))',
  borderRadius: 16, padding: '20px 18px', marginBottom: 16,
}
const sectionTitleStyle: CSSProperties = {
  fontSize: 14.5, fontWeight: 800, color: 'var(--ltext, #f2f0fb)', margin: '0 0 16px',
}

interface FormState {
  firstName: string
  middleName: string
  lastName: string
  email: string
  phone: string
  country: string
  city: string
  dateOfBirth: string
  whyChillverse: string
  familiarity: string
  linkedinUrl: string
  availableWhenNeeded: boolean | null
  communicatesInEnglish: boolean | null
  understandsNoGuarantee: boolean | null
  agreesCodeOfConduct: boolean | null
  confirmInfoAccurate: boolean
  confirmFalseInfoConsequence: boolean
  confirmProfessionalConduct: boolean
  confirmConsentStorage: boolean
  confirmReadyToContribute: boolean
}

const EMPTY_FORM: FormState = {
  firstName: '', middleName: '', lastName: '', email: '', phone: '', country: '', city: '', dateOfBirth: '',
  whyChillverse: '', familiarity: '', linkedinUrl: '',
  availableWhenNeeded: null, communicatesInEnglish: null, understandsNoGuarantee: null, agreesCodeOfConduct: null,
  confirmInfoAccurate: false, confirmFalseInfoConsequence: false, confirmProfessionalConduct: false,
  confirmConsentStorage: false, confirmReadyToContribute: false,
}

type FileKind = 'profile-pic' | 'cv' | 'portfolio' | 'cover-letter'

export default function JobApplyForm() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const [job, setJob] = useState<JobOpening | null>(null)
  const [jobLoading, setJobLoading] = useState(true)
  const [jobError, setJobError] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [files, setFiles] = useState<Record<FileKind, File | null>>({
    'profile-pic': null, cv: null, portfolio: null, 'cover-letter': null,
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [done, setDone] = useState(false)

  // Stable per-visit application id — reused as the storage folder for every
  // upload and as the row id on submit, so files and the row always match.
  const [applicationId] = useState(() => crypto.randomUUID())

  useEffect(() => {
    if (!slug) return
    let active = true
    setJobLoading(true)
    fetchJobBySlug(slug).then(({ data }) => {
      if (!active) return
      if (!data) setJobError('This role could not be found — it may have closed.')
      setJob(data)
      setJobLoading(false)
    })
    return () => { active = false }
  }, [slug])

  const required = useMemo(() => job ? getRequiredDocs(job.category) : { cv: false, portfolio: false, coverLetter: false }, [job])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev: FormState) => ({ ...prev, [key]: value }))
  }

  function handleFile(kind: FileKind, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setFiles(prev => ({ ...prev, [kind]: file }))
    e.target.value = '' // allow re-picking the same file after removal
  }

  const isValid =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    /^\S+@\S+\.\S+$/.test(form.email.trim()) &&
    form.phone.trim().length > 0 &&
    form.country.trim().length > 0 &&
    form.city.trim().length > 0 &&
    form.dateOfBirth.trim().length > 0 &&
    !!files['profile-pic'] &&
    (!required.cv || !!files.cv) &&
    (!required.portfolio || !!files.portfolio) &&
    (!required.coverLetter || !!files['cover-letter']) &&
    form.whyChillverse.trim().length > 0 &&
    form.familiarity.trim().length > 0 &&
    form.availableWhenNeeded !== null &&
    form.communicatesInEnglish !== null &&
    form.understandsNoGuarantee !== null &&
    form.agreesCodeOfConduct !== null &&
    form.confirmInfoAccurate &&
    form.confirmFalseInfoConsequence &&
    form.confirmProfessionalConduct &&
    form.confirmConsentStorage &&
    form.confirmReadyToContribute

  async function handleSubmit() {
    if (!isValid || !job || submitting) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const profilePicPath = await uploadApplicationFile(applicationId, 'profile-pic', files['profile-pic']!)
      const cvPath = files.cv ? await uploadApplicationFile(applicationId, 'cv', files.cv) : null
      const portfolioPath = files.portfolio ? await uploadApplicationFile(applicationId, 'portfolio', files.portfolio) : null
      const coverLetterPath = files['cover-letter'] ? await uploadApplicationFile(applicationId, 'cover-letter', files['cover-letter']!) : null

      const { error } = await submitApplication(applicationId, {
        jobId: job.id,
        jobTitle: job.title,
        jobCategory: job.category,
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        country: form.country.trim(),
        city: form.city.trim(),
        dateOfBirth: form.dateOfBirth,
        profilePicPath, cvPath, portfolioPath, coverLetterPath,
        whyChillverse: form.whyChillverse.trim(),
        familiarity: form.familiarity.trim(),
        linkedinUrl: form.linkedinUrl.trim(),
        availableWhenNeeded: !!form.availableWhenNeeded,
        communicatesInEnglish: !!form.communicatesInEnglish,
        understandsNoGuarantee: !!form.understandsNoGuarantee,
        agreesCodeOfConduct: !!form.agreesCodeOfConduct,
        confirmInfoAccurate: form.confirmInfoAccurate,
        confirmFalseInfoConsequence: form.confirmFalseInfoConsequence,
        confirmProfessionalConduct: form.confirmProfessionalConduct,
        confirmConsentStorage: form.confirmConsentStorage,
        confirmReadyToContribute: form.confirmReadyToContribute,
      })

      if (error) { setSubmitError(error); setSubmitting(false); return }
      setDone(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong — please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="landing-root"
      style={{ margin: '-32px calc(-1 * clamp(1rem, 4vw, 2.5rem)) -64px', padding: '32px clamp(1rem, 4vw, 2.5rem) 64px' }}
    >
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Seo title="Apply" description="Apply for a role at Chillverse." path={`/work/${slug ?? ''}/apply`} noindex />
        <Nav />

        <div style={{ paddingTop: 96 }}>
          <button
            type="button"
            onClick={(e) => { ripple(e); navigate(`/work/${slug ?? ''}`) }}
            className="ripple-wrap"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
              color: 'var(--ltext-sec, #9b96c0)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
              padding: '6px 0', marginBottom: 28,
            }}
          >
            <ChevronLeft size={16} /> Back
          </button>

          {jobLoading && <p style={{ textAlign: 'center', color: 'var(--ltext-muted, #5a5678)', fontSize: 13.5 }}>Loading…</p>}

          {!jobLoading && jobError && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p style={{ fontSize: 15, color: 'var(--ltext, #f2f0fb)', fontWeight: 700 }}>{jobError}</p>
            </div>
          )}

          {!jobLoading && job && done && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <CheckCircle2 size={44} style={{ color: '#3ecf8e', marginBottom: 16 }} />
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ltext, #f2f0fb)', margin: '0 0 10px' }}>
                Application sent
              </h1>
              <p style={{ fontSize: 13.5, color: 'var(--ltext-sec, #9b96c0)', lineHeight: 1.6, maxWidth: 380, margin: '0 auto 16px' }}>
                We've successfully received your application and our recruitment team will review it carefully.
                If your qualifications match what we're looking for, we'll contact you via email with the next
                steps, which may include an interview or a trial task.
              </p>
              <p style={{ fontSize: 12.5, color: 'var(--ltext-muted, #5a5678)', fontWeight: 700, margin: '0 auto 24px' }}>
                Estimated Review Time: 3–7 business days
              </p>
              <button
                type="button"
                onClick={(e) => { ripple(e); navigate('/work') }}
                className="ripple-wrap"
                style={{
                  padding: '12px 28px', borderRadius: 999, fontSize: 13.5, fontWeight: 800, color: '#fff',
                  background: 'linear-gradient(135deg, var(--brand-violet, #7c66ff), #3d1fb5)', border: 'none', cursor: 'pointer',
                }}
              >
                See other roles
              </button>
            </div>
          )}

          {!jobLoading && job && !done && (
            <>
              <h1 style={{ fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: 800, color: 'var(--ltext, #f2f0fb)', margin: '0 0 4px' }}>
                Apply for this job
              </h1>
              <p style={{ fontSize: 13, color: 'var(--ltext-sec, #9b96c0)', margin: '0 0 28px' }}>
                {job.title} · {job.category}
              </p>

              <section style={sectionStyle}>
                <h2 style={sectionTitleStyle}>Your details</h2>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>First name *</label>
                    <input style={inputStyle} value={form.firstName} onChange={e => set('firstName', e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Middle name</label>
                    <input style={inputStyle} value={form.middleName} onChange={e => set('middleName', e.target.value)} />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Last name *</label>
                  <input style={inputStyle} value={form.lastName} onChange={e => set('lastName', e.target.value)} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Email *</label>
                  <input type="email" style={inputStyle} value={form.email} onChange={e => set('email', e.target.value)} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Phone number *</label>
                  <input type="tel" style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Country *</label>
                    <input style={inputStyle} value={form.country} onChange={e => set('country', e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>City *</label>
                    <input style={inputStyle} value={form.city} onChange={e => set('city', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Date of birth *</label>
                  <input type="date" style={inputStyle} value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} />
                </div>
              </section>

              <section style={sectionStyle}>
                <h2 style={sectionTitleStyle}>Uploads</h2>
                <FileField
                  label="Profile picture" required
                  file={files['profile-pic']} accept="image/*" icon={<ImageIcon size={15} />}
                  onChange={e => handleFile('profile-pic', e)}
                  onRemove={() => setFiles(p => ({ ...p, 'profile-pic': null }))}
                />
                <FileField
                  label="CV / résumé" required={required.cv}
                  file={files.cv} accept=".pdf,.doc,.docx" icon={<FileText size={15} />}
                  onChange={e => handleFile('cv', e)}
                  onRemove={() => setFiles(p => ({ ...p, cv: null }))}
                />
                <FileField
                  label="Portfolio" required={required.portfolio}
                  file={files.portfolio} accept=".pdf,.doc,.docx,image/*" icon={<FileText size={15} />}
                  onChange={e => handleFile('portfolio', e)}
                  onRemove={() => setFiles(p => ({ ...p, portfolio: null }))}
                />
                <FileField
                  label="Cover letter" required={required.coverLetter} last
                  file={files['cover-letter']} accept=".pdf,.doc,.docx" icon={<FileText size={15} />}
                  onChange={e => handleFile('cover-letter', e)}
                  onRemove={() => setFiles(p => ({ ...p, 'cover-letter': null }))}
                />
              </section>

              <section style={sectionStyle}>
                <h2 style={sectionTitleStyle}>About you</h2>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Why do you want to work at Chillverse? *</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: 100, resize: 'vertical', lineHeight: 1.6 }}
                    value={form.whyChillverse} onChange={e => set('whyChillverse', e.target.value)}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>How familiar are you with Chillverse and other online platforms? *</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: 80, resize: 'vertical', lineHeight: 1.6 }}
                    value={form.familiarity} onChange={e => set('familiarity', e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>LinkedIn profile</label>
                  <input style={inputStyle} value={form.linkedinUrl} onChange={e => set('linkedinUrl', e.target.value)} placeholder="Optional — leave blank if none" />
                </div>
              </section>

              <section style={sectionStyle}>
                <h2 style={sectionTitleStyle}>A few quick questions</h2>
                <YesNoRow
                  question="Will you be readily available when we need you, depending on what job you are applying for?"
                  value={form.availableWhenNeeded} onChange={v => set('availableWhenNeeded', v)}
                />
                <YesNoRow
                  question="Can you communicate effectively in English?"
                  value={form.communicatesInEnglish} onChange={v => set('communicatesInEnglish', v)}
                />
                <YesNoRow
                  question="Do you understand that submitting this application does not guarantee a position?"
                  value={form.understandsNoGuarantee} onChange={v => set('understandsNoGuarantee', v)}
                />
                <YesNoRow
                  question="Do you agree to follow the Chillverse Staff Code of Conduct if selected?"
                  value={form.agreesCodeOfConduct} onChange={v => set('agreesCodeOfConduct', v)} last
                />
              </section>

              <section style={sectionStyle}>
                <h2 style={sectionTitleStyle}>Confirmations</h2>
                <CheckRow label="I confirm that all the information I provided is accurate." checked={form.confirmInfoAccurate} onChange={v => set('confirmInfoAccurate', v)} />
                <CheckRow label="I understand that providing false information may result in my application being rejected or my position being terminated." checked={form.confirmFalseInfoConsequence} onChange={v => set('confirmFalseInfoConsequence', v)} />
                <CheckRow label="I agree to communicate professionally and respectfully with the Chillverse team." checked={form.confirmProfessionalConduct} onChange={v => set('confirmProfessionalConduct', v)} />
                <CheckRow label="I consent to Chillverse reviewing and storing my application for recruitment purposes." checked={form.confirmConsentStorage} onChange={v => set('confirmConsentStorage', v)} />
                <CheckRow label="I am ready to contribute to Chillverse if selected." checked={form.confirmReadyToContribute} onChange={v => set('confirmReadyToContribute', v)} last />
              </section>

              {submitError && (
                <div style={{ background: 'rgba(255,79,79,0.08)', border: '1px solid rgba(255,79,79,0.25)', borderRadius: 12, padding: '12px 16px', color: '#ff8080', fontSize: 13, marginBottom: 16 }}>
                  {submitError}
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isValid || submitting}
                style={{
                  width: '100%', padding: '15px 0', borderRadius: 999, fontSize: 14.5, fontWeight: 800, color: '#fff',
                  background: isValid && !submitting ? 'linear-gradient(135deg, var(--brand-violet, #7c66ff), #3d1fb5)' : 'var(--surface2, rgba(255,255,255,0.06))',
                  border: 'none', cursor: isValid && !submitting ? 'pointer' : 'not-allowed',
                  opacity: isValid && !submitting ? 1 : 0.55, marginTop: 8,
                }}
              >
                {submitting ? 'Submitting…' : 'Submit application'}
              </button>
              {!isValid && (
                <p style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--ltext-muted, #5a5678)', marginTop: 10 }}>
                  Fill in all required fields (marked *) and uploads to submit.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 96 }}>
        <Footer />
      </div>
    </div>
  )
}

function FileField({
  label, required, file, accept, icon, onChange, onRemove, last,
}: {
  label: string
  required: boolean
  file: File | null
  accept: string
  icon: ReactNode
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
  last?: boolean
}) {
  const inputId = `apply-file-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div style={{ marginBottom: last ? 0 : 12 }}>
      <label style={labelStyle}>{label} {required ? '*' : <span style={{ color: 'var(--ltext-muted, #5a5678)', fontWeight: 600 }}>(optional)</span>}</label>
      <input id={inputId} type="file" accept={accept} onChange={onChange} style={{ display: 'none' }} />
      {file ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 13px', borderRadius: 10, background: 'var(--surface2, rgba(255,255,255,0.04))', border: '1px solid var(--border, rgba(255,255,255,0.1))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {icon}
            <span style={{ fontSize: 12.5, color: 'var(--ltext, #f2f0fb)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
          </div>
          <button type="button" onClick={onRemove} style={{ background: 'none', border: 'none', color: 'var(--ltext-muted, #5a5678)', cursor: 'pointer', flexShrink: 0, display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', borderRadius: 10, cursor: 'pointer',
            background: 'var(--surface2, rgba(255,255,255,0.04))', border: '1px dashed var(--border, rgba(255,255,255,0.16))',
            color: 'var(--ltext-sec, #9b96c0)', fontSize: 12.5,
          }}
        >
          <UploadCloud size={15} /> Choose file
        </label>
      )}
    </div>
  )
}

function YesNoRow({
  question, value, onChange, last,
}: { question: string; value: boolean | null; onChange: (v: boolean) => void; last?: boolean }) {
  return (
    <div style={{ marginBottom: last ? 0 : 16 }}>
      <p style={{ fontSize: 13, color: 'var(--ltext, #f2f0fb)', lineHeight: 1.5, margin: '0 0 8px' }}>{question}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['Yes', 'No'] as const).map(opt => {
          const boolVal = opt === 'Yes'
          const active = value === boolVal
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(boolVal)}
              style={{
                padding: '8px 20px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                background: active ? 'var(--brand-violet, #7c66ff)' : 'var(--surface2, rgba(255,255,255,0.05))',
                border: `1px solid ${active ? 'var(--brand-violet, #7c66ff)' : 'var(--border, rgba(255,255,255,0.1))'}`,
                color: active ? '#fff' : 'var(--ltext-sec, #9b96c0)',
              }}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CheckRow({
  label, checked, onChange, last,
}: { label: string; checked: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: last ? 0 : 12 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, color: 'var(--ltext-sec, #9b96c0)', lineHeight: 1.5 }}>{label}</span>
    </label>
  )
}
