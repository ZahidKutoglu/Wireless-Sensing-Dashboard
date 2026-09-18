from __future__ import annotations

import asyncio
import os
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Deque, Dict, List, Optional, Set

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .detector import AnomalyDetector
from .schemas import (
    Incident,
    InjectRequest,
    InjectResponse,
    SystemStatus,
    TelemetryFrame,
    TelemetryHistory,
)
from .simulator import INJECTION_LABELS, ISACSimulator

ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = ROOT / "models" / "model.pkl"
SERVERLESS = os.getenv("VERCEL") == "1" or os.getenv("ISAC_SERVERLESS") == "1"

simulator = ISACSimulator(seed=7)
detector: AnomalyDetector
if MODEL_PATH.exists():
    try:
        detector = AnomalyDetector.load(MODEL_PATH)
    except Exception:
        detector = AnomalyDetector()
else:
    detector = AnomalyDetector()

frame_buffer: Deque[TelemetryFrame] = deque(maxlen=360)
incident_buffer: Deque[Incident] = deque(maxlen=250)
subscribers: Set[WebSocket] = set()
started_at = time.time()
last_status = "NORMAL"
last_score = 0.0
_engine_task: Optional[asyncio.Task] = None
_lock = asyncio.Lock()
_last_tick = time.time()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _summarize(classification: str, frame: Dict, score: float) -> str:
    return (
        f"{classification.replace('_', ' ')} · score {score:.2f} · "
        f"SNR {frame['snr_db']:.1f} dB · BER {frame['ber']:.2e} · "
        f"R={frame['target_distance_m']:.0f} m · {frame['throughput_mbps']:.1f} Mbps"
    )


def _ts_epoch(ts: str) -> float:
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()


def score_raw_frame(raw: Dict) -> TelemetryFrame:
    global last_status, last_score
    score, status, classification, confidence, verified = detector.evaluate(raw)
    last_status = status
    last_score = score
    payload = {
        **raw,
        "timestamp": _now_iso(),
        "anomaly_score": round(score, 4),
        "status": status,
        "classification": classification,
        "verified": verified,
        "model_confidence": round(confidence, 4),
    }
    frame = TelemetryFrame.model_validate(payload)
    frame_buffer.append(frame)

    noteworthy = status == "ANOMALY" or (
        status == "DEGRADED" and classification and classification != "UNCORRELATED_RF_EVENT"
    )
    if noteworthy and classification:
        incident = Incident(
            id=str(uuid.uuid4())[:8].upper(),
            timestamp=frame.timestamp,
            seq=frame.seq,
            classification=classification,
            anomaly_score=frame.anomaly_score,
            status=status,
            confidence=frame.model_confidence,
            verified=verified,
            summary=_summarize(classification, raw, score),
            metrics_snapshot={
                "snr_db": frame.snr_db,
                "ber": frame.ber,
                "throughput_mbps": frame.throughput_mbps,
                "rcs_dbsm": frame.rcs_dbsm,
                "target_distance_m": frame.target_distance_m,
                "target_velocity_mps": frame.target_velocity_mps,
            },
        )
        reuse = False
        if incident_buffer and incident_buffer[0].classification == classification:
            try:
                reuse = abs(_ts_epoch(frame.timestamp) - _ts_epoch(incident_buffer[0].timestamp)) <= 12
            except ValueError:
                reuse = True
        if reuse:
            keep_id = incident_buffer[0].id
            incident_buffer[0] = incident.model_copy(update={"id": keep_id})
        else:
            incident_buffer.appendleft(incident)
    return frame


def catch_up(max_steps: int = 8) -> None:
    """Advance the simulator when no background loop is running (Vercel)."""
    global _last_tick
    engine_live = _engine_task is not None and not _engine_task.done()
    if engine_live:
        return
    now = time.time()
    steps = int(now - _last_tick)
    if not frame_buffer:
        steps = max(steps, 3)
    steps = max(1, min(steps if steps > 0 else 1, max_steps))
    for _ in range(steps):
        score_raw_frame(simulator.step())
    _last_tick = now


async def broadcast(frame: TelemetryFrame) -> None:
    dead: List[WebSocket] = []
    message = frame.model_dump()
    for ws in list(subscribers):
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        subscribers.discard(ws)


async def telemetry_engine() -> None:
    while True:
        async with _lock:
            raw = simulator.step()
            frame = score_raw_frame(raw)
        await broadcast(frame)
        await asyncio.sleep(1.0)


app = FastAPI(
    title="ISAC Anomaly Detector",
    description="Integrated Sensing & Communications telemetry stream and ML anomaly scoring.",
    version="1.0.0",
)

cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins or ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup() -> None:
    global _engine_task, detector
    if MODEL_PATH.exists() and not detector.loaded:
        try:
            detector = AnomalyDetector.load(MODEL_PATH)
        except Exception:
            detector = AnomalyDetector()
    if SERVERLESS:
        catch_up(4)
    else:
        _engine_task = asyncio.create_task(telemetry_engine())


@app.on_event("shutdown")
async def on_shutdown() -> None:
    if _engine_task:
        _engine_task.cancel()


@app.get("/")
async def root() -> dict:
    return {
        "service": "ISAC Anomaly Detector",
        "health": "/health",
        "telemetry": "/api/isac/telemetry",
        "websocket": None if SERVERLESS else "/ws/telemetry",
        "serverless": SERVERLESS,
    }


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "model_loaded": detector.loaded, "model": detector.model_name}


@app.get("/api/isac/status", response_model=SystemStatus)
async def system_status() -> SystemStatus:
    async with _lock:
        catch_up()
    return SystemStatus(
        service="ISAC-ANOMALY-01",
        model_loaded=detector.loaded,
        model_name=detector.model_name,
        frames_emitted=simulator.seq,
        uptime_s=round(time.time() - started_at, 1),
        ws_clients=len(subscribers),
        last_status=last_status,  # type: ignore[arg-type]
        last_score=round(last_score, 4),
        active_injections=list({i.kind for i in simulator.injections}),
    )


@app.get("/api/isac/telemetry", response_model=TelemetryHistory)
async def get_telemetry(limit: int = Query(120, ge=1, le=360)) -> TelemetryHistory:
    async with _lock:
        catch_up()
        frames = list(frame_buffer)[-limit:]
    return TelemetryHistory(frames=frames, count=len(frames))


@app.get("/api/isac/incidents", response_model=List[Incident])
async def get_incidents(limit: int = Query(80, ge=1, le=250)) -> List[Incident]:
    async with _lock:
        catch_up()
        items = list(incident_buffer)[:limit]
    return items


@app.post("/api/isac/simulate", response_model=InjectResponse)
async def simulate_anomaly(req: InjectRequest) -> InjectResponse:
    if req.type not in INJECTION_LABELS:
        raise HTTPException(status_code=400, detail="Unknown injection type")
    async with _lock:
        simulator.inject(req.type, req.duration_s)
        catch_up(1)
    labels = {
        "rf_jamming": "Broadband RF jamming injected into sensing/comms chain",
        "signal_dropout": "Frame-drop / link-outage sequence armed",
        "target_ghosting": "False-target ghost track seeded in tracker",
        "multipath": "Multipath fading / range-walk injection armed",
    }
    return InjectResponse(
        accepted=True,
        type=req.type,
        duration_s=req.duration_s,
        message=labels[req.type],
    )


@app.websocket("/ws/telemetry")
async def ws_telemetry(ws: WebSocket) -> None:
    if SERVERLESS:
        await ws.close(code=1003)
        return
    await ws.accept()
    subscribers.add(ws)
    try:
        for frame in list(frame_buffer)[-20:]:
            await ws.send_json(frame.model_dump())
        while True:
            try:
                message = await asyncio.wait_for(ws.receive(), timeout=30.0)
            except asyncio.TimeoutError:
                await ws.send_json({"type": "ping"})
                continue
            if message.get("type") == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        subscribers.discard(ws)
