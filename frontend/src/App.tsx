import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, Bell, CheckCircle2, ChevronDown, ClipboardList, FileText, HeartPulse, LayoutDashboard, LogOut, PawPrint, Search, Settings as SettingsIcon, ShieldCheck, Stethoscope, Users, ArrowRight } from 'lucide-react'
import './App.css'
import { api, type Case, type CasePriority, type CaseStatus, type DashboardSummary, type Diagnosis, type SimilarCase, type TreatmentStep, type Vet } from './api'
import logoAsset from './assets/PashuRakshak_LOGO_final_TRANSPARENT.png'

type NavKey = 'overview' | 'queue' | 'in_progress' | 'patients' | 'team' | 'settings'
type QueueViewMode = 'list' | 'detail'

const navItems: { key: NavKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'queue', label: 'Case queue', icon: ClipboardList },
  { key: 'in_progress', label: 'In progress', icon: Stethoscope },
  { key: 'patients', label: 'My patients', icon: PawPrint },
  { key: 'team', label: 'Team', icon: Users },
]

const demoAccounts = [
  { email: 'demo@pashurakshak.in', password: 'demo123', label: 'Dr. Riya Mehta' },
  { email: 'field@pashurakshak.in', password: 'demo123', label: 'Dr. Arjun Shah' },
  { email: 'admin@pashurakshak.in', password: 'demo123', label: 'Dr. Kavita Rao' },
]

const statusOptions: { value: '' | CaseStatus; label: string }[] = [
  { value: '', label: 'All cases' },
  { value: 'new', label: 'New' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'closed', label: 'Closed' },
]

const priorityLabel = (priority: CasePriority) => priority === 'red_flag' ? 'Red flag' : priority === 'high' ? 'High' : 'Normal'
const statusLabel = (status: CaseStatus) => status === 'in_progress' ? 'In progress' : status.charAt(0).toUpperCase() + status.slice(1)

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} day(s) ago`
}

const initials = (name: string) => name.split(' ').map((part) => part[0]).slice(0, 2).join('')

function App() {
  const [vet, setVet] = useState<Vet | null>(null);
  const [loginError, setLoginError] = useState('');
  const [activeNav, setActiveNav] = useState<NavKey>('overview');
  const [queueView, setQueueView] = useState<QueueViewMode>('list');
  const [cases, setCases] = useState<Case[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [similarCases, setSimilarCases] = useState<SimilarCase[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | CaseStatus>('');
  const [loadError, setLoadError] = useState('');
  const [team, setTeam] = useState<Vet[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [trackerSelectedId, setTrackerSelectedId] = useState<string | null>(null)
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null)
  const [treatmentSteps, setTreatmentSteps] = useState<TreatmentStep[]>([])
  const [treatmentLoading, setTreatmentLoading] = useState(false)
  const [treatmentProgress, setTreatmentProgress] = useState<Record<string, number>>({})
  const [reportCaseId, setReportCaseId] = useState<string | null>(null)

  useEffect(() => {
    if (!vet) return;
    api.getCases(statusFilter ? { status: statusFilter } : {}).then((data) => {
      setCases(data);
      setLoadError('');
      if (!selectedId && data.length) setSelectedId(data[0].id)
    }).catch((error: Error) => setLoadError(error.message));
    api.getSummary().then(setSummary).catch(() => undefined)
  }, [vet, statusFilter])

  useEffect(() => {
    if (!selectedId) return;
    setSimilarLoading(true);
    api.getSimilarCases(selectedId).then(setSimilarCases).catch(() => setSimilarCases([])).finally(() => setSimilarLoading(false))
  }, [selectedId])

  useEffect(() => {
    if (activeNav !== 'team' || !vet) return;
    setTeamLoading(true);
    api.getVets().then(setTeam).catch(() => setTeam([])).finally(() => setTeamLoading(false))
  }, [activeNav, vet])

  const inProgressCases = cases.filter((item) => item.status === 'in_progress' && item.assigned_vet_id === vet?.id)

  useEffect(() => {
    if (!vet || !inProgressCases.length) return
    Promise.all(inProgressCases.map(async (item) => [item.id, (await api.getTreatmentSteps(item.id)).filter((step) => step.completed_at).length] as const))
      .then((entries) => setTreatmentProgress(Object.fromEntries(entries)))
      .catch(() => undefined)
  }, [vet, cases])

  useEffect(() => {
    if (activeNav !== 'in_progress' || !trackerSelectedId) return
    setTreatmentLoading(true)
    Promise.all([api.getDiagnosis(trackerSelectedId), api.getTreatmentSteps(trackerSelectedId)])
      .then(([savedDiagnosis, steps]) => { setDiagnosis(savedDiagnosis); setTreatmentSteps(steps) })
      .catch(() => { setDiagnosis(null); setTreatmentSteps([]) })
      .finally(() => setTreatmentLoading(false))
  }, [activeNav, trackerSelectedId])

  const selectedCase = cases.find((item) => item.id === selectedId) ?? null;
  const filteredCases = cases.filter((item) => `${item.species} ${item.reported_by} ${item.village} ${item.id}`.toLowerCase().includes(query.toLowerCase()));
  const myCases = cases.filter((item) => item.assigned_vet_id === vet?.id);
  const redFlagCases = cases.filter((item) => item.priority === 'red_flag');

  const updateCase = (updated: Case) => setCases((previous) => previous.map((item) => item.id === updated.id ? updated : item));
  const openCase = (id: string) => {
    setSelectedId(id);
    setQueueView('detail');
    setActiveNav('queue');
  };
  const openTreatment = (id: string) => { setTrackerSelectedId(id); setReportCaseId(null); setActiveNav('in_progress') }
  const assignAndOpenTreatment = async (id: string) => { const updated = await api.assignCase(id); updateCase(updated); openTreatment(id) }
  const trackerCase = inProgressCases.find((item) => item.id === trackerSelectedId) ?? null
  const saveStep = async (payload: { step_number: number; step_name: string; notes: string }) => {
    if (!trackerSelectedId) return
    const saved = await api.saveTreatmentStep(trackerSelectedId, payload)
    setTreatmentSteps((previous) => {
      const next = previous.map((step) => step.step_number === saved.step_number ? saved : step)
      setTreatmentProgress((current) => ({ ...current, [trackerSelectedId]: next.filter((step) => step.completed_at).length }))
      return next
    })
  }
  const saveDiagnosis = async (payload: { confirmed_diagnosis: string; notes: string }) => {
    if (trackerSelectedId) setDiagnosis(await api.saveDiagnosis(trackerSelectedId, payload))
  }
  const closeAndRefresh = async (id: string) => { updateCase(await api.closeCase(id)); setReportCaseId(null); setActiveNav('in_progress') }

  if (!vet) return <LoginScreen onLogin={setVet} error={loginError} setError={setLoginError} />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src={logoAsset} alt="पशु Rakshak Official Logo" className="brand-logo" />
          <div className="brand-text">
            <strong>पशु<span className="brand-accent">Rakshak</span></strong>
            <small>LIVESTOCK HEALTH</small>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {navItems.map(({ key, label, icon: Icon }) => (
            <a className={activeNav === key ? 'active' : ''} href={`#${key}`} key={key} onClick={(event) => { event.preventDefault(); setActiveNav(key) }}>
              <Icon size={16} />
              {label}
              {key === 'queue' && <b>{cases.length}</b>}
              {key === 'in_progress' && <b>{inProgressCases.length}</b>}
              {key === 'patients' && myCases.length > 0 && <b>{myCases.length}</b>}
            </a>
          ))}
          <a className={activeNav === 'settings' ? 'active' : ''} href="#settings" onClick={(event) => { event.preventDefault(); setActiveNav('settings') }}>
            <SettingsIcon size={16} />
            Settings
          </a>
        </nav>
        <div className="sidebar-footer">
          <span className="sync-dot" />
          All systems synced
          <div className="profile">
            <div className="avatar">{initials(vet.name)}</div>
            <div>
              <strong>{vet.name}</strong>
              <small>{vet.region.toUpperCase()}</small>
            </div>
            <ChevronDown size={14} />
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">SATURDAY, 05 SEPTEMBER 2026</span>
            <h1>Good morning, {vet.name.split(' ')[1] ?? vet.name}</h1>
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Notifications"><Bell size={18} /><i /></button>
            <button className="user-chip"><span className="avatar">{initials(vet.name)}</span>{vet.name}<ChevronDown size={13} /></button>
          </div>
        </header>
        {loadError && <p className="empty-state">Couldn't reach the backend: {loadError}</p>}
        {activeNav === 'overview' && <Overview summary={summary} cases={cases} redFlags={redFlagCases} openCase={openCase} />}
        {activeNav === 'queue' && (
          <Queue
            cases={filteredCases}
            total={cases.length}
            selected={selectedCase}
            selectedId={selectedId}
            query={query}
            setQuery={setQuery}
            status={statusFilter}
            setStatus={setStatusFilter}
            queueView={queueView}
            setQueueView={setQueueView}
            similar={similarCases}
            similarLoading={similarLoading}
            onSelectRow={(id) => { setSelectedId(id); setQueueView('detail'); }}
            onAssign={assignAndOpenTreatment}
            onClose={(id) => api.closeCase(id).then(updateCase)}
          />
        )}
        {activeNav === 'in_progress' && !reportCaseId && (
          <InProgressView
            cases={inProgressCases}
            selectedId={trackerSelectedId}
            progress={treatmentProgress}
            onSelect={openTreatment}
            trackerCase={trackerCase}
            diagnosis={diagnosis}
            steps={treatmentSteps}
            loading={treatmentLoading}
            onSaveDiagnosis={saveDiagnosis}
            onSaveStep={saveStep}
            onGenerateReport={() => trackerCase && setReportCaseId(trackerCase.id)}
          />
        )}
        {activeNav === 'in_progress' && reportCaseId && trackerCase && diagnosis && (
          <ReportView item={trackerCase} diagnosis={diagnosis} steps={treatmentSteps} vet={vet} onBack={() => setReportCaseId(null)} onCloseAndSend={() => closeAndRefresh(trackerCase.id)} />
        )}
        {activeNav === 'patients' && <Patients cases={myCases} openCase={openCase} />}
        {activeNav === 'team' && <Team team={team} loading={teamLoading} currentVet={vet.id} />}
        {activeNav === 'settings' && <Settings vet={vet} logout={() => setVet(null)} />}
      </main>
    </div>
  )
}

function InProgressView({ cases, selectedId, progress, onSelect, trackerCase, diagnosis, steps, loading, onSaveDiagnosis, onSaveStep, onGenerateReport }: { cases: Case[]; selectedId: string | null; progress: Record<string, number>; onSelect: (id: string) => void; trackerCase: Case | null; diagnosis: Diagnosis | null; steps: TreatmentStep[]; loading: boolean; onSaveDiagnosis: (payload: { confirmed_diagnosis: string; notes: string }) => Promise<void>; onSaveStep: (payload: { step_number: number; step_name: string; notes: string }) => Promise<void>; onGenerateReport: () => void }) {
  return (
    <>
      <div className="workspace-head">
        <div>
          <span className="eyebrow">ACTIVE TREATMENT REGISTER</span>
          <h2>In progress <span>{cases.length} assigned case(s)</span></h2>
        </div>
      </div>
      <div className="queue-layout treatment-layout">
        <Table>
          <div className="table-labels"><span>SPECIES / VILLAGE</span><span>PRIORITY</span><span>STATUS</span><span>TREATMENT</span></div>
          {cases.map((item) => (
            <button className={`case-row ${item.priority === 'red_flag' ? 'red-row' : ''} ${item.id === selectedId ? 'selected' : ''}`} key={item.id} onClick={() => onSelect(item.id)}>
              <span><strong>{item.species} · {item.village}</strong><small>{item.id} · assigned {timeAgo(item.created_at)}</small></span>
              <span><i className={`priority-dot ${item.priority}`} />{priorityLabel(item.priority)}</span>
              <span className="status status-in_progress">In progress</span>
              <small>{progress[item.id] ?? 0} of 4 steps complete</small>
            </button>
          ))}
          {!cases.length && <p className="empty-state">No active treatment cases assigned to you.</p>}
        </Table>
        {trackerCase && <TreatmentTracker item={trackerCase} diagnosis={diagnosis} steps={steps} loading={loading} onSaveDiagnosis={onSaveDiagnosis} onSaveStep={onSaveStep} onGenerateReport={onGenerateReport} />}
      </div>
    </>
  )
}

function TreatmentTracker({ item, diagnosis, steps, loading, onSaveDiagnosis, onSaveStep, onGenerateReport }: { item: Case; diagnosis: Diagnosis | null; steps: TreatmentStep[]; loading: boolean; onSaveDiagnosis: (payload: { confirmed_diagnosis: string; notes: string }) => Promise<void>; onSaveStep: (payload: { step_number: number; step_name: string; notes: string }) => Promise<void>; onGenerateReport: () => void }) {
  const completed = steps.filter((step) => step.completed_at).length
  return (
    <aside className="detail-panel treatment-panel">
      <div className="detail-header">
        <div>
          <span className="eyebrow">TREATMENT TRACKER</span>
          <h2>{item.species} — {item.village}</h2>
          <p className="case-id">{item.id} · {completed} of 4 steps complete</p>
        </div>
        <span className="status status-in_progress">In progress</span>
      </div>
      <section className="detail-section">
        <h3>Case summary</h3>
        <p className="symptom-copy">{item.symptoms}</p>
        <div className="meta-grid">
          <div><small>Herd size</small><strong>{item.herd_size} head</strong></div>
          <div><small>Affected / mortality</small><strong>{item.affected_count} / {item.mortality_count}</strong></div>
          <div><small>Location</small><strong>{item.village}, {item.district}</strong></div>
          <div><small>Vaccination</small><strong>{item.vaccination_status}</strong></div>
        </div>
      </section>
      {loading ? (
        <p className="empty-state">Loading treatment record...</p>
      ) : (
        <>
          <DiagnosisPanel diagnosis={diagnosis} onSave={onSaveDiagnosis} />
          <section className="detail-section">
            <div className="section-heading">
              <h3>Treatment sequence</h3>
              <span>Complete steps in order</span>
            </div>
            
            <div className="step-stepper-bar">
              {['1. Exam', '2. Diagnostic', '3. Treatment', '4. Follow-up'].map((label, idx) => (
                <div key={label} className={`stepper-node ${idx < completed ? 'completed' : idx === completed ? 'current' : ''}`}>
                  <span className="stepper-circle">{idx < completed ? '✓' : idx + 1}</span>
                  <span className="stepper-label">{label.split('. ')[1]}</span>
                  {idx < 3 && <ArrowRight size={12} className="stepper-arrow" />}
                </div>
              ))}
            </div>

            <div className="step-list">
              {steps.map((step, index) => (
                <TreatmentStepEditor key={step.step_number} step={step} locked={index > 0 && !steps[index - 1]?.completed_at} onSave={onSaveStep} />
              ))}
            </div>
          </section>
          <div className="detail-actions">
            <button className="primary-button" disabled={completed < 4} title={completed < 4 ? 'Complete all four treatment steps before generating the report.' : undefined} onClick={onGenerateReport}>
              <FileText size={14} /> Generate report
            </button>
          </div>
        </>
      )}
    </aside>
  )
}

function DiagnosisPanel({ diagnosis, onSave }: { diagnosis: Diagnosis | null; onSave: (payload: { confirmed_diagnosis: string; notes: string }) => Promise<void> }) {
  const [editing, setEditing] = useState(!diagnosis);
  const [confirmed, setConfirmed] = useState(diagnosis?.confirmed_diagnosis ?? '');
  const [notes, setNotes] = useState(diagnosis?.notes ?? '');
  useEffect(() => { setConfirmed(diagnosis?.confirmed_diagnosis ?? ''); setNotes(diagnosis?.notes ?? ''); setEditing(!diagnosis) }, [diagnosis])
  if (diagnosis && !editing) return (
    <section className="detail-section">
      <div className="section-heading">
        <h3>Diagnosis</h3>
        <button className="text-button" onClick={() => setEditing(true)}>Edit</button>
      </div>
      <div className="audit-grid">
        <div><small>AI suggestion</small><strong>{diagnosis.ai_suggested_diagnosis}</strong></div>
        <div><small>Vet-confirmed</small><strong>{diagnosis.confirmed_diagnosis}</strong></div>
      </div>
      <p className="record-note">{diagnosis.notes || 'No additional notes recorded.'}</p>
    </section>
  )
  return (
    <section className="detail-section">
      <h3>Diagnosis</h3>
      <div className="form-fields compact-fields">
        <label className="field-group">
          <span className="field-label">Confirmed diagnosis</span>
          <input value={confirmed} onChange={(event) => setConfirmed(event.target.value)} placeholder="Enter clinical diagnosis" />
        </label>
        <label className="field-group">
          <span className="field-label">Clinical notes</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Document the supporting findings" rows={3} />
        </label>
        <button className="secondary-button" disabled={!confirmed.trim()} onClick={async () => { await onSave({ confirmed_diagnosis: confirmed, notes }); setEditing(false) }}>
          {diagnosis ? 'Save changes' : 'Save diagnosis'}
        </button>
      </div>
    </section>
  )
}

function TreatmentStepEditor({ step, locked, onSave }: { step: TreatmentStep; locked: boolean; onSave: (payload: { step_number: number; step_name: string; notes: string }) => Promise<void> }) {
  const [editing, setEditing] = useState(!step.completed_at);
  const [notes, setNotes] = useState(step.notes);
  const complete = Boolean(step.completed_at);
  useEffect(() => { setNotes(step.notes); setEditing(!step.completed_at) }, [step])
  return (
    <article className={`treatment-step ${complete ? 'complete' : ''} ${locked ? 'locked' : ''}`}>
      <div className="step-marker">
        {complete ? <CheckCircle2 size={16} /> : <span className="step-num">{step.step_number}</span>}
      </div>
      <div className="step-content">
        <div className="step-heading">
          <div>
            <strong>{step.step_name}</strong>
            <small>{complete ? `Completed ${new Date(step.completed_at as string).toLocaleString()}` : locked ? 'Complete previous step first' : 'Pending documentation'}</small>
          </div>
          {complete && <button className="text-button" onClick={() => setEditing(true)}>Edit</button>}
        </div>
        {editing && !locked ? (
          <>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add treatment notes" rows={2} />
            <button className="secondary-button" onClick={async () => { await onSave({ step_number: step.step_number, step_name: step.step_name, notes }); setEditing(false) }}>
              Mark complete
            </button>
          </>
        ) : (
          <p className="record-note">{step.notes || 'No notes recorded.'}</p>
        )}
      </div>
    </article>
  )
}

function ReportView({ item, diagnosis, steps, vet, onBack, onCloseAndSend }: { item: Case; diagnosis: Diagnosis; steps: TreatmentStep[]; vet: Vet; onBack: () => void; onCloseAndSend: () => Promise<void> }) {
  const [sent, setSent] = useState(false)
  return (
    <div className="report-screen">
      <div className="report-actions">
        <button className="secondary-button" onClick={onBack}>Back to treatment</button>
        <div>
          <button className="secondary-button" onClick={() => window.print()}><FileText size={14} /> Download / Print</button>
          <button className="primary-button" disabled={sent} onClick={async () => { await onCloseAndSend(); setSent(true) }}>
            {sent ? 'Report submitted' : 'Send to district office'}
          </button>
        </div>
      </div>
      <article className="official-report">
        <header className="report-letterhead">
          <img src={logoAsset} alt="पशु Rakshak shield" />
          <div>
            <strong>पशु<span className="brand-accent">Rakshak</span></strong>
            <h1>Maharashtra Livestock Register</h1>
            <small>District treatment completion report</small>
          </div>
          <div className="report-reference">
            <strong>{item.id}</strong>
            <span>{new Date().toLocaleDateString()}</span>
          </div>
        </header>
        {sent && <p className="success-banner">Report submitted for district review. Government system integration is active in prototype mode.</p>}
        <div className="report-title">
          <span className="eyebrow">OFFICIAL CASE REPORT</span>
          <h2>{item.species} case — {item.village}, {item.district}</h2>
        </div>
        {item.priority === 'red_flag' && (
          <div className="report-escalation">
            <HeartPulse size={16} /> Red-flag protocol: this case was flagged for district-level visibility.
          </div>
        )}
        <ReportSection title="Case particulars">
          <div className="report-grid">
            <ReportField label="Case ID" value={item.id} />
            <ReportField label="Date reported" value={new Date(item.created_at).toLocaleString()} />
            <ReportField label="Date treated" value={new Date().toLocaleDateString()} />
            <ReportField label="Village / district" value={`${item.village}, ${item.district}`} />
            <ReportField label="Species" value={item.species} />
            <ReportField label="Herd size" value={`${item.herd_size} head`} />
            <ReportField label="Affected / mortality" value={`${item.affected_count} / ${item.mortality_count}`} />
            <ReportField label="Vaccination status" value={item.vaccination_status} />
          </div>
        </ReportSection>
        <ReportSection title="Clinical presentation">
          <p>{item.symptoms}</p>
        </ReportSection>
        <ReportSection title="Diagnosis audit trail">
          <div className="report-grid">
            <ReportField label="AI-suggested diagnosis" value={diagnosis.ai_suggested_diagnosis} />
            <ReportField label="Vet-confirmed diagnosis" value={diagnosis.confirmed_diagnosis} />
          </div>
          <p>{diagnosis.notes || 'No additional diagnosis notes.'}</p>
        </ReportSection>
        <ReportSection title="Treatment record">
          <div className="report-steps">
            {steps.map((step) => (
              <div key={step.step_number}>
                <strong>{step.step_number}. {step.step_name}</strong>
                <span>{step.notes || 'No notes recorded.'}</span>
                <small>{step.completed_at ? new Date(step.completed_at).toLocaleString() : 'Incomplete'}</small>
              </div>
            ))}
          </div>
        </ReportSection>
        <ReportSection title="Assigned veterinarian">
          <ReportField label="Officer" value={`${vet.name} (${vet.id})`} />
        </ReportSection>
      </article>
    </div>
  )
}

function ReportSection({ title, children }: { title: string; children: ReactNode }) { return <section className="report-section"><span className="eyebrow">{title}</span>{children}</section> }
function ReportField({ label, value }: { label: string; value: string }) { return <div><small>{label}</small><strong>{value}</strong></div> }

function TableRows({ cases, selectedId, onSelect }: { cases: Case[]; selectedId?: string | null; onSelect: (id: string) => void }) {
  return (
    <>
      {cases.map((item) => (
        <button className={`case-row ${item.priority === 'red_flag' ? 'red-row' : ''} ${item.id === selectedId ? 'selected' : ''}`} key={item.id} onClick={() => onSelect(item.id)}>
          <span>
            <strong>{item.species} · {item.village}</strong>
            <small>{item.reported_by} · {item.id}</small>
          </span>
          <span>
            <i className={`priority-dot ${item.priority}`} />
            {priorityLabel(item.priority)}
          </span>
          <span className={`status status-${item.status}`}>{statusLabel(item.status)}</span>
          <small>{timeAgo(item.created_at)}</small>
        </button>
      ))}
    </>
  )
}

function Table({ children }: { children: ReactNode }) {
  return (
    <section className="queue-panel full-width-table">
      <div className="table-labels">
        <span>SPECIES / REPORTER</span>
        <span>PRIORITY</span>
        <span>STATUS</span>
        <span>REPORTED</span>
      </div>
      {children}
    </section>
  )
}

function Overview({ summary, cases, redFlags, openCase }: { summary: DashboardSummary | null; cases: Case[]; redFlags: Case[]; openCase: (id: string) => void }) {
  return (
    <>
      <section className="summary-grid" aria-label="Case summary">
        <SummaryCard icon={<ClipboardList />} label="Open cases" value={String(summary?.total ?? cases.length)} detail="Live register" tag="30,513 TOTAL REPORTED" tone="green" isPrimary />
        <SummaryCard icon={<HeartPulse />} label="Red-flag cases" value={String(summary?.by_priority.red_flag ?? redFlags.length)} detail="Immediate review" tag="HIGH PRIORITY" tone="red" />
        <SummaryCard icon={<CheckCircle2 />} label="Closed cases" value={String(summary?.by_status.closed ?? 0)} detail="Verified & resolved" tag="TREATED" tone="green" />
        <SummaryCard icon={<Stethoscope />} label="In progress" value={String(summary?.by_status.in_progress ?? 0)} detail="Active treatment" tag="ONGOING" tone="yellow" />
      </section>
      <div className="workspace-head">
        <div>
          <span className="eyebrow">URGENT REGISTRY ACTIONS</span>
          <h2>Red-flag cases <span>{redFlags.length} open</span></h2>
        </div>
      </div>
      <Table>
        <TableRows cases={redFlags} onSelect={openCase} />
        {!redFlags.length && <p className="empty-state">No red-flag cases right now.</p>}
      </Table>
    </>
  )
}

function Queue({
  cases,
  total,
  selected,
  selectedId,
  query,
  setQuery,
  status,
  setStatus,
  queueView,
  setQueueView,
  similar,
  similarLoading,
  onSelectRow,
  onAssign,
  onClose,
}: {
  cases: Case[];
  total: number;
  selected: Case | null;
  selectedId: string | null;
  query: string;
  setQuery: (value: string) => void;
  status: '' | CaseStatus;
  setStatus: (value: '' | CaseStatus) => void;
  queueView: QueueViewMode;
  setQueueView: (view: QueueViewMode) => void;
  similar: SimilarCase[];
  similarLoading: boolean;
  onSelectRow: (id: string) => void;
  onAssign: (id: string) => void;
  onClose: (id: string) => void;
}) {
  if (queueView === 'detail' && selected) {
    return (
      <FullPageDetail
        item={selected}
        similar={similar}
        loading={similarLoading}
        onBack={() => setQueueView('list')}
        onAssign={() => onAssign(selected.id)}
        onClose={() => onClose(selected.id)}
      />
    )
  }

  return (
    <>
      <div className="workspace-head">
        <div>
          <span className="eyebrow">SURVEILLANCE REGISTER</span>
          <h2>Case queue <span>{cases.length} of {total} shown</span></h2>
        </div>
        <button className="primary-button"><FileText size={14} /> New case</button>
      </div>
      <div className="full-width-queue-layout">
        <Table>
          <div className="filters">
            <label className="search-box">
              <Search size={14} />
              <input aria-label="Search cases" placeholder="Search species, reporter or case ID" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <select aria-label="Filter cases" value={status} onChange={(event) => setStatus(event.target.value as '' | CaseStatus)}>
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button className="filter-button"><ShieldCheck size={14} /> Filters</button>
          </div>
          <TableRows cases={cases} selectedId={selectedId} onSelect={onSelectRow} />
          {!cases.length && <p className="empty-state">No cases match this search.</p>}
        </Table>
      </div>
    </>
  )
}

function FullPageDetail({
  item,
  similar,
  loading,
  onBack,
  onAssign,
  onClose,
}: {
  item: Case;
  similar: SimilarCase[];
  loading: boolean;
  onBack: () => void;
  onAssign: () => void;
  onClose: () => void;
}) {
  return (
    <div className="full-page-detail">
      <div className="detail-page-nav">
        <button className="secondary-button back-btn" onClick={onBack}>
          <ArrowLeft size={14} /> Back to case queue
        </button>
      </div>

      <article className="detail-page-card">
        <div className="detail-header full-detail-header">
          <div>
            <div className="header-badges">
              <span className="eyebrow">SELECTED CASE RECORD</span>
              <span className={`status status-${item.status}`}>{statusLabel(item.status)}</span>
              <span className={`status priority-pill ${item.priority === 'red_flag' ? 'status-new' : item.priority === 'high' ? 'status-assigned' : 'status-closed'}`}>
                {priorityLabel(item.priority)}
              </span>
            </div>
            <h2>{item.species} — {item.village}</h2>
            <p className="case-id">{item.id} · Reported {timeAgo(item.created_at)}</p>
          </div>
          <div className="detail-header-actions">
            <button className="secondary-button" onClick={onAssign} disabled={item.status !== 'new'}>
              <Users size={14} /> Assign to me
            </button>
            <button className="primary-button" onClick={onClose} disabled={item.status === 'closed'}>
              <CheckCircle2 size={14} /> Close case
            </button>
          </div>
        </div>

        <div className={`alert-banner ${item.priority === 'red_flag' ? 'alert-red' : ''}`}>
          <HeartPulse size={16} />
          <div>
            <strong>
              {item.priority === 'red_flag'
                ? 'Red-flag: Immediate intervention required'
                : item.priority === 'high'
                ? 'High priority case review'
                : 'Routine clinical record'}
            </strong>
            <p>AI triage rules flagged this case as {priorityLabel(item.priority).toLowerCase()} priority.</p>
          </div>
        </div>

        <section className="detail-section">
          <h3>Reported symptoms & clinical presentation</h3>
          <p className="symptom-copy full-symptom-copy">{item.symptoms}</p>
          
          <div className="meta-grid full-meta-grid">
            <div><small>Herd size</small><strong>{item.herd_size} head</strong></div>
            <div><small>Affected animals</small><strong>{item.affected_count} animals</strong></div>
            <div><small>Mortality count</small><strong>{item.mortality_count} animals</strong></div>
            <div><small>Vaccination status</small><strong>{item.vaccination_status}</strong></div>
            <div><small>Reported by</small><strong>{item.reported_by}</strong></div>
            <div><small>Location / District</small><strong>{item.village}, {item.district}</strong></div>
          </div>
        </section>

        <section className="detail-section">
          <div className="section-heading">
            <h3>Similar historical cases</h3>
            <span>{similar.length} matches found</span>
          </div>
          {loading && <p className="empty-state">Searching historical database...</p>}
          {!loading && (
            <div className="similar-cases-grid">
              {similar.map((match, idx) => (
                <div className="similar-case-card" key={match.id} style={{ '--idx': idx } as React.CSSProperties}>
                  <div className="similar-card-top">
                    <b className="match-score">{Math.round(match.similarity_score * 100)}% match</b>
                    <strong>{match.confirmed_diagnosis}</strong>
                  </div>
                  <p>{match.treatment_summary}</p>
                  <small>{match.outcome}</small>
                </div>
              ))}
            </div>
          )}
          {!loading && !similar.length && <p className="empty-state">No similar historical cases found.</p>}
        </section>

        <div className="detail-actions full-page-actions">
          <button className="secondary-button" onClick={onAssign} disabled={item.status !== 'new'}>
            <Users size={14} /> Assign to me
          </button>
          <button className="primary-button" onClick={onClose} disabled={item.status === 'closed'}>
            <CheckCircle2 size={14} /> Close case
          </button>
        </div>
      </article>
    </div>
  )
}

function Patients({ cases, openCase }: { cases: Case[]; openCase: (id: string) => void }) {
  return (
    <>
      <div className="workspace-head">
        <div>
          <span className="eyebrow">ASSIGNED TO YOU</span>
          <h2>My patients <span>{cases.length} case(s)</span></h2>
        </div>
      </div>
      <Table>
        <TableRows cases={cases} onSelect={openCase} />
        {!cases.length && <p className="empty-state">No cases assigned to you yet - assign one from the case queue.</p>}
      </Table>
    </>
  )
}

function Team({ team, loading, currentVet }: { team: Vet[]; loading: boolean; currentVet: string }) {
  return (
    <>
      <div className="workspace-head">
        <div>
          <span className="eyebrow">DIRECTORY</span>
          <h2>Team</h2>
        </div>
      </div>
      <section className="summary-grid">
        {loading && <p className="empty-state">Loading team...</p>}
        {!loading && team.map((member) => (
          <article className="summary-card" key={member.id}>
            <span className="card-icon"><Users /></span>
            <p>{member.name}{member.id === currentVet ? ' (you)' : ''}</p>
            <strong>{member.region}</strong>
            <small>Veterinarian</small>
          </article>
        ))}
        {!loading && !team.length && <p className="empty-state">Couldn't load the team directory.</p>}
      </section>
    </>
  )
}

function Settings({ vet, logout }: { vet: Vet; logout: () => void }) {
  return (
    <>
      <div className="workspace-head">
        <div>
          <span className="eyebrow">ACCOUNT & SYSTEM</span>
          <h2>Settings</h2>
        </div>
      </div>
      <section className="detail-panel settings-card" style={{ maxWidth: 460 }}>
        <div className="detail-section">
          <h3>Officer Profile</h3>
          <div className="meta-grid">
            <div><small>Officer Name</small><strong>{vet.name}</strong></div>
            <div><small>Assigned District</small><strong>{vet.region}</strong></div>
            <div><small>Officer ID</small><strong>{vet.id}</strong></div>
            <div><small>Surveillance Server</small><strong>{import.meta.env.VITE_API_URL || 'http://localhost:8000'}</strong></div>
          </div>
        </div>
        <div className="detail-actions">
          <button className="secondary-button" onClick={logout}><LogOut size={13} /> Log out</button>
        </div>
      </section>
    </>
  )
}

function LoginScreen({ onLogin, error, setError }: { onLogin: (vet: Vet) => void; error: string; setError: (error: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      onLogin((await api.login(email, password)).vet)
    } catch {
      setError('Invalid credentials')
    }
  };
  return (
    <div className="login-shell">
      <form onSubmit={submit} className="login-card">
        <div className="login-brand">
          <img src={logoAsset} alt="पशु Rakshak Logo" className="login-logo" />
          <h1>पशु<span className="brand-accent">Rakshak</span></h1>
          <p className="login-subtitle">District Livestock Health Surveillance System</p>
          <small className="login-jurisdiction">Government of Maharashtra · Department of Animal Husbandry</small>
        </div>
        <div className="form-fields">
          <label className="field-group">
            <span className="field-label">Veterinary Officer Email</span>
            <input placeholder="email@pashurakshak.in" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="field-group">
            <span className="field-label">Password</span>
            <input placeholder="••••••••" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <p className="empty-state error-banner">{error}</p>}
          <button className="primary-button login-btn" type="submit">Log in to Case Register</button>
        </div>
        <div className="demo-accounts-section">
          <span className="eyebrow">DEMO OFFICER ACCOUNTS</span>
          <div className="demo-buttons">
            {demoAccounts.map((account) => (
              <button type="button" key={account.email} className="secondary-button demo-btn" onClick={() => { setEmail(account.email); setPassword(account.password) }}>
                <strong>{account.label}</strong>
                <small>{account.email}</small>
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  )
}

function SummaryCard({ icon, label, value, detail, tag, isPrimary }: { icon: ReactNode; label: string; value: string; detail: string; tag?: string; tone?: string; isPrimary?: boolean }) {
  return (
    <article className={`summary-card ${isPrimary ? 'primary-stat' : ''}`}>
      <div className="stat-top">
        <p>{label}</p>
        <span className="card-icon">{icon}</span>
      </div>
      <strong className="stat-number">{value}</strong>
      <div className="stat-bottom">
        <small>{detail}</small>
        {tag && <span className="stat-pill-tag">{tag}</span>}
      </div>
    </article>
  )
}

export default App