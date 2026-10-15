// CYBERHUNT 2026 - Digital Treasure Hunt Frontend Engine
// Full Interactive Client Logic

let currentTeam = localStorage.getItem("cyberhunt_team") || "Team CyberX";
let teamData = null;
let currentStageData = null;
let allStages = [];
let html5QrScanner = null;
let isScannerRunning = false;
let adminPin = localStorage.getItem("cyberhunt_admin_pin") || "";

// Audio wrapper
function clickSound() { if (window.sound) window.sound.playClick(); }
function successSound() { if (window.sound) window.sound.playSuccess(); }
function errorSound() { if (window.sound) window.sound.playError(); }
function alarmSound() { if (window.sound) window.sound.playAlarm(); }

// Toast Alert System
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let icon = "ℹ️";
  if (type === "success") icon = "✅";
  if (type === "error") icon = "⚠️";

  toast.innerHTML = `
    <div style="font-size: 1.2rem;">${icon}</div>
    <div style="font-size: 0.84rem; line-height: 1.4; color: #fff;">${message}</div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// Tab Switching
function switchTab(tabId) {
  clickSound();
  document.querySelectorAll(".view-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  const panel = document.getElementById(`view-${tabId}`);
  const btn = document.getElementById(`tab-${tabId}`);
  if (panel) panel.classList.add("active");
  if (btn) btn.classList.add("active");

  // Handle camera scanner start/stop
  if (tabId === "scanner") {
    startCameraScanner();
  } else {
    stopCameraScanner();
  }

  // Refresh relevant view
  if (tabId === "leaderboard") loadLeaderboard();
  if (tabId === "map") renderStationsMap();
  if (tabId === "admin" && adminPin) loadAdminDashboard();
}

// Initialize Application
async function initApp() {
  document.getElementById("hudTeamName").textContent = currentTeam;
  
  // Register or sync team
  await registerOrSyncTeam(currentTeam);
  await fetchStages();
  await refreshTeamStatus();
  await loadLeaderboard();

  // Periodic Polling
  setInterval(refreshTeamStatus, 6000);
}

async function registerOrSyncTeam(name) {
  try {
    const res = await fetch("/api/team/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_name: name, members: "Operatives" })
    });
    const data = await res.json();
    if (data.status === "success") {
      teamData = data.team;
      updateHud();
    }
  } catch (e) {
    console.error("Error registering team:", e);
  }
}

async function fetchStages() {
  try {
    const res = await fetch("/api/stages");
    allStages = await res.json();
    renderProgressionSteps();
    renderStationsMap();
  } catch (e) {
    console.error("Error fetching stages:", e);
  }
}

async function refreshTeamStatus() {
  if (!currentTeam) return;
  try {
    const res = await fetch(`/api/team/status?name=${encodeURIComponent(currentTeam)}`);
    if (!res.ok) return;
    const data = await res.json();
    teamData = data.team;
    currentStageData = data.current_stage_data;
    
    // Broadcast banner
    if (data.broadcast) {
      document.getElementById("broadcastText").textContent = data.broadcast;
    }

    updateHud();
    renderMissionView();
    updateProgressionSteps();
  } catch (e) {
    console.error("Error refreshing team status:", e);
  }
}

function updateHud() {
  if (!teamData) return;
  document.getElementById("hudTeamName").textContent = teamData.name;
  document.getElementById("hudMembers").textContent = `Operatives: ${teamData.members || "Agents"}`;
  document.getElementById("hudScore").textContent = teamData.score || 0;
  
  const currentStage = teamData.current_stage || 1;
  const total = allStages.length || 5;
  document.getElementById("hudStage").textContent = `${currentStage} / ${total}`;
  document.getElementById("hudHints").textContent = teamData.hints_used || 0;

  // Percentage
  const completed = (teamData.completed_stages || []).length;
  const pct = Math.round((completed / total) * 100);
  document.getElementById("progressPercent").textContent = `${pct}% CLEARED`;
  document.getElementById("progressBarFill").style.width = `${pct}%`;
}

function renderProgressionSteps() {
  const container = document.getElementById("progressStepsContainer");
  // Keep the progress line
  const line = container.querySelector(".progress-bar-line");
  container.innerHTML = "";
  if (line) container.appendChild(line);

  allStages.forEach(st => {
    const node = document.createElement("div");
    node.className = "step-node";
    node.id = `step-node-${st.id}`;
    node.innerHTML = `
      <div class="step-circle">${st.id}</div>
      <div class="step-label">Stage ${st.id}</div>
    `;
    node.onclick = () => {
      clickSound();
      showToast(`Stage ${st.id}: ${st.title} at ${st.location}`, "info");
    };
    container.appendChild(node);
  });
}

function updateProgressionSteps() {
  if (!teamData) return;
  const currId = teamData.current_stage;
  const completed = teamData.completed_stages || [];

  allStages.forEach(st => {
    const node = document.getElementById(`step-node-${st.id}`);
    if (!node) return;
    node.classList.remove("completed", "active");

    if (completed.includes(st.id)) {
      node.classList.add("completed");
    } else if (st.id === currId) {
      node.classList.add("active");
    }
  });
}

function renderMissionView() {
  if (!currentStageData) return;

  const st = currentStageData;
  document.getElementById("missionStageBadge").textContent = `STAGE ${st.id} RECON`;
  document.getElementById("missionPointsPill").textContent = `+${st.points} PTS`;
  document.getElementById("missionTitle").textContent = st.title;
  document.getElementById("missionLocation").textContent = st.location;
  document.getElementById("missionClue").textContent = `"${st.clue}"`;

  const boxLocked = document.getElementById("terminalBoxLocked");
  const boxUnlocked = document.getElementById("terminalBoxUnlocked");
  const statusPill = document.getElementById("terminalStatusPill");

  if (st.is_unlocked) {
    boxLocked.style.display = "none";
    boxUnlocked.style.display = "block";
    statusPill.textContent = "ONLINE // READY";
    statusPill.style.background = "rgba(16, 185, 129, 0.15)";
    statusPill.style.color = "var(--accent-emerald)";
    statusPill.style.borderColor = "rgba(16, 185, 129, 0.4)";

    document.getElementById("terminalPuzzleTitle").textContent = st.puzzle_title;
    document.getElementById("puzzleStory").textContent = st.story;
    document.getElementById("puzzleQuestionText").innerHTML = st.question;

    renderPuzzleWidget(st);
    renderHintsList(st.hints_revealed || []);
  } else {
    boxLocked.style.display = "block";
    boxUnlocked.style.display = "none";
    statusPill.textContent = "AWAITING BEACON";
    statusPill.style.background = "rgba(245, 158, 11, 0.15)";
    statusPill.style.color = "var(--accent-amber)";
    statusPill.style.borderColor = "rgba(245, 158, 11, 0.4)";
  }
}

// Interactive Puzzle Specific Widgets
function renderPuzzleWidget(stage) {
  const slot = document.getElementById("puzzleWidgetSlot");
  slot.innerHTML = "";

  if (stage.puzzle_type === "cipher") {
    // Caesar helper tool
    const div = document.createElement("div");
    div.className = "cipher-widget";
    div.innerHTML = `
      <div style="font-weight: 700; color: var(--accent-cyan); margin-bottom: 6px;">CAESAR SHIFT WHEEL (SHIFT: -3)</div>
      <div class="cipher-display">
        <span class="cipher-char">V → S</span>
        <span class="cipher-char">H → E</span>
        <span class="cipher-char">F → C</span>
        <span class="cipher-char">X → U</span>
        <span class="cipher-char">U → R</span>
        <span class="cipher-char">H → E</span>
      </div>
      <div style="font-size: 0.72rem; text-align: center;">Formula: (Letter_Index - 3) mod 26</div>
    `;
    slot.appendChild(div);
  } else if (stage.puzzle_type === "binary_circuit") {
    // Binary Checksum Visualizer
    const div = document.createElement("div");
    div.className = "cipher-widget";
    div.innerHTML = `
      <div style="font-weight: 700; color: var(--accent-cyan); margin-bottom: 6px;">8-BIT DATA BUS DISPLAY</div>
      <div style="display: flex; justify-content: center; gap: 4px; font-family: var(--font-mono); margin: 8px 0;">
        <span style="background: rgba(0,242,254,0.2); padding: 4px 6px; border-radius: 4px;">1</span>
        <span style="background: rgba(0,242,254,0.2); padding: 4px 6px; border-radius: 4px;">1</span>
        <span style="background: rgba(0,242,254,0.05); padding: 4px 6px; border-radius: 4px;">0</span>
        <span style="background: rgba(0,242,254,0.2); padding: 4px 6px; border-radius: 4px;">1</span>
        <span style="margin: 0 4px;"></span>
        <span style="background: rgba(0,242,254,0.2); padding: 4px 6px; border-radius: 4px;">1</span>
        <span style="background: rgba(0,242,254,0.05); padding: 4px 6px; border-radius: 4px;">0</span>
        <span style="background: rgba(0,242,254,0.2); padding: 4px 6px; border-radius: 4px;">1</span>
        <span style="background: rgba(0,242,254,0.05); padding: 4px 6px; border-radius: 4px;">0</span>
      </div>
      <div style="text-align: center; font-size: 0.75rem;">Binary 11011010 = 0xDA. Checksum equation: 0xDA + 0x15 = ?</div>
    `;
    slot.appendChild(div);
  } else if (stage.puzzle_type === "morse_riddle") {
    // Morse Synthesizer Player
    const div = document.createElement("div");
    div.className = "cipher-widget";
    div.innerHTML = `
      <div style="font-weight: 700; color: var(--accent-cyan); margin-bottom: 6px;">SIGNAL FREQUENCY INTERCEPT (144.800 MHz)</div>
      <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin: 10px 0;">
        <button type="button" class="btn btn-purple btn-sm" onclick="playMorseSignal()">
          <span>📻</span> Synthesize Audio Morse Transmission
        </button>
      </div>
      <div style="font-size: 0.72rem; text-align: center; color: var(--text-muted);">
        Dots (•) = short beep | Dashes (—) = long beep. Pattern: ... --- ... / -.-. .- ..-. .
      </div>
    `;
    slot.appendChild(div);
  } else if (stage.puzzle_type === "master_vault") {
    // Master Vault synthesis helper
    const div = document.createElement("div");
    div.className = "cipher-widget";
    div.innerHTML = `
      <div style="font-weight: 700; color: var(--accent-pink); margin-bottom: 6px;">MASTER SYNTHESIS ARRAY</div>
      <div style="font-size: 0.75rem; line-height: 1.6;">
        <div>Stage 1: <b>S</b>ECURE_CODE → <code>S</code></div>
        <div>Stage 2: <b>E</b>F → <code>E</code></div>
        <div>Stage 3: <b>S</b>OS CAFE → <code>S</code></div>
        <div>Stage 4: Root <code>5</code></div>
        <div>Final Key: <code>S + E + S + 5 + VICTORY</code></div>
      </div>
    `;
    slot.appendChild(div);
  }
}

function playMorseSignal() {
  if (window.sound) {
    window.sound.playMorse();
    showToast("Playing synthesized Morse signal on frequency 144.800 MHz...", "info");
  }
}

function renderHintsList(revealedHints) {
  const container = document.getElementById("hintsList");
  container.innerHTML = "";
  if (!revealedHints || revealedHints.length === 0) return;

  revealedHints.forEach((h, idx) => {
    const hintEl = document.createElement("div");
    hintEl.className = "hint-box";
    hintEl.innerHTML = `<b>Intelligence Clue #${idx + 1}:</b> ${h}`;
    container.appendChild(hintEl);
  });
}

// Puzzle Submission
async function handleSolveSubmit(e) {
  e.preventDefault();
  const input = document.getElementById("answerInput");
  const answer = input.value.trim();
  if (!answer) return;

  clickSound();
  const currId = currentStageData ? currentStageData.id : teamData.current_stage;

  try {
    const res = await fetch("/api/puzzle/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_name: currentTeam,
        stage_id: currId,
        answer: answer
      })
    });

    const data = await res.json();
    if (data.correct) {
      successSound();
      showToast(data.message, "success");
      input.value = "";
      await refreshTeamStatus();
      await loadLeaderboard();

      if (data.completed_hunt) {
        // Final victory pop-up!
        setTimeout(() => {
          alert(`🏆 CONGRATULATIONS ${currentTeam}! You have unlocked the MASTER VAULT and completed the CyberHunt 2026! Final Score: ${teamData.score}`);
          switchTab("leaderboard");
        }, 600);
      }
    } else {
      errorSound();
      showToast(data.message, "error");
    }
  } catch (err) {
    console.error("Error solving puzzle:", err);
    showToast("Server communication error", "error");
  }
}

// Request Hint
async function requestHint() {
  if (!currentStageData) return;
  clickSound();

  const confirmed = confirm("Requesting an intelligence hint will deduct 25 points from your score. Proceed?");
  if (!confirmed) return;

  try {
    const res = await fetch("/api/puzzle/hint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_name: currentTeam,
        stage_id: currentStageData.id
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast(`Hint Unlocked! (-${data.penalty} pts penalty applied)`, "info");
      await refreshTeamStatus();
    } else {
      showToast(data.message, "error");
    }
  } catch (err) {
    showToast("Error requesting hint", "error");
  }
}

// QR Code Scanning & Progression Logic
async function processScanToken(token) {
  token = token.trim();
  if (!token) return;

  try {
    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_name: currentTeam,
        token: token
      })
    });

    let data;
    try {
      data = await res.json();
    } catch(e) {
      data = null;
    }

    if (data && data.success) {
      successSound();
      showToast(data.message || "Beacon Verified! Terminal Unlocked.", "success");
      await refreshTeamStatus();
      switchTab("mission");
    } else if (data && !data.success) {
      const msg = data.message || data.detail || "Invalid Beacon or Stage";
      if (data.reason === "sequence_breach") {
        alarmSound();
        showToast(msg, "error");
      } else {
        errorSound();
        showToast(msg, "error");
      }
    } else {
      // Local client-side anti-cheat progression fallback
      const currId = teamData ? teamData.current_stage : 1;
      const matched = allStages.find(s => s.qr_token.toUpperCase() === token.toUpperCase());
      if (matched) {
        if (matched.id === currId) {
          if (teamData) teamData.current_unlocked = true;
          if (currentStageData) currentStageData.is_unlocked = true;
          successSound();
          showToast(`Beacon Verified! Physical security handshake accepted for Stage ${currId}.`, "success");
          renderMissionView();
          switchTab("mission");
        } else if (matched.id > currId) {
          alarmSound();
          showToast(`SEQUENCE BREACH DETECTED: You scanned Stage ${matched.id}, but must complete Stage ${currId} first! Skipping prohibited.`, "error");
        } else {
          showToast(`Stage ${matched.id} is already cleared. Move ahead to Stage ${currId}!`, "info");
        }
      } else {
        errorSound();
        showToast("Unrecognized QR beacon. Ensure you scan the official CyberHunt marker.", "error");
      }
    }
  } catch (err) {
    console.warn("Scan network fallback triggered:", err);
    // Offline / client-side instant check
    const currId = teamData ? teamData.current_stage : 1;
    const matched = allStages.find(s => s.qr_token.toUpperCase() === token.toUpperCase());
    if (matched) {
      if (matched.id === currId) {
        if (teamData) teamData.current_unlocked = true;
        if (currentStageData) currentStageData.is_unlocked = true;
        successSound();
        showToast(`Beacon Verified! Terminal unlocked for Stage ${currId}.`, "success");
        renderMissionView();
        switchTab("mission");
      } else if (matched.id > currId) {
        alarmSound();
        showToast(`SEQUENCE BREACH DETECTED: You scanned Stage ${matched.id}, but must complete Stage ${currId} first!`, "error");
      }
    } else {
      errorSound();
      showToast("Unrecognized QR beacon token.", "error");
    }
  }
}

function submitManualToken() {
  const input = document.getElementById("manualTokenInput");
  const token = input.value.trim();
  if (token) {
    processScanToken(token);
    input.value = "";
  }
}

function simulateScan(token) {
  clickSound();
  showToast(`Simulating Optical Beacon Scan: ${token}`, "info");
  processScanToken(token);
}

// Camera QR Scanner with HTML5 QR Code Library
function startCameraScanner() {
  if (isScannerRunning) return;
  const statusEl = document.getElementById("scannerStatus");
  statusEl.textContent = "Connecting to optical video device...";

  try {
    if (typeof Html5Qrcode === "undefined") {
      statusEl.textContent = "Scanner library loaded. Use manual token input or simulation buttons.";
      return;
    }

    html5QrScanner = new Html5Qrcode("reader");
    html5QrScanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 220, height: 220 }
      },
      (decodedText) => {
        // Scanned!
        statusEl.textContent = `Scanned Beacon: ${decodedText}`;
        processScanToken(decodedText);
      },
      (errorMessage) => {
        // Scanning in progress, keep silent
      }
    ).then(() => {
      isScannerRunning = true;
      statusEl.textContent = "Camera Active. Scan the official CyberHunt QR beacon.";
    }).catch(err => {
      console.warn("Camera start failed, falling back to manual entry:", err);
      statusEl.textContent = "Camera access restricted or unavailable. Use manual token entry or test shortcuts below.";
    });
  } catch (e) {
    statusEl.textContent = "Camera module fallback. Use test buttons or token input.";
  }
}

function stopCameraScanner() {
  if (html5QrScanner && isScannerRunning) {
    html5QrScanner.stop().then(() => {
      isScannerRunning = false;
    }).catch(() => {});
  }
}

// Stations Roadmap
function renderStationsMap() {
  const container = document.getElementById("stationsListGrid");
  container.innerHTML = "";

  const currId = teamData ? teamData.current_stage : 1;
  const completed = teamData ? teamData.completed_stages || [] : [];

  allStages.forEach(st => {
    const isDone = completed.includes(st.id);
    const isCurrent = st.id === currId;
    
    let borderStyle = "border-color: rgba(255,255,255,0.08);";
    let badgeText = "LOCKED";
    let badgeColor = "color: var(--text-dim); background: rgba(255,255,255,0.05);";

    if (isDone) {
      borderStyle = "border-color: rgba(16,185,129,0.5);";
      badgeText = "CLEARED";
      badgeColor = "color: var(--accent-emerald); background: rgba(16,185,129,0.15);";
    } else if (isCurrent) {
      borderStyle = "border-color: var(--accent-cyan); box-shadow: 0 0 15px rgba(0,242,254,0.15);";
      badgeText = "CURRENT OBJECTIVE";
      badgeColor = "color: var(--accent-cyan); background: rgba(0,242,254,0.15);";
    }

    const card = document.createElement("div");
    card.className = "card";
    card.style = `${borderStyle} padding: 18px;`;
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <span style="font-family: var(--font-mono); font-size: 0.72rem; padding: 3px 8px; border-radius: 4px; ${badgeColor}">${badgeText}</span>
        <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent-amber);">+${st.points} PTS</span>
      </div>
      <h3 style="font-size: 1.05rem; margin-bottom: 6px;">Stage ${st.id}: ${st.title}</h3>
      <div style="font-size: 0.78rem; color: var(--accent-cyan); margin-bottom: 8px;">📍 ${st.location}</div>
      <p style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 10px;">${st.clue}</p>
      
      <!-- Scannable QR Code for Station -->
      <div style="margin: 10px 0; text-align: center; background: #ffffff; border-radius: 8px; padding: 10px;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(st.qr_token)}" alt="Stage ${st.id} QR Code" style="width: 130px; height: 130px; display: block; margin: 0 auto; border-radius: 4px;" onerror="this.src='/api/qr/${st.id}'" />
        <div style="font-family: var(--font-mono); font-size: 0.72rem; color: #0f172a; font-weight: 700; margin-top: 6px;">${st.qr_token}</div>
      </div>

      <button class="btn btn-outline btn-sm btn-block" style="margin-top: 6px;" onclick="simulateScan('${st.qr_token}')">⚡ Simulate Scan at Station</button>
    `;
    container.appendChild(card);
  });
}

// Leaderboard Loading
async function loadLeaderboard() {
  try {
    const res = await fetch("/api/leaderboard");
    const data = await res.json();
    const tbody = document.getElementById("leaderboardBody");
    tbody.innerHTML = "";

    data.leaderboard.forEach(t => {
      const tr = document.createElement("tr");
      let rankClass = "";
      if (t.rank === 1) rankClass = "rank-1";
      if (t.rank === 2) rankClass = "rank-2";
      if (t.rank === 3) rankClass = "rank-3";

      const isCurrentTeam = t.name === currentTeam;
      if (isCurrentTeam) {
        tr.style.background = "rgba(0, 242, 254, 0.08)";
        tr.style.fontWeight = "600";
      }

      tr.innerHTML = `
        <td><span class="rank-badge ${rankClass}">${t.rank}</span></td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>${t.name}</span>
            ${isCurrentTeam ? '<span style="font-size: 0.65rem; background: var(--accent-cyan); color: #000; padding: 1px 5px; border-radius: 3px;">YOU</span>' : ''}
          </div>
        </td>
        <td style="color: var(--text-muted);">${t.members}</td>
        <td>
          <span style="color: var(--accent-cyan); font-family: var(--font-mono);">${t.completed_count} / ${data.total_stages}</span>
        </td>
        <td style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-amber);">${t.score}</td>
        <td style="font-family: var(--font-mono); font-size: 0.8rem;">${t.hints_used} hints / ${t.attempts} att</td>
        <td style="font-family: var(--font-mono); color: var(--text-dim);">${t.elapsed_minutes}m</td>
        <td>
          <span style="font-family: var(--font-mono); font-size: 0.72rem; padding: 2px 8px; border-radius: 4px; ${t.status === 'FINISHED' ? 'background: rgba(16,185,129,0.2); color: var(--accent-emerald);' : 'background: rgba(56,189,248,0.15); color: #38bdf8;'}">
            ${t.status}
          </span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error("Error loading leaderboard:", e);
  }
}

// Organizer / Admin Logic
async function authenticateAdmin() {
  const pin = document.getElementById("adminPinInput").value.trim();
  try {
    const res = await fetch(`/api/organizer/dashboard?pin=${encodeURIComponent(pin)}`);
    if (res.ok) {
      adminPin = pin;
      localStorage.setItem("cyberhunt_admin_pin", pin);
      document.getElementById("adminPinGate").style.display = "none";
      document.getElementById("adminTools").style.display = "block";
      document.getElementById("adminAuthBadge").textContent = "ORGANIZER UNLOCKED";
      document.getElementById("adminAuthBadge").style.color = "var(--accent-emerald)";
      document.getElementById("adminAuthBadge").style.borderColor = "var(--accent-emerald)";
      showToast("Organizer Access Granted", "success");
      loadAdminDashboard();
    } else {
      errorSound();
      showToast("Invalid Organizer PIN", "error");
    }
  } catch (err) {
    showToast("Server error verifying PIN", "error");
  }
}

async function loadAdminDashboard() {
  if (!adminPin) return;
  try {
    const res = await fetch(`/api/organizer/dashboard?pin=${encodeURIComponent(adminPin)}`);
    if (!res.ok) return;
    const data = await res.json();

    // Render Event Logs
    const logBox = document.getElementById("adminLogsBox");
    logBox.innerHTML = "";
    data.logs.slice().reverse().forEach(l => {
      const line = document.createElement("div");
      line.innerHTML = `<span style="color: var(--accent-cyan);">[${l.time}]</span> ${l.event}`;
      logBox.appendChild(line);
    });

    // Render Stages Overview
    const stagesBox = document.getElementById("adminStagesView");
    stagesBox.innerHTML = "";
    data.stages.forEach(st => {
      const row = document.createElement("div");
      row.style = "background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 10px 14px; font-size: 0.8rem;";
      row.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <b style="color: #fff;">Stage ${st.id}: ${st.title} (${st.points} pts)</b>
          <span style="font-family: var(--font-mono); color: var(--accent-cyan);">Beacon Token: <code>${st.qr_token}</code></span>
        </div>
        <div style="color: var(--text-muted);">Location: ${st.location}</div>
        <div style="color: #cbd5e1; margin-top: 4px;">Question: ${st.question}</div>
        <div style="color: var(--accent-emerald); font-family: var(--font-mono); margin-top: 4px;">Accepted Answers: ${st.accepted_answers.join(", ")}</div>
      `;
      stagesBox.appendChild(row);
    });

  } catch (e) {
    console.error("Error loading admin dashboard:", e);
  }
}

async function promptBroadcast() {
  const msg = prompt("Enter announcement broadcast to transmit to all participant terminals:");
  if (!msg) return;
  try {
    const res = await fetch("/api/organizer/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: adminPin, message: msg })
    });
    const data = await res.json();
    if (data.success) {
      showToast("Broadcast transmitted!", "success");
      loadAdminDashboard();
    }
  } catch (e) {
    showToast("Error sending broadcast", "error");
  }
}

async function confirmResetHunt() {
  const confirmWipe = prompt("WARNING: Type 'RESET' to wipe all scores and progress for all teams:");
  if (confirmWipe !== "RESET") return;
  try {
    const res = await fetch("/api/organizer/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: adminPin })
    });
    const data = await res.json();
    if (data.success) {
      showToast("Game state wiped and reset!", "info");
      await refreshTeamStatus();
      await loadLeaderboard();
      loadAdminDashboard();
    }
  } catch (e) {
    showToast("Error resetting hunt", "error");
  }
}

// Modal Handlers
function openLoginModal() {
  document.getElementById("loginModal").classList.add("active");
  document.getElementById("regTeamName").value = currentTeam;
}

function closeLoginModal() {
  document.getElementById("loginModal").classList.remove("active");
}

async function handleTeamRegister(e) {
  e.preventDefault();
  const name = document.getElementById("regTeamName").value.trim();
  const members = document.getElementById("regMembers").value.trim();
  if (!name) return;

  currentTeam = name;
  localStorage.setItem("cyberhunt_team", name);
  closeLoginModal();
  
  await registerOrSyncTeam(name);
  await refreshTeamStatus();
  showToast(`Switched to operative team '${name}'`, "success");
}

function openPrintModal() {
  const container = document.getElementById("qrBadgesContainer");
  container.innerHTML = "";

  allStages.forEach(st => {
    const card = document.createElement("div");
    card.className = "qr-station-card";
    card.innerHTML = `
      <h4>STAGE ${st.id} BEACON</h4>
      <div class="loc">${st.location}</div>
      <img src="/api/qr/${st.id}" alt="Stage ${st.id} QR Code" />
      <div class="token-code">${st.qr_token}</div>
      <div style="font-size: 0.68rem; color: #64748b; margin-top: 6px;">RYMEC ISE • INFOTSAV 2K26</div>
    `;
    container.appendChild(card);
  });

  document.getElementById("printModal").classList.add("active");
}

function closePrintModal() {
  document.getElementById("printModal").classList.remove("active");
}

// -------------------------------------------------------------
// JUDGE RAPID EVALUATION TEST SUITE (Requirement 09)
// -------------------------------------------------------------
async function runValidStepTest() {
  if (!teamData) return;
  const currId = teamData.current_stage;
  const currStage = allStages.find(s => s.id === currId);
  if (!currStage) return;

  showToast(`[TEST 1/2] Scanning official beacon for Stage ${currId}...`, "info");
  await processScanToken(currStage.qr_token);

  setTimeout(async () => {
    // Fill correct answer
    const answersMap = {
      1: "SECURE_CODE",
      2: "EF",
      3: "SOS CAFE",
      4: "5",
      5: "SES5VICTORY"
    };
    const ans = answersMap[currId];
    document.getElementById("answerInput").value = ans;
    showToast(`[TEST 2/2] Submitting verified key '${ans}' for Stage ${currId}...`, "info");
    
    // Trigger submit
    const solveEvent = new Event("submit");
    document.getElementById("solveForm").dispatchEvent(solveEvent);
  }, 1000);
}

async function runSequenceViolationTest() {
  alarmSound();
  showToast("Testing Anti-Cheat: Attempting to scan Stage 4 Beacon ahead of sequence...", "info");
  // Deliberately scan stage 4 beacon token
  await processScanToken("HUNT-STG4-DELTA-8814");
}

async function runWrongAnswerTest() {
  if (!teamData) return;
  const currId = teamData.current_stage;
  const currStage = allStages.find(s => s.id === currId);

  // First unlock terminal if locked
  if (!teamData.current_unlocked) {
    await processScanToken(currStage.qr_token);
  }

  setTimeout(() => {
    document.getElementById("answerInput").value = "WRONG_GUESS_99";
    showToast("Submitting incorrect key 'WRONG_GUESS_99' to verify penalty...", "info");
    const solveEvent = new Event("submit");
    document.getElementById("solveForm").dispatchEvent(solveEvent);
  }, 800);
}

async function runFullSpeedrunDemo() {
  clickSound();
  showToast("Initiating Full 5-Stage Speedrun Demo for Judges...", "info");

  const stageKeys = [
    { token: "HUNT-STG1-ALPHA-9281", ans: "SECURE_CODE" },
    { token: "HUNT-STG2-BETA-4193", ans: "EF" },
    { token: "HUNT-STG3-GAMMA-7320", ans: "SOS CAFE" },
    { token: "HUNT-STG4-DELTA-8814", ans: "5" },
    { token: "HUNT-STG5-OMEGA-9999", ans: "SES5VICTORY" }
  ];

  let stepIdx = 0;
  async function executeNext() {
    if (stepIdx >= stageKeys.length) {
      showToast("Demo Completed! Master Vault unlocked.", "success");
      switchTab("leaderboard");
      return;
    }
    const curr = stageKeys[stepIdx];
    showToast(`Speedrun: Clearing Stage ${stepIdx + 1}...`, "info");

    await processScanToken(curr.token);
    setTimeout(async () => {
      document.getElementById("answerInput").value = curr.ans;
      const res = await fetch("/api/puzzle/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_name: currentTeam,
          stage_id: stepIdx + 1,
          answer: curr.ans
        })
      });
      const data = await res.json();
      if (data.correct) {
        successSound();
        await refreshTeamStatus();
        stepIdx++;
        setTimeout(executeNext, 1200);
      }
    }, 800);
  }

  executeNext();
}

// Bootstrap on DOM ready
document.addEventListener("DOMContentLoaded", initApp);
