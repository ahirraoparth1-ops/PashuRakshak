from datetime import datetime, timedelta
from typing import Optional
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from services.ai_triage import apply_priority

app = FastAPI(title="PashuRakshak Vet API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

VETS = {
    "demo@pashurakshak.in": {"id": "vet-001", "name": "Dr. Riya Mehta", "password": "demo123", "region": "Anand"},
    "field@pashurakshak.in": {"id": "vet-002", "name": "Dr. Arjun Shah", "password": "demo123", "region": "Vadodara"},
    "admin@pashurakshak.in": {"id": "vet-003", "name": "Dr. Kavita Rao", "password": "demo123", "region": "Kheda"},
}

CASES = [
    {"id": "c-1048", "reported_by": "Ramesh Patel", "species": "Cattle", "herd_size": 48, "symptoms": "Fever, mouth blisters, excessive salivation and lameness in two animals.", "affected_count": 6, "mortality_count": 0, "vaccination_status": "Partial", "village": "Kheda", "district": "Anand", "latitude": 22.69, "longitude": 72.87, "season": "Monsoon", "status": "new", "priority": "red_flag", "assigned_vet_id": None, "created_at": "2026-09-05T09:12:00"},
    {"id": "c-1047", "reported_by": "Field Unit 04", "species": "Buffalo", "herd_size": 22, "symptoms": "High fever with firm nodules across the neck and back. Reduced appetite.", "affected_count": 3, "mortality_count": 0, "vaccination_status": "Up to date", "village": "Mota Fofaliya", "district": "Vadodara", "latitude": 22.31, "longitude": 73.14, "season": "Monsoon", "status": "in_progress", "priority": "high", "assigned_vet_id": "vet-001", "created_at": "2026-09-05T08:36:00"},
    {"id": "c-1046", "reported_by": "Meena Parmar", "species": "Goat", "herd_size": 31, "symptoms": "Watery diarrhoea, weakness and dehydration affecting young goats.", "affected_count": 8, "mortality_count": 1, "vaccination_status": "Unknown", "village": "Borsad", "district": "Anand", "latitude": 22.41, "longitude": 72.90, "season": "Monsoon", "status": "assigned", "priority": "normal", "assigned_vet_id": "vet-001", "created_at": "2026-09-05T07:22:00"},
    {"id": "c-1045", "reported_by": "Sanjay Solanki", "species": "Cattle", "herd_size": 17, "symptoms": "Coughing, nasal discharge and laboured breathing after weather change.", "affected_count": 4, "mortality_count": 0, "vaccination_status": "Up to date", "village": "Petlad", "district": "Anand", "latitude": 22.47, "longitude": 72.80, "season": "Monsoon", "status": "new", "priority": "high", "assigned_vet_id": None, "created_at": "2026-09-05T06:41:00"},
    {"id": "c-1044", "reported_by": "Shakti Farms", "species": "Poultry", "herd_size": 240, "symptoms": "Sudden mortality with respiratory distress across the shed.", "affected_count": 26, "mortality_count": 9, "vaccination_status": "Partial", "village": "Dabhoi", "district": "Vadodara", "latitude": 22.18, "longitude": 73.43, "season": "Monsoon", "status": "in_progress", "priority": "red_flag", "assigned_vet_id": "vet-001", "created_at": "2026-09-05T04:10:00"},
    {"id": "c-1043", "reported_by": "Nilesh Shah", "species": "Cattle", "herd_size": 14, "symptoms": "Mild fever and reduced milk yield for three days.", "affected_count": 2, "mortality_count": 0, "vaccination_status": "Up to date", "village": "Umreth", "district": "Anand", "latitude": 22.70, "longitude": 73.12, "season": "Winter", "status": "closed", "priority": "normal", "assigned_vet_id": "vet-001", "created_at": "2026-09-04T12:20:00"},
]

HISTORICAL = [
    {"id": "h-01", "species": "Cattle", "symptoms": "Fever mouth blisters salivation lameness", "season": "Monsoon", "region": "Kheda Gujarat", "confirmed_diagnosis": "Foot-and-mouth disease", "treatment_summary": "Isolation, supportive care, movement restriction", "outcome": "Recovered"},
    {"id": "h-02", "species": "Buffalo", "symptoms": "High fever firm nodules neck back reduced appetite", "season": "Monsoon", "region": "Anand Gujarat", "confirmed_diagnosis": "Lumpy skin disease", "treatment_summary": "Wound care and vector control", "outcome": "Recovered after 14 days"},
    {"id": "h-03", "species": "Cattle", "symptoms": "Coughing nasal discharge laboured breathing", "season": "Winter", "region": "Vadodara Gujarat", "confirmed_diagnosis": "Bovine respiratory disease", "treatment_summary": "Antibiotics and hydration", "outcome": "Recovered"},
    {"id": "h-04", "species": "Poultry", "symptoms": "Sudden mortality respiratory distress", "season": "Monsoon", "region": "Vadodara Gujarat", "confirmed_diagnosis": "Avian influenza suspected", "treatment_summary": "Quarantine and district lab testing", "outcome": "Contained"},
    {"id": "h-05", "species": "Goat", "symptoms": "Watery diarrhoea weakness dehydration young goats", "season": "Monsoon", "region": "Anand Gujarat", "confirmed_diagnosis": "Enteric infection", "treatment_summary": "Oral rehydration and observation", "outcome": "Recovered"},
]

DIAGNOSES: dict[str, dict] = {}
TREATMENT_STEPS: dict[str, list[dict]] = {}

class LoginRequest(BaseModel):
    email: str
    password: str

class DiagnosisRequest(BaseModel):
    confirmed_diagnosis: str
    notes: str = ""

class TreatmentStepRequest(BaseModel):
    step_number: int
    step_name: str
    notes: str = ""
    proof_url: Optional[str] = None

class LabRequest(BaseModel):
    status: str = "requested"
    report_url: Optional[str] = None


def find_case(case_id: str):
    case = next((item for item in CASES if item["id"] == case_id), None)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case

@app.get("/health")
def health():
    return {"status": "ok", "service": "pashurakshak-vet-api"}

@app.post("/auth/login")
def login(payload: LoginRequest):
    vet = VETS.get(payload.email)
    if not vet or vet["password"] != payload.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"access_token": f"demo-token-{vet['id']}", "token_type": "bearer", "vet": {key: value for key, value in vet.items() if key != "password"}}

@app.get("/vets")
def list_vets():
    return [{"id": vet["id"], "name": vet["name"], "region": vet["region"]} for vet in VETS.values()]

@app.get("/cases")
def list_cases(status: Optional[str] = None, priority: Optional[str] = None, assigned_vet_id: Optional[str] = None, region: Optional[str] = None):
    result = CASES
    if status:
        result = [item for item in result if item["status"] == status]
    if priority:
        result = [item for item in result if item["priority"] == priority]
    if assigned_vet_id:
        result = [item for item in result if item["assigned_vet_id"] == assigned_vet_id]
    if region:
        result = [item for item in result if item["district"].lower() == region.lower()]
    return result

@app.get("/cases/{case_id}")
def get_case(case_id: str):
    return find_case(case_id)

@app.post("/cases/{case_id}/assign")
def assign_case(case_id: str):
    case = find_case(case_id)
    case["assigned_vet_id"] = "vet-001"
    case["status"] = "in_progress"
    return case

@app.get("/cases/{case_id}/similar")
def similar_cases(case_id: str):
    case = find_case(case_id)
    corpus = [case["symptoms"]] + [item["symptoms"] for item in HISTORICAL]
    scores = cosine_similarity(TfidfVectorizer().fit_transform(corpus))[0][1:]
    ranked = sorted(zip(scores, HISTORICAL), key=lambda pair: pair[0], reverse=True)[:5]
    return [{**item, "similarity_score": round(float(score), 3)} for score, item in ranked]

@app.get("/cases/{case_id}/diagnosis")
def get_diagnosis(case_id: str):
    find_case(case_id)
    return DIAGNOSES.get(case_id)

@app.post("/cases/{case_id}/diagnosis")
def save_diagnosis(case_id: str, payload: DiagnosisRequest):
    find_case(case_id)
    record = {"case_id": case_id, "vet_id": "vet-001", "ai_suggested_diagnosis": "Foot-and-mouth disease", **payload.model_dump(), "created_at": datetime.utcnow().isoformat()}
    DIAGNOSES[case_id] = record
    return record

@app.get("/cases/{case_id}/treatment-steps")
def get_treatment_steps(case_id: str):
    find_case(case_id)
    if case_id not in TREATMENT_STEPS:
        TREATMENT_STEPS[case_id] = [{"step_number": number, "step_name": name, "notes": "", "proof_url": None, "completed_at": None} for number, name in enumerate(("Examination", "Diagnostic", "Treatment", "Follow-up"), 1)]
    return TREATMENT_STEPS[case_id]

@app.post("/cases/{case_id}/treatment-steps")
def save_treatment_step(case_id: str, payload: TreatmentStepRequest):
    find_case(case_id)
    steps = TREATMENT_STEPS.setdefault(case_id, get_treatment_steps(case_id))
    updated = {**payload.model_dump(), "completed_at": datetime.utcnow().isoformat()}
    for index, step in enumerate(steps):
        if step["step_number"] == payload.step_number:
            steps[index] = updated
            break
    return updated

@app.post("/cases/{case_id}/lab-request")
def request_lab(case_id: str, payload: LabRequest = LabRequest()):
    find_case(case_id)
    return {"id": str(uuid4()), "case_id": case_id, "requested_at": datetime.utcnow().isoformat(), **payload.model_dump()}

@app.get("/cases/{case_id}/lab-request")
def get_lab_request(case_id: str):
    find_case(case_id)
    return {"case_id": case_id, "status": "requested", "requested_at": datetime.utcnow().isoformat(), "report_url": None}

@app.post("/cases/{case_id}/close")
def close_case(case_id: str):
    case = find_case(case_id)
    case["status"] = "closed"
    return case

@app.get("/hotspots")
def hotspots():
    return [{"name": "Anand cluster", "latitude": 22.56, "longitude": 72.95, "active_cases": 8, "risk": "high"}, {"name": "Vadodara cluster", "latitude": 22.31, "longitude": 73.18, "active_cases": 5, "risk": "medium"}]

@app.get("/dashboard/summary")
def dashboard_summary():
    return {"total": len(CASES), "by_status": {status: sum(case["status"] == status for case in CASES) for status in ("new", "assigned", "in_progress", "closed")}, "by_priority": {priority: sum(case["priority"] == priority for case in CASES) for priority in ("normal", "high", "red_flag")}}
