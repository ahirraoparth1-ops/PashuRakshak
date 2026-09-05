# PashuRakshak Vet Dashboard

A focused veterinarian console prototype for SIH Problem Statement 26128. The frontend is a Vite + React + TypeScript dashboard and the backend is a FastAPI service with seeded case data and a functional TF-IDF similarity endpoint.

## Run locally

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

The dashboard currently renders a seeded demo queue so it can be explored without a running API. The FastAPI service is ready at `http://localhost:8000`, with Swagger docs at `/docs`.

## Run with Docker

```powershell
docker compose up --build
```

Open `http://localhost:4173` for the frontend and `http://localhost:8000/docs` for the API.

Demo accounts: `demo@pashurakshak.in`, `field@pashurakshak.in`, and `admin@pashurakshak.in`, all with password `demo123`.

## Prototype boundaries

The red-flag rules and TF-IDF similarity search are real, explainable demo logic in the API. PostgreSQL/PostGIS schema, JWT-shaped login response, lab tracking, treatment steps, diagnoses, and hotspot seed endpoints are included for integration. The current frontend uses local demo data while the workflow is being prototyped; live DB persistence, map tiles, clustering, farmer reporting, messaging integrations, and model training are intentionally out of scope.
