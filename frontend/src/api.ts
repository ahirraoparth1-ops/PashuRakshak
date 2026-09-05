const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export type CaseStatus = 'new' | 'assigned' | 'in_progress' | 'closed'
export type CasePriority = 'normal' | 'high' | 'red_flag'

export type Case = {
  id: string
  reported_by: string
  species: string
  herd_size: number
  symptoms: string
  affected_count: number
  mortality_count: number
  vaccination_status: string
  village: string
  district: string
  latitude: number
  longitude: number
  season: string
  status: CaseStatus
  priority: CasePriority
  assigned_vet_id: string | null
  created_at: string
}

export type SimilarCase = {
  id: string
  species: string
  symptoms: string
  season: string
  region: string
  confirmed_diagnosis: string
  treatment_summary: string
  outcome: string
  similarity_score: number
}

export type Vet = {
  id: string
  name: string
  region: string
}

export type DashboardSummary = {
  total: number
  by_status: Record<CaseStatus, number>
  by_priority: Record<CasePriority, number>
}

export type Diagnosis = {
  case_id: string
  vet_id: string
  ai_suggested_diagnosis: string
  confirmed_diagnosis: string
  notes: string
  created_at: string
}

export type TreatmentStep = {
  step_number: number
  step_name: string
  notes: string
  proof_url: string | null
  completed_at: string | null
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API error ${res.status}: ${body}`)
  }
  return res.json()
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string; token_type: string; vet: Vet }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  getCases: (filters: Partial<{ status: CaseStatus; priority: CasePriority; assigned_vet_id: string; region: string }> = {}) => {
    const cleaned = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== '')) as Record<string, string>
    const params = new URLSearchParams(cleaned).toString()
    return request<Case[]>(`/cases${params ? `?${params}` : ''}`)
  },
  getSimilarCases: (caseId: string) => request<SimilarCase[]>(`/cases/${caseId}/similar`),
  getDiagnosis: (caseId: string) => request<Diagnosis | null>(`/cases/${caseId}/diagnosis`),
  saveDiagnosis: (caseId: string, payload: { confirmed_diagnosis: string; notes: string }) => request<Diagnosis>(`/cases/${caseId}/diagnosis`, { method: 'POST', body: JSON.stringify(payload) }),
  getTreatmentSteps: (caseId: string) => request<TreatmentStep[]>(`/cases/${caseId}/treatment-steps`),
  saveTreatmentStep: (caseId: string, payload: { step_number: number; step_name: string; notes: string; proof_url?: string | null }) => request<TreatmentStep>(`/cases/${caseId}/treatment-steps`, { method: 'POST', body: JSON.stringify(payload) }),
  assignCase: (caseId: string) => request<Case>(`/cases/${caseId}/assign`, { method: 'POST' }),
  closeCase: (caseId: string) => request<Case>(`/cases/${caseId}/close`, { method: 'POST' }),
  getSummary: () => request<DashboardSummary>('/dashboard/summary'),
  getVets: () => request<Vet[]>('/vets'),
}
