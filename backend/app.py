"""
CyberHunt - Digital Treasure Hunt Platform
Hackathon Core Engine (FastAPI)
RYMEC Dept of ISE / INFOTSAV 2K26
"""

import os
import json
import time
import io
from typing import Dict, List, Optional, Any
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import qrcode

app = FastAPI(title="CyberHunt Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def vercel_path_normalizer(request: Request, call_next):
    import urllib.parse
    raw_qs = request.scope.get("query_string", b"").decode("utf-8", errors="ignore")
    params = urllib.parse.parse_qs(raw_qs)
    path_param = params.get("__path", [None])[0]

    if path_param:
        request.scope["path"] = f"/api/{path_param}" if not path_param.startswith("api/") else f"/{path_param}"
        # Clean __path from query_string
        filtered = {k: v for k, v in params.items() if k != "__path"}
        request.scope["query_string"] = urllib.parse.urlencode(filtered, doseq=True).encode("utf-8")
    else:
        matched = request.headers.get("x-matched-path") or request.headers.get("x-now-route-matches")
        if matched and matched.startswith("/api/"):
            request.scope["path"] = matched.split("?")[0]
        else:
            path = request.scope.get("path", "")
            if path == "/api/index.py" or path == "/api/index":
                request.scope["path"] = "/"
            elif path.startswith("/api/index.py/"):
                sub = path[len("/api/index.py"):]
                request.scope["path"] = sub if sub.startswith("/api") else f"/api{sub}"
    return await call_next(request)

if os.environ.get("VERCEL"):
    DATA_FILE = "/tmp/gamestate.json"
else:
    DATA_FILE = os.path.join(os.path.dirname(__file__), "gamestate.json")

# Default Initial Stages
DEFAULT_STAGES = [
    {
        "id": 1,
        "title": "Stage 1: The Cryptic Foyer",
        "location": "ISE Dept Main Foyer / Notice Board",
        "clue": "Where announcements gather and campus voices echo on corkboards. Find the glowing emblem near the department crest.",
        "qr_token": "HUNT-STG1-ALPHA-9281",
        "puzzle_type": "cipher",
        "puzzle_title": "Caesar Decryption Protocol",
        "story": "You've accessed the perimeter terminal. The transmission is scrambled using a Caesar-3 shift cipher.",
        "question": "Decrypt the intercepted broadcast token: 'VHFXUH_FRGH' (Shifted forward by 3 in alphabet)",
        "accepted_answers": ["SECURE_CODE", "SECURE CODE"],
        "hints": [
            "Shift each letter back by 3 positions in the alphabet (V -> S, H -> E...)",
            "The first word is SECURE and the second is CODE separated by an underscore"
        ],
        "points": 100
    },
    {
        "id": 2,
        "title": "Stage 2: The Silicon Vault",
        "location": "Microprocessor & Embedded Systems Lab",
        "clue": "Follow the scent of solder and quartz crystals humming at 5MHz. The next node is anchored near Station 08.",
        "qr_token": "HUNT-STG2-BETA-4193",
        "puzzle_type": "binary_circuit",
        "puzzle_title": "Logic Gate Checksum",
        "story": "The security door requires a hexadecimal checksum calculated from an 8-bit bus line.",
        "question": "Calculate the hex sum: Convert binary '11011010' to Hex (0xDA), then add '0x15'. What is the resulting 2-character Hex checksum?",
        "accepted_answers": ["EF", "0xEF", "ef"],
        "hints": [
            "11011010 in hex is DA. In decimal: 218.",
            "218 + 21 (0x15) = 239 in decimal. Convert 239 to hex: 14*16 + 15 = EF."
        ],
        "points": 150
    },
    {
        "id": 3,
        "title": "Stage 3: The Fiber Junction",
        "location": "Network Server Room Stairwell (Level 2)",
        "clue": "Yellow fiber optics bridge the digital backbone. Look on the riser of step 14 where packets flow.",
        "qr_token": "HUNT-STG3-GAMMA-7320",
        "puzzle_type": "morse_riddle",
        "puzzle_title": "Signal Frequency Intercept",
        "story": "An emergency telemetry broadcast is pulsing on frequency 144.800 MHz in Morse code.",
        "question": "Decode this Morse pulse: '... --- ...   -.-. .- ..-. .' (Translate the letters into English word/phrase)",
        "accepted_answers": ["SOS CAFE", "SOSCAFE", "SOS-CAFE"],
        "hints": [
            "... is S, --- is O, ... is S.",
            "-.-. is C, .- is A, ..-. is F, . is E."
        ],
        "points": 200
    },
    {
        "id": 4,
        "title": "Stage 4: The Quantum Archives",
        "location": "Central Library Digital Resource Zone",
        "clue": "Where silicon records meet quiet thinkers. Locate the catalog terminal terminal rack labeled Rack-C.",
        "qr_token": "HUNT-STG4-DELTA-8814",
        "puzzle_type": "algorithm",
        "puzzle_title": "Algorithm Root Solver",
        "story": "The matrix quantum key requires the smaller root of the quadratic synchronization polynomial.",
        "question": "Solve the quadratic security key: x^2 - 14x + 45 = 0. Submit the SMALLER root value as a single number.",
        "accepted_answers": ["5", "five"],
        "hints": [
            "Factor the equation: (x - 5)(x - 9) = 0",
            "The roots are 5 and 9. The smaller root is 5."
        ],
        "points": 250
    },
    {
        "id": 5,
        "title": "Stage 5: The Grand Nexus Podium",
        "location": "Main Auditorium / Hackathon Presentation Stage",
        "clue": "Where final champions are crowned and presentations come alive. Inspect the hidden marker on the master podium.",
        "qr_token": "HUNT-STG5-OMEGA-9999",
        "puzzle_type": "master_vault",
        "puzzle_title": "Master Override Key",
        "story": "You've arrived at the final vault terminal. To claim ultimate victory, synthesize the Master Master Token.",
        "question": "Master synthesis formula: First letter of Stage 1 answer ('S') + First letter of Stage 2 answer ('E') + First letter of Stage 3 ('S') + Stage 4 root ('5') + the word 'VICTORY'. Combine without spaces:",
        "accepted_answers": ["SES5VICTORY", "ses5victory"],
        "hints": [
            "Letter 1: S (from SECURE_CODE). Letter 2: E (from EF).",
            "Letter 3: S (from SOS CAFE). Number: 5. Suffix: VICTORY."
        ],
        "points": 350
    }
]

# Database State
db = {
    "stages": list(DEFAULT_STAGES),
    "teams": {},
    "logs": [],
    "broadcast": "Welcome to CyberHunt 2026! Scan your first QR code at Stage 1.",
    "is_hunt_active": True,
    "organizer_pin": "admin123"
}

def load_db():
    global db
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r") as f:
                saved = json.load(f)
                db.update(saved)
        except Exception as e:
            print("Error loading DB, using in-memory state:", e)

def save_db():
    try:
        with open(DATA_FILE, "w") as f:
            json.dump(db, f, indent=2)
    except Exception as e:
        print("Error saving DB:", e)

load_db()

# Pre-seed a few demo teams for leaderboard realism
if not db["teams"]:
    db["teams"]["Team ByteCrafters"] = {
        "name": "Team ByteCrafters",
        "members": "Aditya & Neha",
        "current_stage": 4,
        "completed_stages": [1, 2, 3],
        "score": 420,
        "hints_used": 1,
        "start_time": time.time() - 1950,
        "last_scan_time": time.time() - 320,
        "status": "In Progress",
        "attempts": 4
    }
    db["teams"]["NullPointers"] = {
        "name": "NullPointers",
        "members": "Vikram & Rohan",
        "current_stage": 3,
        "completed_stages": [1, 2],
        "score": 230,
        "hints_used": 2,
        "start_time": time.time() - 2400,
        "last_scan_time": time.time() - 850,
        "status": "In Progress",
        "attempts": 5
    }
    save_db()

# Models
class TeamLogin(BaseModel):
    team_name: str
    members: Optional[str] = "Participant"
    passcode: Optional[str] = ""

class ScanRequest(BaseModel):
    team_name: str
    token: str

class SolveRequest(BaseModel):
    team_name: str
    stage_id: int
    answer: str

class HintRequest(BaseModel):
    team_name: str
    stage_id: int

class BroadcastRequest(BaseModel):
    message: str
    pin: str

class StageUpdateRequest(BaseModel):
    pin: str
    stage: Dict[str, Any]

class ResetRequest(BaseModel):
    pin: str

def sanitize_stage(st: dict, reveal_puzzle: bool = False):
    """Hide answers and full puzzle details until team reaches that stage and scans QR."""
    return {
        "id": st["id"],
        "title": st["title"],
        "location": st["location"],
        "clue": st["clue"],
        "points": st["points"],
        "puzzle_title": st["puzzle_title"] if reveal_puzzle else "Locked Stage",
        "puzzle_type": st["puzzle_type"] if reveal_puzzle else "locked",
        "story": st["story"] if reveal_puzzle else "Scan the physical QR code at this location to unlock the challenge terminal.",
        "question": st["question"] if reveal_puzzle else None,
        "hints_count": len(st.get("hints", [])),
    }

# Endpoints
@app.get("/api/health")
def health():
    return {"status": "ok", "time": time.time(), "hunt_active": db["is_hunt_active"]}

@app.get("/api/stages")
def get_stages():
    """Return overview of all stages with clues for participants."""
    return [
        {
            "id": s["id"],
            "title": s["title"],
            "location": s["location"],
            "clue": s["clue"],
            "points": s["points"],
            "puzzle_type": s["puzzle_type"]
        } for s in db["stages"]
    ]

@app.post("/api/team/register")
def register_team(req: TeamLogin):
    name = req.team_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Team name is required")
    
    if name not in db["teams"]:
        db["teams"][name] = {
            "name": name,
            "members": req.members or "Operatives",
            "current_stage": 1,
            "completed_stages": [],
            "current_unlocked": False, # Must scan stage 1 QR to unlock puzzle
            "score": 0,
            "hints_used": 0,
            "start_time": time.time(),
            "last_scan_time": time.time(),
            "status": "Ready",
            "attempts": 0,
            "unlocked_hints": {}
        }
        db["logs"].append({
            "time": time.strftime("%H:%M:%S"),
            "event": f"Team '{name}' registered for the hunt."
        })
        save_db()
    
    team = db["teams"][name]
    return {"status": "success", "team": team}

@app.get("/api/team/status")
def get_team_status(name: str):
    name = name.strip()
    if name not in db["teams"]:
        raise HTTPException(status_code=404, detail="Team not found")
    
    team = db["teams"][name]
    current_stage_id = team["current_stage"]
    stage = next((s for s in db["stages"] if s["id"] == current_stage_id), None)
    
    stage_data = None
    if stage:
        unlocked = team.get("current_unlocked", False)
        stage_data = {
            "id": stage["id"],
            "title": stage["title"],
            "location": stage["location"],
            "clue": stage["clue"],
            "points": stage["points"],
            "is_unlocked": unlocked,
            "puzzle_title": stage["puzzle_title"] if unlocked else "Locked Stage",
            "puzzle_type": stage["puzzle_type"] if unlocked else "locked",
            "story": stage["story"] if unlocked else "Head to the physical location indicated by the clue. Find and scan the QR code to boot up this terminal.",
            "question": stage["question"] if unlocked else None,
            "hints_available": len(stage.get("hints", [])),
            "hints_revealed": team.get("unlocked_hints", {}).get(str(stage["id"]), [])
        }

    return {
        "team": team,
        "current_stage_data": stage_data,
        "total_stages": len(db["stages"]),
        "broadcast": db.get("broadcast", "")
    }

@app.post("/api/scan")
def scan_qr(req: ScanRequest):
    """
    Enforces Strict Game Progression:
    - Verifies token matches current stage
    - Rejects invalid stage / skip attempts
    """
    team_name = req.team_name.strip()
    token = req.token.strip().upper()

    if team_name not in db["teams"]:
        raise HTTPException(status_code=404, detail="Team not registered")
    
    team = db["teams"][team_name]
    curr_id = team["current_stage"]
    current_stage = next((s for s in db["stages"] if s["id"] == curr_id), None)

    if not current_stage:
        return {"success": False, "message": "All stages completed! You have completed the hunt."}

    # Find which stage this token belongs to
    matching_stage = next((s for s in db["stages"] if s["qr_token"].upper() == token), None)
    
    if not matching_stage:
        db["logs"].append({
            "time": time.strftime("%H:%M:%S"),
            "event": f"Team '{team_name}' scanned an UNKNOWN QR token: {token}"
        })
        return {
            "success": False,
            "reason": "invalid_qr",
            "message": "Unrecognized QR code or security token. Ensure you are scanning the official CyberHunt beacon."
        }

    # Check for out-of-sequence progression
    if matching_stage["id"] < curr_id:
        return {
            "success": False,
            "reason": "already_cleared",
            "message": f"Stage {matching_stage['id']} is already cleared. Move ahead to Stage {curr_id}!"
        }
    
    if matching_stage["id"] > curr_id:
        db["logs"].append({
            "time": time.strftime("%H:%M:%S"),
            "event": f"CRITICAL: Team '{team_name}' attempted SEQUENCE VIOLATION (Jumped to Stage {matching_stage['id']})!"
        })
        return {
            "success": False,
            "reason": "sequence_breach",
            "message": f"SEQUENCE BREACH DETECTED: You scanned Stage {matching_stage['id']}, but you must complete Stage {curr_id} first! Skipping is strictly prohibited."
        }

    # Legitimate scan for current stage!
    team["current_unlocked"] = True
    team["last_scan_time"] = time.time()
    db["logs"].append({
        "time": time.strftime("%H:%M:%S"),
        "event": f"Team '{team_name}' unlocked terminal for Stage {curr_id}."
    })
    save_db()

    return {
        "success": True,
        "stage_id": curr_id,
        "message": f"Beacon Verified! Security handshake established for {current_stage['title']}.",
        "stage_title": current_stage["title"]
    }

@app.post("/api/puzzle/solve")
def solve_puzzle(req: SolveRequest):
    team_name = req.team_name.strip()
    submission = req.answer.strip()

    if team_name not in db["teams"]:
        raise HTTPException(status_code=404, detail="Team not found")
    
    team = db["teams"][team_name]
    curr_id = team["current_stage"]

    if req.stage_id != curr_id:
        return {"correct": False, "message": "This stage is not your current objective."}
    
    if not team.get("current_unlocked", False):
        return {"correct": False, "message": "Terminal is locked! Scan the location QR code first."}

    stage = next((s for s in db["stages"] if s["id"] == curr_id), None)
    if not stage:
        return {"correct": False, "message": "Stage not found."}

    team["attempts"] = team.get("attempts", 0) + 1

    # Check answers (case-insensitive & whitespace trimmed)
    norm_sub = submission.replace(" ", "").upper()
    accepted = [a.replace(" ", "").upper() for a in stage.get("accepted_answers", [])]

    if norm_sub in accepted:
        # Correct answer!
        earned_points = stage["points"]
        team["score"] += earned_points
        team["completed_stages"].append(curr_id)
        team["current_unlocked"] = False # Reset lock for next stage
        
        # Check if last stage
        if curr_id >= len(db["stages"]):
            team["status"] = "FINISHED"
            team["finish_time"] = time.time()
            elapsed_min = round((team["finish_time"] - team["start_time"]) / 60, 1)
            db["logs"].append({
                "time": time.strftime("%H:%M:%S"),
                "event": f"VICTORY: Team '{team_name}' FINISHED the hunt in {elapsed_min} mins with {team['score']} pts!"
            })
            save_db()
            return {
                "correct": True,
                "completed_hunt": True,
                "earned_points": earned_points,
                "message": f"OVERRIDE ACCEPTED! Master Vault unlocked! Final score: {team['score']}.",
                "next_stage": None
            }
        else:
            team["current_stage"] += 1
            next_stage = next(s for s in db["stages"] if s["id"] == team["current_stage"])
            db["logs"].append({
                "time": time.strftime("%H:%M:%S"),
                "event": f"Team '{team_name}' solved Stage {curr_id}! Advanced to Stage {team['current_stage']}."
            })
            save_db()
            return {
                "correct": True,
                "completed_hunt": False,
                "earned_points": earned_points,
                "message": f"ACCESS GRANTED! Stage {curr_id} solved! Next clue unlocked.",
                "next_stage": {
                    "id": next_stage["id"],
                    "title": next_stage["title"],
                    "location": next_stage["location"],
                    "clue": next_stage["clue"]
                }
            }
    else:
        # Penalty of 10 points for wrong answer
        team["score"] = max(0, team["score"] - 10)
        db["logs"].append({
            "time": time.strftime("%H:%M:%S"),
            "event": f"Team '{team_name}' failed answer attempt for Stage {curr_id} ('{submission}'). (-10 pts)"
        })
        save_db()
        return {
            "correct": False,
            "message": "ACCESS DENIED: Invalid passcode or key. Penalty of 10 pts applied. Re-evaluate your calculations!",
            "current_score": team["score"]
        }

@app.post("/api/puzzle/hint")
def get_hint(req: HintRequest):
    team_name = req.team_name.strip()
    if team_name not in db["teams"]:
        raise HTTPException(status_code=404, detail="Team not found")
    
    team = db["teams"][team_name]
    stage = next((s for s in db["stages"] if s["id"] == req.stage_id), None)
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")

    hints = stage.get("hints", [])
    if not hints:
        return {"success": False, "message": "No hints available for this stage."}

    if "unlocked_hints" not in team:
        team["unlocked_hints"] = {}
    
    st_key = str(req.stage_id)
    revealed = team["unlocked_hints"].get(st_key, [])

    if len(revealed) >= len(hints):
        return {"success": False, "message": "All hints for this stage have already been unlocked."}

    next_hint_index = len(revealed)
    hint_text = hints[next_hint_index]
    revealed.append(hint_text)
    team["unlocked_hints"][st_key] = revealed
    
    # 25 points deduction for hint
    penalty = 25
    team["hints_used"] = team.get("hints_used", 0) + 1
    team["score"] = max(0, team["score"] - penalty)

    db["logs"].append({
        "time": time.strftime("%H:%M:%S"),
        "event": f"Team '{team_name}' unlocked Hint #{next_hint_index + 1} for Stage {req.stage_id} (-{penalty} pts)."
    })
    save_db()

    return {
        "success": True,
        "hint": hint_text,
        "hints_revealed": revealed,
        "penalty": penalty,
        "current_score": team["score"]
    }

@app.get("/api/leaderboard")
def get_leaderboard():
    teams_list = list(db["teams"].values())
    
    # Rank by: 1. Completed stages count (desc), 2. Score (desc), 3. Finish time or last active
    def sort_key(t):
        stages_done = len(t.get("completed_stages", []))
        score = t.get("score", 0)
        # finished teams get priority, else lower elapsed time
        return (stages_done, score, -t.get("last_scan_time", 0))

    sorted_teams = sorted(teams_list, key=sort_key, reverse=True)

    ranked = []
    for idx, t in enumerate(sorted_teams, 1):
        elapsed = round((time.time() - t["start_time"]) / 60, 1)
        ranked.append({
            "rank": idx,
            "name": t["name"],
            "members": t.get("members", "-"),
            "current_stage": t.get("current_stage", 1),
            "completed_count": len(t.get("completed_stages", [])),
            "score": t.get("score", 0),
            "hints_used": t.get("hints_used", 0),
            "attempts": t.get("attempts", 0),
            "status": t.get("status", "Active"),
            "elapsed_minutes": elapsed
        })

    return {
        "leaderboard": ranked,
        "total_teams": len(ranked),
        "total_stages": len(db["stages"]),
        "hunt_active": db["is_hunt_active"]
    }

@app.get("/api/organizer/dashboard")
def organizer_dashboard(pin: str):
    if pin != db["organizer_pin"]:
        raise HTTPException(status_code=403, detail="Invalid Organizer PIN")

    return {
        "stages": db["stages"],
        "teams": db["teams"],
        "logs": db["logs"][-30:], # Last 30 event logs
        "broadcast": db["broadcast"],
        "is_hunt_active": db["is_hunt_active"],
        "total_stages": len(db["stages"])
    }

@app.post("/api/organizer/broadcast")
def set_broadcast(req: BroadcastRequest):
    if req.pin != db["organizer_pin"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    db["broadcast"] = req.message
    db["logs"].append({
        "time": time.strftime("%H:%M:%S"),
        "event": f"ORGANIZER BROADCAST: {req.message}"
    })
    save_db()
    return {"success": True, "broadcast": db["broadcast"]}

@app.post("/api/organizer/stage")
def update_stage(req: StageUpdateRequest):
    if req.pin != db["organizer_pin"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    stage_data = req.stage
    stage_id = stage_data.get("id")

    existing_idx = next((i for i, s in enumerate(db["stages"]) if s["id"] == stage_id), None)
    if existing_idx is not None:
        db["stages"][existing_idx].update(stage_data)
    else:
        stage_data["id"] = len(db["stages"]) + 1
        db["stages"].append(stage_data)

    db["logs"].append({
        "time": time.strftime("%H:%M:%S"),
        "event": f"Stage {stage_id} updated by Organizer."
    })
    save_db()
    return {"success": True, "stages": db["stages"]}

@app.post("/api/organizer/reset")
def reset_hunt(req: ResetRequest):
    if req.pin != db["organizer_pin"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    db["teams"] = {}
    db["logs"] = [{
        "time": time.strftime("%H:%M:%S"),
        "event": "GAME RESET: All team scores and progress have been wiped by Organizer."
    }]
    db["broadcast"] = "The hunt has been restarted! Scan Stage 1 to commence."
    save_db()
    return {"success": True, "message": "Hunt game state reset successfully."}

@app.get("/api/qr/{stage_id}")
def generate_stage_qr(stage_id: int):
    stage = next((s for s in db["stages"] if s["id"] == stage_id), None)
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")
    
    token = stage["qr_token"]
    # We can encode the token string or full verification URL
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=3,
    )
    qr.add_data(token)
    qr.make(fit=True)

    img = qr.make_image(fill_color="#0a192f", back_color="#ffffff")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    
    return StreamingResponse(buf, media_type="image/png")

# Dedicated Route Handlers for Role Separation
@app.get("/admin")
def serve_admin():
    return FileResponse(os.path.join(STATIC_DIR, "admin.html"))

@app.get("/participant")
def serve_participant():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

# Serve frontend static assets
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
