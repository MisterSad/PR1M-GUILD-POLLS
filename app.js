/* ==========================================================================
   [PR1M] GUILD POLLS - Application Core logic (Firebase Cloud Sync Version)
   ========================================================================== */

// Import Firebase SDK functions from official Web CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs, 
  writeBatch 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBnzI-KwojvoI-HoOGfhuWR2aU6i7g2Fvk",
  authDomain: "pr1m-guild-polls.firebaseapp.com",
  projectId: "pr1m-guild-polls",
  storageBucket: "pr1m-guild-polls.firebasestorage.app",
  messagingSenderId: "700597742467",
  appId: "1:700597742467:web:dfd1a4055d5816c75964b6",
  measurementId: "G-PW69ZL0RKT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Timezone Offset Database
const TIMEZONE_DB = [
  { offset: -12, label: "UTC -12:00", cities: "Baker Island, Howland Island" },
  { offset: -11, label: "UTC -11:00", cities: "Midway Atoll, Niue, Pago Pago" },
  { offset: -10, label: "UTC -10:00", cities: "Honolulu (HST), Papeete" },
  { offset: -9, label: "UTC -09:00", cities: "Anchorage (AKST), Gambier Islands" },
  { offset: -8, label: "UTC -08:00", cities: "Los Angeles (PST), Vancouver, Tijuana" },
  { offset: -7, label: "UTC -07:00", cities: "Denver (MST), Calgary, Phoenix" },
  { offset: -6, label: "UTC -06:00", cities: "Chicago (CST), Mexico City, Winnipeg" },
  { offset: -5, label: "UTC -05:00", cities: "New York (EST), Toronto, Lima, Bogota" },
  { offset: -4, label: "UTC -04:00", cities: "Halifax (AST), Caracas, Santiago, La Paz" },
  { offset: -3.5, label: "UTC -03:30", cities: "St. John's (NST)" },
  { offset: -3, label: "UTC -03:00", cities: "Buenos Aires, São Paulo, Nuuk" },
  { offset: -2, label: "UTC -02:00", cities: "South Georgia, Mid-Atlantic" },
  { offset: -1, label: "UTC -01:00", cities: "Azores, Cape Verde" },
  { offset: 0, label: "UTC +00:00", cities: "London (GMT), Dublin, Lisbon, Casablanca" },
  { offset: 1, label: "UTC +01:00", cities: "Paris (CET), Berlin, Rome, Lagos, Kinshasa" },
  { offset: 2, label: "UTC +02:00", cities: "Cairo, Kyiv, Johannesburg, Bucharest" },
  { offset: 3, label: "UTC +03:00", cities: "Moscow (MSK), Istanbul, Riyadh, Nairobi" },
  { offset: 3.5, label: "UTC +03:30", cities: "Tehran" },
  { offset: 4, label: "UTC +04:00", cities: "Dubai, Baku, Tbilisi, Yerevan" },
  { offset: 4.5, label: "UTC +04:30", cities: "Kabul" },
  { offset: 5, label: "UTC +05:00", cities: "Karachi, Tashkent, Yekaterinburg" },
  { offset: 5.5, label: "UTC +05:30", cities: "Mumbai, New Delhi (IST), Colombo" },
  { offset: 5.75, label: "UTC +05:45", cities: "Kathmandu" },
  { offset: 6, label: "UTC +06:00", cities: "Dhaka, Almaty, Omsk" },
  { offset: 6.5, label: "UTC +06:30", cities: "Yangon, Cocos Islands" },
  { offset: 7, label: "UTC +07:00", cities: "Bangkok, Jakarta, Hanoi, Novosibirsk" },
  { offset: 8, label: "UTC +08:00", cities: "Singapore (SGT), Beijing, Manila, Perth" },
  { offset: 9, label: "UTC +09:00", cities: "Tokyo (JST), Seoul, Yakutsk" },
  { offset: 9.5, label: "UTC +09:30", cities: "Adelaide, Darwin" },
  { offset: 10, label: "UTC +10:00", cities: "Sydney (AEST), Melbourne, Vladivostok" },
  { offset: 10.5, label: "UTC +10:30", cities: "Lord Howe Island" },
  { offset: 11, label: "UTC +11:00", cities: "Solomon Islands, Noumea, Magadan" },
  { offset: 12, label: "UTC +12:00", cities: "Auckland (NZST), Fiji, Kamchatka" },
  { offset: 12.75, label: "UTC +12:45", cities: "Chatham Islands" },
  { offset: 13, label: "UTC +13:00", cities: "Nuku'alofa, Apia, Tokelau" },
  { offset: 14, label: "UTC +14:00", cities: "Kiritimati (Line Islands)" }
];

// Hardcoded gaming parameters for automatic calculations
const GAMING_PARAMS = {
  primeStart: 18,  // 18:00 (6 PM) local time
  primeEnd: 23,    // 23:00 (11 PM) local time
  awakeStart: 8    // 08:00 (8 AM) local time
};

// Admin Password (stored as SHA-256 hash of "STELLA2026")
const ADMIN_PASSWORD_HASH = "0902a2d53977b17e2899bf131d948c337cef043f8f7c5caac657c7aa03406315";

// Helper: SHA-256 hashing using native Web Crypto API
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// App State (Synchronized with Firestore in real-time)
let state = {
  roster: []
};

let currentRole = "pending"; // 'pending', 'pilot', 'admin'

// Select DOM Elements
const nicknameInput = document.getElementById("member-nickname");
const timezoneSelect = document.getElementById("member-timezone");
const localTimePreview = document.getElementById("member-local-time");
const citiesPreview = document.getElementById("member-cities-preview");
const voteForm = document.getElementById("vote-form");
const rosterList = document.getElementById("roster-list");
const rosterCountEl = document.getElementById("roster-count");
const dataIoTextarea = document.getElementById("data-io-textarea");

// Login Elements
const loginOverlay = document.getElementById("login-overlay");
const loginChoiceButtons = document.querySelector(".login-choice-buttons");
const btnChoicePilot = document.getElementById("btn-choice-pilot");
const btnChoiceAdmin = document.getElementById("btn-choice-admin-panel");
const adminLoginForm = document.getElementById("admin-login-form");
const adminPasswordInput = document.getElementById("admin-password");
const btnAdminBack = document.getElementById("btn-admin-back");
const loginErrorMsg = document.getElementById("login-error");

// Header elements
const currentRoleBadge = document.getElementById("current-role-badge");
const btnLogout = document.getElementById("btn-logout");

// Init Application
document.addEventListener("DOMContentLoaded", () => {
  populateTimezoneDropdown();
  autoSelectUserTimezone();
  updateTimePreviews();
  
  // Setup Authentication Flow
  setupAuthEvents();
  checkPersistedRole();
  
  // Bind Real-Time Firestore Synchronization
  setupRealtimeSync();
  
  // Start dynamic clock updater (every second)
  setInterval(() => {
    updateTimePreviews();
    updateRosterClocks();
  }, 1000);
  
  // Event Listeners
  voteForm.addEventListener("submit", handleVoteSubmit);
  timezoneSelect.addEventListener("change", handleTimezoneSelectChange);
  
  document.getElementById("btn-simulate").addEventListener("click", simulateRoster);
  document.getElementById("btn-clear-roster").addEventListener("click", clearRoster);
  document.getElementById("btn-export-data").addEventListener("click", exportRosterData);
  document.getElementById("btn-import-data").addEventListener("click", importRosterData);
});

// Setup Realtime Synchronization with Cloud Firestore
function setupRealtimeSync() {
  onSnapshot(collection(db, "pilots"), (snapshot) => {
    const updatedRoster = [];
    snapshot.forEach(doc => {
      updatedRoster.push(doc.data());
    });
    
    // Sort alphabetically by pilot nickname to prevent layout shifting
    updatedRoster.sort((a, b) => a.name.localeCompare(b.name));
    
    state.roster = updatedRoster;
    
    // Re-render and recalculate in real-time
    renderRoster();
    recalculateAll();
  }, (error) => {
    console.error("Firestore sync error: ", error);
    alert("Firestore Sync Error: " + error.message + "\nCode: " + error.code);
  });
}

// Setup Authentication Events
function setupAuthEvents() {
  btnChoicePilot.addEventListener("click", () => {
    loginAsRole("pilot");
  });
  
  btnChoiceAdmin.addEventListener("click", () => {
    loginChoiceButtons.classList.add("id-hidden");
    adminLoginForm.classList.remove("admin-form-hidden");
    adminPasswordInput.focus();
  });
  
  btnAdminBack.addEventListener("click", () => {
    adminLoginForm.classList.add("admin-form-hidden");
    loginChoiceButtons.classList.remove("id-hidden");
    adminPasswordInput.value = "";
    loginErrorMsg.classList.add("id-hidden");
  });
  
  adminLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const enteredPass = adminPasswordInput.value;
      const hashedPass = await sha256(enteredPass);
      if (hashedPass === ADMIN_PASSWORD_HASH) {
        loginAsRole("admin");
      } else {
        loginErrorMsg.classList.remove("id-hidden");
        adminPasswordInput.value = "";
        adminPasswordInput.focus();
      }
    } catch (err) {
      alert("Verification failed: " + err.message);
    }
  });
  
  btnLogout.addEventListener("click", () => {
    logout();
  });
}

// Log in as specified role
function loginAsRole(role) {
  currentRole = role;
  sessionStorage.setItem("guild_poll_current_role", role);
  
  // Remove pending overlays
  document.body.classList.remove("role-pending");
  loginOverlay.classList.add("id-hidden");
  
  // Apply role specific class hooks to document body
  if (role === "admin") {
    document.body.classList.remove("user-role-pilot");
    document.body.classList.add("user-role-admin");
    currentRoleBadge.textContent = "Administrator";
  } else {
    document.body.classList.remove("user-role-admin");
    document.body.classList.add("user-role-pilot");
    currentRoleBadge.textContent = "Pilot";
  }
  
  // Trigger rendering and calculations
  renderRoster();
  recalculateAll();
}

// Log out and show login page
function logout() {
  currentRole = "pending";
  sessionStorage.removeItem("guild_poll_current_role");
  
  document.body.classList.add("role-pending");
  document.body.classList.remove("user-role-pilot", "user-role-admin");
  
  loginOverlay.classList.remove("id-hidden");
  adminLoginForm.classList.add("admin-form-hidden");
  loginChoiceButtons.classList.remove("id-hidden");
  adminPasswordInput.value = "";
  loginErrorMsg.classList.add("id-hidden");
}

// Check if user is already authenticated in this session
function checkPersistedRole() {
  const savedRole = sessionStorage.getItem("guild_poll_current_role");
  if (savedRole === "pilot" || savedRole === "admin") {
    loginAsRole(savedRole);
  } else {
    logout();
  }
}

// Populate timezone selector
function populateTimezoneDropdown() {
  timezoneSelect.innerHTML = "";
  TIMEZONE_DB.forEach(tz => {
    const option = document.createElement("option");
    option.value = tz.offset;
    option.textContent = `${tz.label} - (${tz.cities.substring(0, 45)}${tz.cities.length > 45 ? '...' : ''})`;
    timezoneSelect.appendChild(option);
  });
}

// Auto detect system timezone and select appropriate option
function autoSelectUserTimezone() {
  const offsetMin = new Date().getTimezoneOffset();
  const offsetHours = -offsetMin / 60;
  
  let closest = TIMEZONE_DB[0];
  let minDiff = Math.abs(TIMEZONE_DB[0].offset - offsetHours);
  
  TIMEZONE_DB.forEach(tz => {
    const diff = Math.abs(tz.offset - offsetHours);
    if (diff < minDiff) {
      minDiff = diff;
      closest = tz;
    }
  });
  
  timezoneSelect.value = closest.offset;
  updateTimezonePreview();
}

// Update timezone detail labels under dropdown
function updateTimezonePreview() {
  const selectedOffset = parseFloat(timezoneSelect.value);
  const tz = TIMEZONE_DB.find(t => t.offset === selectedOffset);
  if (tz) {
    citiesPreview.textContent = tz.cities;
    updateTimePreviews();
  }
}

function handleTimezoneSelectChange() {
  updateTimezonePreview();
}

// Compute local time for specific offset
function getLocalTimeForOffset(offset) {
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  const localDate = new Date(utcMs + (3600000 * offset));
  return localDate;
}

// Formats date object to HH:MM:SS
function formatTime(date) {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// Update clock previews
function updateTimePreviews() {
  const selectedOffset = parseFloat(timezoneSelect.value);
  const localDate = getLocalTimeForOffset(selectedOffset);
  localTimePreview.textContent = formatTime(localDate);
}

// Recalculate calculations
function recalculateAll() {
  calculateRecommendations();
  renderHeatmap();
}

// Add/Update member timezone selection
async function handleVoteSubmit(e) {
  e.preventDefault();
  
  const nickname = nicknameInput.value.trim();
  const offset = parseFloat(timezoneSelect.value);
  
  if (!nickname) return;
  
  const docId = nickname.toLowerCase().replace(/\s+/g, "_");
  
  const submitBtn = document.getElementById("btn-submit-vote");
  submitBtn.disabled = true;
  
  try {
    // Write directly to Cloud Firestore
    await setDoc(doc(db, "pilots", docId), {
      id: docId,
      name: nickname,
      offset: offset,
      timestamp: Date.now()
    });
    
    nicknameInput.value = "";
    
    // Flash submission status
    submitBtn.style.background = "linear-gradient(135deg, #10b981, #059669)";
    submitBtn.querySelector("span").textContent = "Availability submitted!";
  } catch (err) {
    console.error("Firestore setDoc failed:", err);
    alert("Firestore Submit Error: " + err.message + "\nCheck if database is created and security rules allow public write.");
    submitBtn.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
    submitBtn.querySelector("span").textContent = "Sync Error!";
  } finally {
    submitBtn.disabled = false;
    setTimeout(() => {
      submitBtn.style.background = "";
      submitBtn.querySelector("span").textContent = "Submit Availability";
    }, 2000);
  }
}

// Compute player status at specific UTC hour
function getPlayerStatusAtHour(playerOffset, utcHour) {
  let localHour = Math.floor((utcHour + playerOffset + 24) % 24);
  const { primeStart, primeEnd, awakeStart } = GAMING_PARAMS;
  
  let isOptimal = localHour >= primeStart && localHour <= primeEnd;
  if (isOptimal) {
    return { status: "optimal", score: 1.0, label: "Optimal (Evening)" };
  }
  
  let isAwake = localHour >= awakeStart && localHour < 24;
  if (isAwake) {
    return { status: "available", score: 0.5, label: "Available" };
  }
  
  return { status: "sleeping", score: 0.0, label: "Sleeping" };
}

// Roster Rendering
function renderRoster() {
  rosterCountEl.textContent = state.roster.length;
  
  if (state.roster.length === 0) {
    rosterList.innerHTML = `
      <tr class="empty-state-row">
        <td colspan="5" class="empty-state">No pilots registered. Add your nickname above or ask the admin to run a simulation!</td>
      </tr>
    `;
    return;
  }
  
  rosterList.innerHTML = "";
  
  state.roster.forEach(player => {
    const tz = TIMEZONE_DB.find(t => t.offset === player.offset);
    const tzLabel = tz ? tz.label.split(" ")[1] : `UTC${player.offset >= 0 ? '+' : ''}${player.offset}`;
    
    const localDate = getLocalTimeForOffset(player.offset);
    const localTimeStr = formatTime(localDate).substring(0, 5);
    
    const currentUtcHour = new Date().getUTCHours();
    const statusData = getPlayerStatusAtHour(player.offset, currentUtcHour);
    
    let statusLabel = "Sleeping";
    if (statusData.status === "optimal") statusLabel = "Optimal (Evening)";
    else if (statusData.status === "available") statusLabel = "Available";
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="pilot-name">${escapeHtml(player.name)}</span></td>
      <td><span class="utc-offset-badge">${tzLabel}</span></td>
      <td class="player-local-clock" data-offset="${player.offset}">${localTimeStr}</td>
      <td><span class="status-badge ${statusData.status}">${statusLabel}</span></td>
      <td class="admin-only">
        <button class="btn btn-danger btn-sm" onclick="removePlayer('${player.id}')">Remove</button>
      </td>
    `;
    rosterList.appendChild(tr);
  });
}

// Periodic clock updates inside roster table
function updateRosterClocks() {
  const clockCells = document.querySelectorAll(".player-local-clock");
  clockCells.forEach(cell => {
    const offset = parseFloat(cell.getAttribute("data-offset"));
    const localDate = getLocalTimeForOffset(offset);
    cell.textContent = formatTime(localDate).substring(0, 5);
    
    const row = cell.closest("tr");
    const badge = row.querySelector(".status-badge");
    const currentUtcHour = new Date().getUTCHours();
    const statusData = getPlayerStatusAtHour(offset, currentUtcHour);
    
    let statusLabel = "Sleeping";
    if (statusData.status === "optimal") statusLabel = "Optimal (Evening)";
    else if (statusData.status === "available") statusLabel = "Available";
    
    badge.className = `status-badge ${statusData.status}`;
    badge.textContent = statusLabel;
  });
}

// Remove player (Admin Only - Syncs to Cloud)
window.removePlayer = async function(id) {
  if (currentRole !== "admin") {
    alert("Action denied: Only administrators can remove players.");
    return;
  }
  
  try {
    await deleteDoc(doc(db, "pilots", id));
  } catch (err) {
    console.error("Firestore deleteDoc failed:", err);
    alert("Failed to remove player from database.");
  }
};

// Clear entire roster (Admin Only - Syncs to Cloud)
async function clearRoster() {
  if (currentRole !== "admin") return;
  
  if (confirm("Are you sure you want to remove all players from the poll?")) {
    try {
      const querySnapshot = await getDocs(collection(db, "pilots"));
      const batch = writeBatch(db);
      
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
    } catch (err) {
      console.error("Firestore batch delete failed:", err);
      alert("Failed to clear database.");
    }
  }
}

// Recommendation Engine Algorithm
function calculateRecommendations() {
  const numPlayers = state.roster.length;
  
  if (numPlayers === 0) {
    resetRecommendations();
    return;
  }
  
  const hoursData = [];
  
  for (let h = 0; h < 24; h++) {
    let score = 0;
    let optimalCount = 0;
    let availableCount = 0;
    let sleepingCount = 0;
    
    state.roster.forEach(player => {
      const pStatus = getPlayerStatusAtHour(player.offset, h);
      score += pStatus.score;
      if (pStatus.status === "optimal") optimalCount++;
      else if (pStatus.status === "available") availableCount++;
      else sleepingCount++;
    });
    
    hoursData.push({
      hour: h,
      score: score,
      optimal: optimalCount,
      available: availableCount,
      sleeping: sleepingCount,
      percentage: Math.round(((optimalCount + (availableCount * 0.5)) / numPlayers) * 100)
    });
  }
  
  const sortedHours = [...hoursData].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.optimal !== a.optimal) return b.optimal - a.optimal;
    return a.hour - b.hour;
  });
  
  const rec1 = sortedHours[0];
  const rec2 = sortedHours[1];
  
  displayRecommendation(1, rec1, numPlayers);
  displayRecommendation(2, rec2, numPlayers);
  
  highlightHeatmapBars(rec1.hour, rec2.hour);
}

function resetRecommendations() {
  const elements = [
    { id: 1, label: "Add members to begin the analysis." },
    { id: 2, label: "Calculation in progress..." }
  ];
  
  elements.forEach(item => {
    document.getElementById(`rec-time-${item.id}`).textContent = "--:-- UTC";
    document.getElementById(`rec-local-time-${item.id}`).textContent = "(--:-- Local time)";
    document.getElementById(`rec-percentage-${item.id}`).textContent = "0%";
    document.getElementById(`rec-fill-${item.id}`).style.width = "0%";
    document.getElementById(`rec-details-${item.id}`).textContent = item.label;
  });
}

function displayRecommendation(slotNum, rec, totalPlayers) {
  const now = new Date();
  const timezoneOffsetHrs = -now.getTimezoneOffset() / 60;
  const adminLocalHour = (rec.hour + timezoneOffsetHrs + 24) % 24;
  
  const utcTimeStr = `${rec.hour.toString().padStart(2, '0')}:00 UTC`;
  
  const adminMins = Math.round((adminLocalHour % 1) * 60);
  const adminHourInt = Math.floor(adminLocalHour);
  const localTimeStr = `${adminHourInt.toString().padStart(2, '0')}:${adminMins.toString().padStart(2, '0')} Your Time`;
  
  const totalScorePercentage = Math.round((rec.score / totalPlayers) * 100);
  
  document.getElementById(`rec-time-${slotNum}`).textContent = utcTimeStr;
  document.getElementById(`rec-local-time-${slotNum}`).textContent = `(${localTimeStr})`;
  document.getElementById(`rec-percentage-${slotNum}`).textContent = `${totalScorePercentage}%`;
  document.getElementById(`rec-fill-${slotNum}`).style.width = `${totalScorePercentage}%`;
  
  const optimalPercent = Math.round((rec.optimal / totalPlayers) * 100);
  const awakePercent = Math.round((rec.available / totalPlayers) * 100);
  
  let details = `Optimal (evening) for ${rec.optimal}/${totalPlayers} players (${optimalPercent}%). `;
  details += `Available in daytime for ${rec.available} players (${awakePercent}%). `;
  details += `${rec.sleeping} player(s) sleeping.`;
  
  document.getElementById(`rec-details-${slotNum}`).textContent = details;
}

// Render Heatmap Chart
function renderHeatmap() {
  const container = document.getElementById("heatmap-bars");
  container.innerHTML = "";
  
  const numPlayers = state.roster.length;
  
  for (let h = 0; h < 24; h++) {
    const bar = document.createElement("div");
    bar.className = `heatmap-bar hour-${h}`;
    bar.setAttribute("data-hour", h);
    
    const label = document.createElement("span");
    label.className = "bar-label";
    label.textContent = h.toString().padStart(2, '0');
    bar.appendChild(label);
    
    if (numPlayers > 0) {
      let optimalCount = 0;
      let availableCount = 0;
      let sleepingCount = 0;
      
      const optimalNames = [];
      const availableNames = [];
      const sleepingNames = [];
      
      state.roster.forEach(player => {
        const pStatus = getPlayerStatusAtHour(player.offset, h);
        if (pStatus.status === "optimal") {
          optimalCount++;
          optimalNames.push(player.name);
        } else if (pStatus.status === "available") {
          availableCount++;
          availableNames.push(player.name);
        } else {
          sleepingCount++;
          sleepingNames.push(player.name);
        }
      });
      
      const optimalHeight = (optimalCount / numPlayers) * 100;
      const availableHeight = (availableCount / numPlayers) * 100;
      const sleepingHeight = (sleepingCount / numPlayers) * 100;
      
      if (optimalHeight > 0) {
        const optSeg = document.createElement("div");
        optSeg.className = "bar-segment optimal";
        optSeg.style.height = `${optimalHeight}%`;
        bar.appendChild(optSeg);
      }
      if (availableHeight > 0) {
        const availSeg = document.createElement("div");
        availSeg.className = "bar-segment available";
        availSeg.style.height = `${availableHeight}%`;
        bar.appendChild(availSeg);
      }
      if (sleepingHeight > 0) {
        const sleepSeg = document.createElement("div");
        sleepSeg.className = "bar-segment sleeping";
        sleepSeg.style.height = `${sleepingHeight}%`;
        bar.appendChild(sleepSeg);
      }
      
      let tooltipText = `Hour: ${h.toString().padStart(2, '0')}:00 UTC\n`;
      tooltipText += `-----------------------\n`;
      tooltipText += `🟢 Optimal (Evening): ${optimalCount} (${Math.round(optimalHeight)}%)\n`;
      tooltipText += `🟣 Available: ${availableCount} (${Math.round(availableHeight)}%)\n`;
      tooltipText += `🔴 Sleeping: ${sleepingCount} (${Math.round(sleepingHeight)}%)`;
      
      bar.setAttribute("data-tooltip", tooltipText);
    } else {
      const emptySeg = document.createElement("div");
      emptySeg.className = "bar-segment sleeping";
      emptySeg.style.height = "100%";
      bar.appendChild(emptySeg);
      bar.setAttribute("data-tooltip", `Hour: ${h.toString().padStart(2, '0')}:00 UTC\nNo pilots registered.`);
    }
    
    container.appendChild(bar);
  }
}

// Highlight recommendation bars in heatmap
function highlightHeatmapBars(primeHour, altHour) {
  document.querySelectorAll(".heatmap-bar").forEach(bar => {
    bar.classList.remove("active-recommendation", "active-alternative");
  });
  
  const primeBar = document.querySelector(`.heatmap-bar.hour-${primeHour}`);
  if (primeBar) primeBar.classList.add("active-recommendation");
  
  const altBar = document.querySelector(`.heatmap-bar.hour-${altHour}`);
  if (altBar) altBar.classList.add("active-alternative");
}

// Roster simulation generator (Admin Only - Syncs to Cloud)
async function simulateRoster() {
  if (currentRole !== "admin") return;
  
  const names = [
    "Commander Nova", "StarLord", "Xylar", "Astra V", "Vortex", 
    "Nebula Prime", "Zenix", "Talon", "Quasar", "Eclipse", 
    "Lyra Sky", "Solara", "Vega", "Orion", "Apex", 
    "Chronos", "Atlas", "Specter", "Helix", "Siren",
    "Starlight", "VoidWalker", "Kaelen", "Valerius", "Zephyr"
  ];
  
  const commonOffsets = [-8, -5, -3, 0, 1, 2, 3, 5.5, 8, 9, 10, 12];
  const count = 20;
  const shuffledNames = [...names].sort(() => 0.5 - Math.random());
  
  try {
    const batch = writeBatch(db);
    
    for (let i = 0; i < count; i++) {
      const randomOffset = commonOffsets[Math.floor(Math.random() * commonOffsets.length)];
      const nickname = shuffledNames[i];
      const docId = nickname.toLowerCase().replace(/\s+/g, "_");
      
      batch.set(doc(db, "pilots", docId), {
        id: docId,
        name: nickname,
        offset: randomOffset,
        timestamp: Date.now() + i
      });
    }
    
    await batch.commit();
  } catch (err) {
    console.error("Firestore batch write (simulation) failed:", err);
    alert("Failed to write simulated players to database.");
  }
}

// Export roster data (Admin Only)
function exportRosterData() {
  if (currentRole !== "admin") return;
  
  const jsonStr = JSON.stringify(state.roster, null, 2);
  dataIoTextarea.value = jsonStr;
  
  dataIoTextarea.select();
  try {
    document.execCommand("copy");
    alert("Player list has been copied to your clipboard!");
  } catch (err) {
    alert("Copy failed. Please copy the text displayed in the box manually.");
  }
}

// Import roster data (Admin Only - Syncs to Cloud)
async function importRosterData() {
  if (currentRole !== "admin") return;
  
  const rawData = dataIoTextarea.value.trim();
  if (!rawData) {
    alert("Please paste the list JSON code into the text area first.");
    return;
  }
  
  try {
    const importedRoster = JSON.parse(rawData);
    
    if (!Array.isArray(importedRoster)) {
      throw new Error("JSON format must be an array of objects.");
    }
    
    const validatedRoster = [];
    importedRoster.forEach((item, idx) => {
      if (!item.name || typeof item.offset !== "number") {
        throw new Error(`Invalid pilot at index ${idx}. A name string ('name') and a numeric offset ('offset') are required.`);
      }
      validatedRoster.push({
        id: item.id || (Date.now().toString() + idx + Math.random().toString(36).substr(2, 5)),
        name: String(item.name).trim(),
        offset: parseFloat(item.offset)
      });
    });
    
    const batch = writeBatch(db);
    validatedRoster.forEach(player => {
      const docId = player.name.toLowerCase().replace(/\s+/g, "_");
      batch.set(doc(db, "pilots", docId), {
        id: docId,
        name: player.name,
        offset: player.offset,
        timestamp: Date.now()
      });
    });
    
    await batch.commit();
    dataIoTextarea.value = "";
    alert(`Successfully imported ${validatedRoster.length} guild pilots!`);
  } catch (err) {
    alert(`Import failed: ${err.message}`);
  }
}

// Escape HTML utility
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
