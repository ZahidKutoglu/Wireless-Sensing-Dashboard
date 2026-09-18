# ISAC Wireless Sensing Anomaly Detector

Real-time Integrated Sensing & Communications (ISAC) telemetry simulator with IsolationForest anomaly detection and a mission-control dashboard.

The backend generates correlated sensing/comms observables at 1 Hz, scores each frame with a pre-trained IsolationForest, and streams results over REST + WebSocket. The frontend is a mission-control telemetry console with live charts, a sensing track panel, an incident ledger, and injection controls.

## Architecture

```
frontend (Next.js 14, :3000)
    REST  /api/isac/*  →  FastAPI :8010
    WS    ws://localhost:8010/ws/telemetry
        │
backend (FastAPI, :8010)
    ISACSimulator  →  IsolationForest scorer  →  ring buffer + incident ledger
```

Telemetry features: target distance, velocity, RCS (dBsm), SNR (dB), packet throughput (Mbps), BER, plus derived signal quality and range-rate consistency used by the model.

## Quick start

Requires Python 3.9+ and Node 18+.

### 1. Train the model and run the API

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python train_model.py          # writes models/model.pkl
uvicorn app.main:app --host 0.0.0.0 --port 8010
```

### 2. Run the dashboard

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The Next.js app proxies `/api/isac/*` to the FastAPI server on port **8010**. Use the injection buttons to fire RF jamming, dropout, ghost tracks, or multipath.

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Liveness + model load state |
| GET | `/api/isac/status` | Uptime, WS clients, last score |
| GET | `/api/isac/telemetry?limit=120` | Historical frames |
| GET | `/api/isac/incidents?limit=80` | Anomaly ledger |
| POST | `/api/isac/simulate` | `{ "type": "rf_jamming" \| "signal_dropout" \| "target_ghosting" \| "multipath", "duration_s": 12 }` |
| WS | `/ws/telemetry` | 1 Hz scored frames |

Status flags: `NORMAL`, `DEGRADED`, `ANOMALY`. Scores are calibrated to `[0, 1]`.

## Repository layout

```
backend/
  app/            FastAPI app, simulator, detector
  train_model.py  IsolationForest training
  models/model.pkl
frontend/         Next.js 14 App Router dashboard
```

If `model.pkl` is missing the API still runs on a physics-residual heuristic until you train.

## Deploy on Vercel (two projects)

This repo is not a single Vercel app. Deploy **backend** first, then **frontend**.

Vercel Python is serverless: there is no always-on process and **WebSockets are not used in production**. The dashboard polls REST every second, which is enough for the live HUD.

### 1. Backend project

1. New Vercel project → Root Directory: `backend`
2. Framework: Other
3. Deploy. You should get a URL like `https://isac-api-xxxx.vercel.app`
4. Confirm `https://<backend>.vercel.app/health` returns `{"ok": true, ...}`

Optional env:
- `CORS_ORIGINS` — your frontend origin, e.g. `https://isac-app.vercel.app` (default is `*`)

### 2. Frontend project

1. New Vercel project → Root Directory: `frontend`
2. Framework: Next.js
3. Environment variable **must** be set:

| Name | Value |
| --- | --- |
| `ISAC_API_URL` | Backend origin, e.g. `https://isac-api-xxxx.vercel.app` (no trailing slash) |

Do **not** set `NEXT_PUBLIC_WS_URL` on Vercel. Local `.env.local` can keep it for `ws://127.0.0.1:8010`.

4. Deploy and open the frontend URL.

### Caveats

- Serverless instances do not share RAM. Fault injections work on the instance that handled the POST; a cold start can look like a short reset.
- `scikit-learn` + NumPy is a large Python function. If the backend build fails on package size, the API still runs with the built-in heuristic scorer.
- Local `uvicorn` is unchanged: background 1 Hz loop + WebSocket still run on your machine.
