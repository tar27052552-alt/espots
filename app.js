// ==========================================
// app.js — Core Application Logic
// ==========================================

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F'];
const TEAMS_PER_GROUP = 12;
const QUALIFIER_MATCHES = 2;
const FINALS_MATCHES = 3;

const PLACEMENT_POINTS = { first: 5, second: 3, third: 2 };

const GROUP_COLORS = {
  A: '#00f5ff', B: '#ff2d78', C: '#a855f7',
  D: '#00ff88', E: '#ff7a00', F: '#ffd700'
};

// ===== Firebase Init =====
let db = null;
let firebaseApp = null;

function initFirebase() {
  if (!isFirebaseConfigured()) {
    console.warn('[Firebase] ยังไม่ได้กรอก config');
    return false;
  }
  try {
    if (!firebase.apps.length) {
      firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
    } else {
      firebaseApp = firebase.apps[0];
    }
    db = firebase.database();
    console.log('[Firebase] เชื่อมต่อสำเร็จ');
    return true;
  } catch (e) {
    console.error('[Firebase] Error:', e);
    return false;
  }
}

// ===== Database Helpers =====
const DB = {
  ref: (path) => db ? db.ref(path) : null,

  get: async (path) => {
    if (!db) return null;
    const snap = await db.ref(path).get();
    return snap.exists() ? snap.val() : null;
  },

  set: async (path, value) => {
    if (!db) return;
    await db.ref(path).set(value);
  },

  update: async (path, value) => {
    if (!db) return;
    await db.ref(path).update(value);
  },

  increment: async (path, amount = 1) => {
    if (!db) return;
    const snap = await db.ref(path).get();
    const current = snap.exists() ? (snap.val() || 0) : 0;
    await db.ref(path).set(current + amount);
    return current + amount;
  },

  listen: (path, callback) => {
    if (!db) return () => {};
    const ref = db.ref(path);
    ref.on('value', snap => callback(snap.exists() ? snap.val() : null));
    return () => ref.off('value');
  }
};

// ===== Score Calculation =====
function calcQualifierScore(groupId, teamIndex, data) {
  let placement = 0, kills = 0;
  for (let m = 1; m <= QUALIFIER_MATCHES; m++) {
    const match = data?.qualifier?.[groupId]?.[`match${m}`];
    if (!match) continue;
    if (match.placements?.first == teamIndex) placement += PLACEMENT_POINTS.first;
    else if (match.placements?.second == teamIndex) placement += PLACEMENT_POINTS.second;
    else if (match.placements?.third == teamIndex) placement += PLACEMENT_POINTS.third;
    
    const teamKillsObj = match.kills?.[teamIndex];
    if (teamKillsObj) {
      if (typeof teamKillsObj === 'object') {
        Object.values(teamKillsObj).forEach(k => { kills += (k || 0); });
      } else {
        kills += (teamKillsObj || 0);
      }
    }
  }
  return { placement, kills, total: placement + kills };
}

function calcFinalsScore(teamKey, qualScore, data) {
  let placement = 0, kills = 0;
  for (let m = 1; m <= FINALS_MATCHES; m++) {
    const match = data?.finals?.[`match${m}`];
    if (!match) continue;
    if (match.placements?.first === teamKey) placement += PLACEMENT_POINTS.first;
    else if (match.placements?.second === teamKey) placement += PLACEMENT_POINTS.second;
    else if (match.placements?.third === teamKey) placement += PLACEMENT_POINTS.third;
    
    const teamKillsObj = match.kills?.[teamKey];
    if (teamKillsObj) {
      if (typeof teamKillsObj === 'object') {
        Object.values(teamKillsObj).forEach(k => { kills += (k || 0); });
      } else {
        kills += (teamKillsObj || 0);
      }
    }
  }
  return { placement, kills, finalsTotal: placement + kills, grandTotal: qualScore + placement + kills };
}

function getGroupLeaderboard(groupId, data) {
  const teams = data?.config?.teams?.[groupId] || {};
  return Object.entries(teams)
    .map(([idx, team]) => {
      const score = calcQualifierScore(groupId, parseInt(idx), data);
      return { ...team, index: parseInt(idx), ...score };
    })
    .sort((a, b) => b.total - a.total || b.kills - a.kills);
}

function getFinalsLeaderboard(data) {
  const finalists = data?.finalists || {};
  return Object.entries(finalists)
    .map(([key, team]) => {
      const qualScore = team.qualScore || 0;
      const finals = calcFinalsScore(key, qualScore, data);
      return { ...team, key, qualScore, ...finals };
    })
    .sort((a, b) => b.grandTotal - a.grandTotal || b.finalsTotal - a.finalsTotal);
}

// ===== MVP Leaderboards =====
function getGroupMVPLeaderboard(groupId, data) {
  const teams = data?.config?.teams?.[groupId] || {};
  const playersList = [];

  Object.entries(teams).forEach(([tIdx, team]) => {
    const tIdxInt = parseInt(tIdx);
    const players = team.players || [];
    players.forEach((pName, pIdx) => {
      let totalKills = 0;
      for (let m = 1; m <= QUALIFIER_MATCHES; m++) {
        const match = data?.qualifier?.[groupId]?.[`match${m}`];
        totalKills += (match?.kills?.[tIdxInt]?.[pIdx] || 0);
      }
      playersList.push({
        name: pName,
        teamName: team.name,
        teamIndex: parseInt(tIdx),
        playerIndex: pIdx,
        kills: totalKills
      });
    });
  });

  return playersList.sort((a, b) => b.kills - a.kills);
}

function getFinalsMVPLeaderboard(data) {
  const finalists = data?.finalists || {};
  const playersList = [];

  Object.entries(finalists).forEach(([fKey, team]) => {
    const group = team.group;
    const tIdx = team.teamIndex;
    const teamInfo = data?.config?.teams?.[group]?.[tIdx] || {};
    const players = teamInfo.players || team.players || [];
    
    players.forEach((pName, pIdx) => {
      let totalKills = 0;
      for (let m = 1; m <= FINALS_MATCHES; m++) {
        const match = data?.finals?.[`match${m}`];
        totalKills += (match?.kills?.[fKey]?.[pIdx] || 0);
      }
      playersList.push({
        name: pName,
        teamName: team.name,
        group: group,
        teamIndex: tIdx,
        playerIndex: pIdx,
        kills: totalKills
      });
    });
  });

  return playersList.sort((a, b) => b.kills - a.kills);
}

// ===== Toast Notifications =====
function showToast(message, type = 'default', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = { kill: '💀', success: '✅', error: '❌', info: 'ℹ️', default: '🔔' };
  toast.innerHTML = `<span>${icons[type] || icons.default}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ===== Hotkey Manager =====
class HotkeyManager {
  constructor() {
    this.keys = ['1','2','3','4','5','6','7','8','9','0','-','='];
    this.teams = [];
    this.enabled = false;
    this.onKill = null;
    this._handler = this._handler.bind(this);
  }

  setTeams(teams) { this.teams = teams; }

  enable(onKill) {
    this.onKill = onKill;
    this.enabled = true;
    document.addEventListener('keydown', this._handler);
  }

  disable() {
    this.enabled = false;
    document.removeEventListener('keydown', this._handler);
  }

  _handler(e) {
    if (!this.enabled) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

    const idx = this.keys.indexOf(e.key);
    if (idx === -1 || idx >= this.teams.length) return;

    const team = this.teams[idx];
    if (!team) return;

    // Visual feedback
    const keyEl = document.querySelector(`.hotkey-key[data-key="${e.key}"]`);
    if (keyEl) {
      keyEl.classList.add('pressed');
      setTimeout(() => keyEl.classList.remove('pressed'), 200);
    }

    if (this.onKill) this.onKill(idx, team);
  }
}

// ===== Group Color Helpers =====
function getGroupColor(groupId) {
  return GROUP_COLORS[groupId] || '#00f5ff';
}

function getGroupColorDim(groupId) {
  const hex = getGroupColor(groupId).replace('#', '');
  const r = parseInt(hex.slice(0,2), 16);
  const g = parseInt(hex.slice(2,4), 16);
  const b = parseInt(hex.slice(4,6), 16);
  return `rgba(${r},${g},${b},0.12)`;
}

// ===== Default Team Names =====
function getDefaultTeamName(groupId, index) {
  const data = typeof DEFAULT_TEAMS_DATA !== 'undefined' ? DEFAULT_TEAMS_DATA : null;
  if (data && data[groupId]?.[index]) {
    return data[groupId][index].name;
  }
  return `ทีม ${groupId}${index + 1}`;
}

function getDefaultTeamPlayers(groupId, index) {
  const data = typeof DEFAULT_TEAMS_DATA !== 'undefined' ? DEFAULT_TEAMS_DATA : null;
  if (data && data[groupId]?.[index]) {
    return data[groupId][index].players || [];
  }
  return [`${groupId}${index+1}_P1`, `${groupId}${index+1}_P2`, `${groupId}${index+1}_P3`, `${groupId}${index+1}_P4`];
}

// ===== Match Status Helpers =====
function getMatchStatusBadge(status) {
  const map = {
    pending:   { text: 'รอเริ่ม',       cls: 'badge-purple', dot: 'status-pending' },
    active:    { text: 'กำลังแข่ง',     cls: 'badge-green',  dot: 'status-active' },
    completed: { text: 'จบแล้ว',        cls: 'badge-cyan',   dot: 'status-completed' }
  };
  return map[status] || map.pending;
}

// ===== Number formatter =====
function fmtScore(n) { return (n || 0).toString().padStart(2, '0'); }

// ===== Active match URL params =====
function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

// ===== Navigation =====
function navigateTo(url) { window.location.href = url; }

// ===== Check Firebase on page load =====
function requireFirebase() {
  const ok = initFirebase();
  if (!ok) {
    const banner = document.getElementById('firebase-warning');
    if (banner) banner.classList.remove('hidden');
  }
  return ok;
}
