'use strict';

/* ─────────────────────────────────────
   CONSTANTS
───────────────────────────────────── */
const TYPE_INFO = {
  GBHS:  { label:'Boys High School',              min:6,  max:10 },
  GBPS:  { label:'Boys Primary School',           min:0,  max:5  },
  GGPS:  { label:'Girls Primary School',          min:0,  max:5  },
  GBELS: { label:'Boys Elementary Lower School',  min:0,  max:8  },
  GGELS: { label:'Girls Elementary Lower School', min:0,  max:8  },
  GGHS:  { label:'Girls Higher Secondary School', min:6,  max:12 },
};

function classLabel(cls) {
  const n = Number(cls);
  if (n === 0) return 'Katchi / ECE';
  return `Class ${cls}`;
}

function classTag(cls) {
  const n = Number(cls);
  if (n === 0) return 'KATCHI / ECE';
  return `CLASS ${cls}`;
}

function formatClassRange(min, max) {
  const nMin = Number(min);
  const nMax = Number(max);
  if (nMin === 0) return `Katchi to Class ${nMax}`;
  return `Class ${nMin} to Class ${nMax}`;
}
const FURNITURE_OPTS = [
  { v:'available',    l:'Available'    },
  { v:'shortage',     l:'Shortage'     },
  { v:'not_available',l:'Not Available'},
];
const MEDIUM_OPTS = [
  { v:'sindhi',  l:'Sindhi'         },
  { v:'urdu',    l:'Urdu'           },
  { v:'english', l:'English'        },
  { v:'both',    l:'Sindhi + Urdu'  },
];

/* ─────────────────────────────────────
   STATE
───────────────────────────────────── */
const state = {
  clusters: [],
  activeCode: 'KX03099',
  authUser: null,
  pendingPanel: null,
  currentSchoolId: null,
};
try { const s = localStorage.getItem('hubClusterAdminUser'); if (s) state.authUser = JSON.parse(s); } catch (_) {}

/* ─────────────────────────────────────
   DOM REFS
───────────────────────────────────── */
const dbDot       = document.getElementById('dbDot');
const dbStatusTxt = document.getElementById('dbStatusText');
const syncStatus  = document.getElementById('syncStatus');
const toastEl     = document.getElementById('toast');
let toastTimer;

/* ─────────────────────────────────────
   UTILITIES
───────────────────────────────────── */
function toast(msg, type = 'ok', dur = 2800) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.className = `show ${type}`;
  toastTimer = setTimeout(() => { toastEl.className = ''; }, dur);
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function classNums(school) {
  const a = [];
  for (let i = school.classMin; i <= school.classMax; i++) a.push(i);
  return a;
}

function classTotals(cd) {
  const g = (Number(cd.boys) || 0) + (Number(cd.girls) || 0);
  const r = (Number(cd.muslim) || 0) + (Number(cd.nonMuslim) || 0);
  // medium is now a dropdown (not a split), so we only validate religion vs gender
  const match = (g === r);
  const diffs = [];
  if (r !== g) diffs.push({ field:'Religion', diff: r - g });
  return { g, r, match, diffs };
}

function schoolTotals(school) {
  let boys=0, girls=0, muslim=0, nonMuslim=0, sections=0;
  // count classes by medium type
  const medCount = { sindhi:0, urdu:0, english:0, both:0 };
  let match = true;
  classNums(school).forEach(c => {
    const cd = school.classes[c] || {};
    boys    += Number(cd.boys)   ||0;
    girls   += Number(cd.girls)  ||0;
    muslim  += Number(cd.muslim) ||0;
    nonMuslim += Number(cd.nonMuslim)||0;
    sections  += Number(cd.sections) ||0;
    const med = cd.medium || 'sindhi';
    if (medCount[med] !== undefined) medCount[med]++;
    if (!classTotals(cd).match) match = false;
  });
  return { boys, girls, muslim, nonMuslim, sections, total: boys+girls, match, medCount };
}

function clusterTotals(cluster) {
  const g = { boys:0, girls:0, muslim:0, nonMuslim:0, sections:0, total:0, medCount:{sindhi:0,urdu:0,english:0,both:0} };
  if (!cluster) return g;
  cluster.schools.forEach(s => {
    const t = schoolTotals(s);
    g.boys      += t.boys;
    g.girls     += t.girls;
    g.muslim    += t.muslim;
    g.nonMuslim += t.nonMuslim;
    g.sections  += t.sections;
    g.total     += t.total;
    Object.keys(g.medCount).forEach(k => { g.medCount[k] += t.medCount[k] || 0; });
  });
  return g;
}

function activeCluster() {
  return state.clusters.find(c => c.code === state.activeCode) || state.clusters[0];
}

function sectionLabel(n) {
  n = Number(n) || 0;
  return n === 0 ? 'No Section' : n === 1 ? '1 Section' : `${n} Sections`;
}

/* ─────────────────────────────────────
   API
───────────────────────────────────── */
async function api(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  return r.json();
}

async function checkHealth() {
  try {
    const d = await api('GET', '/api/health');
    if (d.db === 'connected') {
      if (dbDot) dbDot.className = 'dot';
      if (dbStatusTxt && isAdmin()) {
        dbStatusTxt.textContent = `PostgreSQL connected — ${d.database} · ${d.latencyMs}ms`;
      }
    } else throw new Error(d.error);
  } catch (e) {
    if (dbDot) dbDot.className = 'dot err';
    if (dbStatusTxt && isAdmin()) {
      dbStatusTxt.textContent = 'Database disconnected';
    }
  }
}

async function openHealthModal() {
  const modal = document.getElementById('healthModal');
  if (!modal) return;
  modal.classList.add('open');
  await refreshHealthModal();
}

function closeHealthModal() {
  const modal = document.getElementById('healthModal');
  if (modal) modal.classList.remove('open');
}

async function refreshHealthModal() {
  const btn = document.getElementById('btnRefreshHealth');
  const banner = document.getElementById('healthModalBanner');
  const dot = document.getElementById('healthModalDot');
  const statusTxt = document.getElementById('healthModalStatus');
  const subTxt = document.getElementById('healthModalSub');
  const dbName = document.getElementById('hmDbName');
  const latency = document.getElementById('hmLatency');
  const code = document.getElementById('hmClusterCode');
  const schools = document.getElementById('hmSchoolsCount');
  const ts = document.getElementById('hmTimestamp');

  if (btn) btn.innerHTML = '<span>↻</span> <span>Testing…</span>';
  if (dot) dot.className = 'dot';
  if (statusTxt) statusTxt.textContent = 'Pinging PostgreSQL Neon Cloud…';

  try {
    const d = await api('GET', '/api/health');
    if (d.db === 'connected') {
      if (dot) dot.className = 'dot';
      if (statusTxt) statusTxt.textContent = 'Connected to PostgreSQL (Healthy)';
      if (subTxt) subTxt.textContent = `Serverless Neon Cloud PostgreSQL • ${d.latencyMs}ms query response`;
      if (banner) {
        banner.style.background = '#f0fdf4';
        banner.style.borderColor = '#86efac';
      }
      if (dbName) dbName.textContent = d.database || 'neondb';
      if (latency) latency.textContent = `${d.latencyMs} ms`;
      if (code) code.textContent = state.activeCode || 'KX03099';
      const cluster = activeCluster();
      if (schools) schools.textContent = cluster ? `${cluster.schools.length} Schools` : '23 Schools';
      if (ts) ts.textContent = new Date().toLocaleString();
    } else {
      throw new Error(d.error || 'Connection error');
    }
  } catch (err) {
    if (dot) dot.className = 'dot err';
    if (statusTxt) statusTxt.textContent = 'Connection Error / Degraded';
    if (subTxt) subTxt.textContent = err.message || 'Could not ping database';
    if (banner) {
      banner.style.background = '#fef2f2';
      banner.style.borderColor = '#fca5a5';
    }
    if (latency) latency.textContent = 'Timeout';
  } finally {
    if (btn) btn.innerHTML = '<span>↻</span> <span>Run Diagnostic Ping</span>';
  }
}

window.openHealthModal = openHealthModal;
window.closeHealthModal = closeHealthModal;
window.refreshHealthModal = refreshHealthModal;


async function loadData() {
  syncStatus.textContent = 'Loading…';
  try {
    const d = await api('GET', '/api/clusters');
    if (d.success && d.clusters.length) {
      state.clusters = d.clusters;
      if (!state.clusters.find(c => c.code === state.activeCode))
        state.activeCode = state.clusters[0].code;
      syncStatus.textContent = 'Synced';
      populateSchoolSelect();
      updateSidebarCard();
      updateProgressKPIs();
      renderSchoolsGrid();
      updateAuthUI();
      if (isAdmin()) loadSubmissionsReport(false);
      // Set default school ID without auto-navigating away from directory grid
      const sel = document.getElementById('entrySchoolSelect');
      const cluster = activeCluster();
      if (cluster && cluster.schools.length) {
        if (!state.currentSchoolId) state.currentSchoolId = cluster.schools[0].id;
        if (sel && !sel.value) sel.value = state.currentSchoolId;
      }
    }
  } catch (e) {
    syncStatus.textContent = 'Sync error';
    toast('Failed to load: ' + e.message, 'err');
  }
}

async function saveClasses(schoolId, classesObj) {
  const d = await api('PUT', `/api/schools/${schoolId}/classes`, { classes: classesObj });
  if (!d.success) throw new Error(d.error);
  return true;
}

/* ─────────────────────────────────────
   AUTH
───────────────────────────────────── */
function isAdmin() { return !!state.authUser; }

function openModal() {
  document.getElementById('authModal').classList.add('open');
  document.getElementById('loginErr').style.display = 'none';
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  setTimeout(() => document.getElementById('loginUser').focus(), 60);
}
function closeModal() {
  document.getElementById('authModal').classList.remove('open');
  state.pendingPanel = null;
}
document.getElementById('authModal').addEventListener('click', e => {
  if (e.target === document.getElementById('authModal')) closeModal();
});

async function submitLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const errEl    = document.getElementById('loginErr');
  const btn      = document.getElementById('loginBtn');
  const lbl      = document.getElementById('loginBtnLbl');
  btn.disabled = true; lbl.textContent = 'Verifying…';
  errEl.style.display = 'none';
  try {
    const d = await api('POST', '/api/auth/login', { username, password });
    if (d.success) {
      state.authUser = d.user;
      localStorage.setItem('hubClusterAdminUser', JSON.stringify(d.user));
      closeModal(); updateAuthUI();
      toast(`Welcome, ${d.user.username}!`, 'ok');
      if (state.pendingPanel) switchPanel(state.pendingPanel);
    } else {
      errEl.textContent = d.error || 'Invalid credentials';
      errEl.style.display = 'block';
    }
  } catch (err) {
    errEl.textContent = 'Server error: ' + err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false; lbl.textContent = 'Unlock Admin Access';
  }
}

function doLogout() {
  if (!confirm('Sign out of admin account?')) return;
  state.authUser = null;
  localStorage.removeItem('hubClusterAdminUser');
  updateAuthUI(); switchPanel('enrollment');
  toast('Signed out', 'ok');
}

function requireAdmin(panel) {
  if (isAdmin()) { switchPanel(panel); }
  else { state.pendingPanel = panel; openModal(); }
}

function updateAuthUI() {
  const admin = isAdmin();
  document.body.classList.toggle('is-admin', admin);
  const dbStatusPill = document.getElementById('dbStatusPill');
  if (dbStatusPill) dbStatusPill.style.display = admin ? 'inline-flex' : 'none';
  const syncStatus = document.getElementById('syncStatus');
  if (syncStatus) syncStatus.style.display = admin ? 'inline-flex' : 'none';
  const loginBtn = document.getElementById('openLoginBtn');
  const userChip = document.getElementById('navUserChip');
  if (loginBtn) loginBtn.style.display = admin ? 'none' : 'block';
  if (userChip) {
    userChip.style.display = admin ? 'flex' : 'none';
    if (admin) {
      document.getElementById('navAvatar').textContent = (state.authUser.username || 'A')[0].toUpperCase();
      document.getElementById('navUsername').textContent = state.authUser.username;
    }
  }
  const mobileLoginBtn = document.getElementById('mobileLoginBtn');
  if (mobileLoginBtn) {
    if (admin) {
      mobileLoginBtn.title = `Admin: ${state.authUser.username} (Tap to logout)`;
      mobileLoginBtn.innerHTML = `<span style="font-size:11px;font-weight:700;color:var(--success);background:#dcfce7;padding:3px 6px;border-radius:4px">👤 Admin</span>`;
      mobileLoginBtn.onclick = doLogout;
    } else {
      mobileLoginBtn.title = 'Admin Login';
      mobileLoginBtn.innerHTML = `<span style="font-size:15px">🔒</span>`;
      mobileLoginBtn.onclick = openModal;
    }
  }
  ['sbDashLock','sbSchoolsLock','sbExportLock','sbSubLock'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = admin ? 'none' : 'inline-flex';
  });
  const sbAccess = document.getElementById('sbAccess');
  if (sbAccess)
    sbAccess.innerHTML = admin
      ? `<span style="color:var(--primary)">🟢 Admin: ${state.authUser.username}</span>`
      : 'Public Entry';
}

/* ─────────────────────────────────────
   MOBILE DRAWER & COLLAPSIBLE BANNER
───────────────────────────────────── */
function toggleSidebar(forceState) {
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sidebarBackdrop');
  if (!sb) return;
  const shouldOpen = (typeof forceState === 'boolean') ? forceState : !sb.classList.contains('sb-open');
  if (shouldOpen) {
    sb.classList.add('sb-open');
    if (bd) bd.classList.add('active');
    document.body.classList.add('sb-noscroll');
  } else {
    sb.classList.remove('sb-open');
    if (bd) bd.classList.remove('active');
    document.body.classList.remove('sb-noscroll');
  }
}

function toggleLetterhead(forceState) {
  const lh = document.getElementById('letterhead');
  const sb = document.getElementById('statusBar');
  const icon = document.getElementById('bannerToggleIcon');
  const label = document.getElementById('bannerToggleLabel');
  if (!lh) return;
  const isHidden = (typeof forceState === 'boolean') ? forceState : !lh.classList.contains('banner-hidden');
  if (isHidden) {
    lh.classList.add('banner-hidden');
    if (sb) sb.classList.add('banner-hidden');
    if (icon) icon.textContent = 'ℹ️';
    if (label) label.textContent = 'Info';
  } else {
    lh.classList.remove('banner-hidden');
    if (sb) sb.classList.remove('banner-hidden');
    if (icon) icon.textContent = '✕';
    if (label) label.textContent = 'Hide';
  }
}

window.toggleSidebar = toggleSidebar;
window.toggleLetterhead = toggleLetterhead;

/* ─────────────────────────────────────
   PANEL NAVIGATION
───────────────────────────────────── */
function switchPanel(name) {
  if (window.innerWidth <= 768) {
    toggleSidebar(false);
  }
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-item[id^="sb"]').forEach(i => i.classList.remove('active'));
  const panel = document.getElementById(`panel-${name}`);
  if (panel) panel.classList.add('active');
  const sb = document.getElementById(`sb${name.charAt(0).toUpperCase() + name.slice(1)}`);
  if (sb) sb.classList.add('active');

  const cluster = activeCluster();
  const currentSchool = cluster?.schools.find(s => s.id === state.currentSchoolId);

  document.getElementById('navCrumb').textContent = {
    enrollment:  'Schools Directory',
    entry:       currentSchool ? `Data Entry: ${currentSchool.name}` : 'School Enrollment Entry',
    submissions: 'Submissions Tracker',
    dashboard:   'Dashboard',
    schools:     'Schools Register',
    export:      'Export & Print',
  }[name] || name;

  if (name === 'enrollment' || name === 'entry') {
    document.getElementById('sbEnrollment')?.classList.add('active');
  }
  if (name === 'submissions') {
    const ok = isAdmin();
    const lockedEl = document.getElementById('submissionsLocked');
    const contentEl = document.getElementById('submissionsContent');
    if (lockedEl) lockedEl.style.display = ok ? 'none' : 'flex';
    if (contentEl) contentEl.style.display = ok ? 'block' : 'none';
    if (ok) loadSubmissionsReport(false);
  }

  if (name === 'dashboard') {
    const ok = isAdmin();
    document.getElementById('dashLocked').style.display  = ok ? 'none' : 'flex';
    document.getElementById('dashContent').style.display = ok ? 'block' : 'none';
    if (ok) renderDashboard();
  }
  if (name === 'schools') {
    const ok = isAdmin();
    document.getElementById('schoolsLocked').style.display  = ok ? 'none' : 'flex';
    document.getElementById('schoolsContent').style.display = ok ? 'block' : 'none';
    if (ok) renderSchoolsTable();
  }
  if (name === 'export') {
    const ok = isAdmin();
    document.getElementById('exportLocked').style.display  = ok ? 'none' : 'flex';
    document.getElementById('exportContent').style.display = ok ? 'block' : 'none';
  }
}

/* ─────────────────────────────────────
   SCHOOL SELECTOR
───────────────────────────────────── */
function populateSchoolSelect() {
  const cluster = activeCluster(); if (!cluster) return;
  const sel = document.getElementById('entrySchoolSelect');
  const expSel = document.getElementById('exportSchoolSelect');
  const prev = sel.value;
  const groups = {};
  cluster.schools.forEach(s => { (groups[s.cell] = groups[s.cell] || []).push(s); });
  let html = '<option value="">⭐ SELECT YOUR SCHOOL TO BEGIN ⭐</option>';
  Object.keys(groups)
    .sort((a, b) => a === 'HUB' ? -1 : b === 'HUB' ? 1 : a.localeCompare(b))
    .forEach(cell => {
      html += `<optgroup label="${cell === 'HUB' ? 'Hub School' : 'Cell ' + cell}">`;
      groups[cell].forEach(s => {
        html += `<option value="${s.id}">${s.isHub ? '★ ' : ''}${esc(s.name)}</option>`;
      });
      html += '</optgroup>';
    });
  sel.innerHTML = html;
  if (prev && cluster.schools.find(s => s.id === prev)) sel.value = prev;

  if (!sel.value) sel.classList.add('select-school-highlight');
  else sel.classList.remove('select-school-highlight');

  if (expSel) {
    expSel.innerHTML = html.replace('⭐ SELECT YOUR SCHOOL TO BEGIN ⭐', '— Choose School to Print —');
    if (prev && cluster.schools.find(s => s.id === prev)) expSel.value = prev;
  }
}

function updateSidebarCard() {
  const cluster = activeCluster(); if (!cluster) return;
  document.getElementById('sbCode').textContent     = cluster.code;
  document.getElementById('sbDistrict').textContent = cluster.district;
}

function updateProgressKPIs() {
  const cluster = activeCluster(); if (!cluster) return;
  const g        = clusterTotals(cluster);
  const mismatch = cluster.schools.filter(s => !schoolTotals(s).match).length;
  const filled   = cluster.schools.filter(s => schoolTotals(s).total > 0).length;
  document.getElementById('enrollKPIs').innerHTML = `
    <div class="progress-kpi hi"><div class="kpi-num">${cluster.schools.length}</div><div class="kpi-lbl">Schools</div></div>
    <div class="progress-kpi hi"><div class="kpi-num">${filled}</div><div class="kpi-lbl">With Data</div></div>
    <div class="progress-kpi hi"><div class="kpi-num">${g.total}</div><div class="kpi-lbl">Total Enrollment</div></div>
    <div class="progress-kpi ${mismatch ? 'warn' : 'hi'}">
      <div class="kpi-num" style="${mismatch ? 'color:var(--danger)' : ''}">${mismatch}</div>
      <div class="kpi-lbl">Validation Errors</div>
    </div>
  `;
}

/* ─────────────────────────────────────
   SCHOOLS GRID DIRECTORY (Official Sindh Portal Style)
───────────────────────────────────── */
const schoolGridState = {
  activeFilter: 'ALL',
  searchKeyword: '',
};

function renderSchoolsGrid() {
  const container = document.getElementById('schoolsCardsWrapper');
  if (!container) return;
  const cluster = activeCluster();
  if (!cluster || !cluster.schools) return;

  const kw = (schoolGridState.searchKeyword || '').trim().toLowerCase();
  const filterCell = schoolGridState.activeFilter;

  // Group schools by cell
  const groups = {};
  cluster.schools.forEach(s => {
    const cKey = s.cell || 'OTHER';
    groups[cKey] = groups[cKey] || [];
    groups[cKey].push(s);
  });

  const cellOrder = ['HUB', 'C1', 'C2'];
  Object.keys(groups).forEach(k => {
    if (!cellOrder.includes(k)) cellOrder.push(k);
  });

  let html = '';
  let totalMatched = 0;

  cellOrder.forEach(cellKey => {
    if (!groups[cellKey] || groups[cellKey].length === 0) return;
    if (filterCell !== 'ALL' && filterCell !== cellKey) return;

    // Filter by search keyword
    const schoolsInCell = groups[cellKey].filter(s => {
      if (!kw) return true;
      const nameMatch = (s.name || '').toLowerCase().includes(kw);
      const semisMatch = (s.semis || '').includes(kw);
      const typeMatch = (s.type || '').toLowerCase().includes(kw);
      return nameMatch || semisMatch || typeMatch;
    });

    if (schoolsInCell.length === 0) return;
    totalMatched += schoolsInCell.length;

    const cellTitle = cellKey === 'HUB' ? 'Hub School — GBHS Thari Mirwah' : `Cell ${cellKey}`;
    const cellBadgeCount = schoolsInCell.length;

    html += `
      <div class="sg-cell-section">
        <div class="sg-cell-header">
          <div class="sg-cell-header-left">
            <span class="sg-cell-crown">👑</span>
            <span class="sg-cell-name">${esc(cellTitle)}</span>
          </div>
          <div class="sg-cell-header-right">
            <span class="sg-cell-count">${cellBadgeCount}</span>
          </div>
        </div>

        <div class="sg-cards-grid">
          ${schoolsInCell.map(school => renderSingleSchoolCard(school)).join('')}
        </div>
      </div>
    `;
  });

  if (totalMatched === 0) {
    html = `
      <div class="sg-empty-state">
        <span style="font-size:36px">🔍</span>
        <h3>No schools matched "${esc(schoolGridState.searchKeyword)}"</h3>
        <p>Try searching for a different school name, SEMIS code, or clear the filter.</p>
        <button class="btn btn-outline btn-sm" onclick="clearSchoolSearch()">Clear Search</button>
      </div>
    `;
  }

  container.innerHTML = html;
}

function renderSingleSchoolCard(school) {
  const totals = schoolTotals(school);
  const isHub = Boolean(school.isHub);
  const isGirls = school.type.startsWith('GG');
  const avatarClass = isHub ? 'hub' : (isGirls ? 'girls' : 'boys');
  const avatarIcon = isHub ? '🏛️' : (school.type.includes('HS') ? '🏛️' : (isGirls ? '👧' : '👦'));

  // Calculate classes filled count
  let filledClasses = 0;
  const expectedClasses = (Number(school.classMax) - Number(school.classMin) + 1) || 6;
  classNums(school).forEach(c => {
    const cd = school.classes[c] || {};
    if ((Number(cd.boys) || 0) > 0 || (Number(cd.girls) || 0) > 0) filledClasses++;
  });

  const isSubmitted = Boolean(school.isSubmitted || totals.total > 0);
  const isHead = school.cell === 'C2' && school.name.includes('THARI');

  return `
    <div class="sg-card ${isHub ? 'is-hub-card' : ''}"
         id="schoolCard-${school.id}"
         data-school-id="${school.id}"
         onclick="openSchoolEntryPage('${school.id}')"
         title="Click to open dedicated enrollment data entry form for ${esc(school.name)}">
      
      <div class="sg-card-top">
        <div class="sg-avatar ${avatarClass}">
          <span>${avatarIcon}</span>
        </div>
        <div class="sg-card-header-text">
          <div class="sg-school-name">
            ${esc(school.name)}
            ${isHub ? '<span class="sg-tag-hub">★ Hub Head</span>' : ''}
            ${isHead ? '<span class="sg-tag-head">Head</span>' : ''}
          </div>
          <div class="sg-card-meta">
            <span class="sg-semis-chip">🪪 ${esc(school.semis || 'N/A')}</span>
            <span class="sg-cell-tag">Cell ${esc(school.cell)}</span>
            <span style="font-size:9.5px;color:var(--text-xlt)">• ${esc(school.type)}</span>
          </div>
        </div>
        <div class="sg-chevron" title="Click to open entry form">➔</div>
      </div>

      <!-- Enrollment Data inside the card -->
      <div class="sg-enrollment-box ${isSubmitted ? 'submitted' : 'pending'}">
        <div class="sg-eb-top">
          <span class="sg-eb-status">${isSubmitted ? '✅ SUBMITTED' : '⏳ PENDING'}</span>
          <span class="sg-eb-total">${isSubmitted ? `<b>${totals.total}</b> Enrolled` : '0 Enrolled'}</span>
        </div>
        <div class="sg-eb-breakdown">
          ${isSubmitted ? `
            <span>👦 Boys: <b>${totals.boys}</b></span>
            <span>👧 Girls: <b>${totals.girls}</b></span>
            <span>📚 Classes: <b>${filledClasses}/${expectedClasses}</b></span>
          ` : `
            <span>Classes: <b>${formatClassRange(school.classMin, school.classMax)}</b></span>
            <span style="color:#0284c7;font-weight:700">👉 Click to open entry form</span>
          `}
        </div>
      </div>

      <!-- Action buttons matching official portal -->
      <div class="sg-actions-row">
        <button class="sg-btn-action btn-enrollment"
                onclick="event.stopPropagation(); openSchoolEntryPage('${school.id}')"
                title="Open dedicated enrollment entry page">
          <span>📊 Enrollment</span>
        </button>
        <button class="sg-btn-action btn-staff"
                onclick="event.stopPropagation(); toast('Staff Data module scheduled for Phase 2', 'info')"
                title="Staff Data (Scheduled)">
          <span>👥 Staff</span>
        </button>
        <button class="sg-btn-action btn-vacancy"
                onclick="event.stopPropagation(); toast('Vacancy module scheduled for Phase 2', 'info')"
                title="Vacancy Module (Scheduled)">
          <span>⚡ Vacancy</span>
        </button>
        <button class="sg-btn-action btn-facilities"
                onclick="event.stopPropagation(); toast('Facilities module scheduled for Phase 2', 'info')"
                title="Facilities Module (Scheduled)">
          <span>🏫 Facilities</span>
        </button>
      </div>
    </div>
  `;
}

function openSchoolEntryPage(schoolId) {
  const cluster = activeCluster();
  if (!cluster) return;
  const school = cluster.schools.find(s => s.id === schoolId);
  if (!school) return;

  state.currentSchoolId = school.id;
  const hiddenSel = document.getElementById('entrySchoolSelect');
  if (hiddenSel) hiddenSel.value = school.id;

  const titleEl = document.getElementById('entrySchoolTitle');
  const badgeEl = document.getElementById('entrySchoolBadge');
  const subEl   = document.getElementById('entrySchoolSub');
  const metaStrip = document.getElementById('schoolMetaStrip');
  const ti = TYPE_INFO[school.type] || { label: school.type };

  if (titleEl) titleEl.textContent = school.name;
  if (badgeEl) {
    badgeEl.className = `chip-tag ${school.isHub ? 'chip-hub' : 'chip-cell'}`;
    badgeEl.textContent = school.isHub ? 'HUB SCHOOL' : `CELL ${school.cell}`;
  }
  if (subEl) {
    subEl.textContent = `SEMIS: ${school.semis || 'N/A'} · Cell ${school.cell} · Type: ${school.type} · Classes: ${formatClassRange(school.classMin, school.classMax)}`;
  }

  if (metaStrip) {
    metaStrip.innerHTML = `
      <div class="meta-chip"><b>${esc(school.name)}</b></div>
      <div class="meta-chip"><span class="chip-tag ${school.isHub ? 'chip-hub' : 'chip-cell'}">${school.isHub ? 'HUB' : 'Cell ' + school.cell}</span></div>
      <div class="meta-chip"><span class="chip-tag chip-type">${school.type}</span> ${esc(ti.label)}</div>
      <div class="meta-chip">Classes: <b>${formatClassRange(school.classMin, school.classMax)}</b></div>
      ${school.semis ? `<div class="meta-chip">SEMIS: <b>${esc(school.semis)}</b></div>` : ''}
      ${school.headTeacher ? `<div class="meta-chip">Head: <b>${esc(school.headTeacher)}</b></div>` : ''}
    `;
  }

  renderClassCards(school);
  renderValBanner(school);

  switchPanel('entry');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function backToSchoolsDirectory() {
  updateProgressKPIs();
  renderSchoolsGrid();
  switchPanel('enrollment');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setSchoolGridFilter(cellKey) {
  schoolGridState.activeFilter = cellKey;
  document.querySelectorAll('#sgFilterPills .sg-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-cell') === cellKey);
  });
  renderSchoolsGrid();
}

function onSchoolSearchInput(val) {
  schoolGridState.searchKeyword = (val || '').trim();
  const clearBtn = document.getElementById('sgSearchClear');
  if (clearBtn) clearBtn.style.display = schoolGridState.searchKeyword ? 'inline-flex' : 'none';
  renderSchoolsGrid();
}

function clearSchoolSearch() {
  const inp = document.getElementById('schoolGridSearch');
  if (inp) inp.value = '';
  onSchoolSearchInput('');
}

function loadSchoolForm(schoolId) {
  const sId = schoolId || document.getElementById('entrySchoolSelect')?.value || state.currentSchoolId;
  if (sId) openSchoolEntryPage(sId);
}

window.renderSchoolsGrid = renderSchoolsGrid;
window.openSchoolEntryPage = openSchoolEntryPage;
window.backToSchoolsDirectory = backToSchoolsDirectory;
window.loadSchoolForm = loadSchoolForm;
window.setSchoolGridFilter = setSchoolGridFilter;
window.onSchoolSearchInput = onSchoolSearchInput;
window.clearSchoolSearch = clearSchoolSearch;

function renderClassCards(school) {
  const container = document.getElementById('classCardsContainer');
  container.innerHTML = '';
  classNums(school).forEach(cls => {
    const cd = school.classes[cls] || { boys:0, girls:0, muslim:0, nonMuslim:0, medium:'sindhi', furniture:'available', sections:0 };
    const t  = classTotals(cd);
    const card = document.createElement('div');
    card.className = 'card enrollment-card';
    card.id = `classCard-${cls}`;
    const badge = badgeHtml(t);
    card.innerHTML = `
      <div class="class-card-hdr" id="hdr-${cls}" onclick="toggleCard(${cls})">
        <div class="class-lbl">
          <span class="class-badge-pill">${classTag(cls)}</span>
          <span class="class-title-text">${classLabel(cls)}</span>
        </div>
        <div class="class-hdr-right">
          <span id="badge-${cls}">${badge}</span>
          <span id="clsTotal-${cls}" class="class-total-chip">${t.g > 0 ? t.g + ' students' : ''}</span>
          <svg class="class-chev" id="chev-${cls}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      <div class="class-card-body" id="body-${cls}">
        ${classFormHtml(cls, cd, t)}
      </div>
    `;
    container.appendChild(card);
    attachClassListeners(card, cls, school);
  });
  // auto-open first card
  const first = classNums(school)[0];
  if (first !== undefined) {
    document.getElementById(`body-${first}`)?.classList.add('open');
    document.getElementById(`chev-${first}`)?.classList.add('open');
  }
}

function badgeHtml(t) {
  if (t.match && t.g > 0) return '<span class="class-badge ok">✓ Balanced</span>';
  if (t.g === 0)           return '<span class="class-badge empty">Empty</span>';
  return                          '<span class="class-badge bad">⚠ Mismatch</span>';
}

function classFormHtml(cls, cd, t) {
  const rOk  = t.g > 0 && t.r === t.g;
  const rBad = t.g > 0 && t.r !== t.g;
  return `
    <div class="enroll-grid-2x2">
      <!-- STEP 1: GENDER -->
      <div class="enroll-sec">
        <div class="enroll-title">① Gender Count</div>
        <div class="g3 compact-g3">
          <div class="form-group">
            <label class="form-label">👦 Boys</label>
            <input type="number" class="form-input num compact" min="0" value="${cd.boys||0}" data-f="boys" id="f-${cls}-boys" placeholder="0">
          </div>
          <div class="form-group">
            <label class="form-label">👧 Girls</label>
            <input type="number" class="form-input num compact" min="0" value="${cd.girls||0}" data-f="girls" id="f-${cls}-girls" placeholder="0">
          </div>
          <div class="form-group">
            <label class="form-label">Total</label>
            <div class="total-cell compact-cell" id="tc-g-${cls}">
              <span class="tn">${t.g}</span><span class="tl">AUTO TOTAL</span>
            </div>
          </div>
        </div>
      </div>

      <!-- STEP 2: RELIGION -->
      <div class="enroll-sec">
        <div class="enroll-title">② Religion <span class="enroll-subtitle">(must match Gender)</span></div>
        <div class="g3 compact-g3">
          <div class="form-group">
            <label class="form-label">☪ Muslim</label>
            <input type="number" class="form-input num compact" min="0" value="${cd.muslim||0}" data-f="muslim" id="f-${cls}-muslim" placeholder="0">
          </div>
          <div class="form-group">
            <label class="form-label">✝ Non-Muslim</label>
            <input type="number" class="form-input num compact" min="0" value="${cd.nonMuslim||0}" data-f="nonMuslim" id="f-${cls}-nonMuslim" placeholder="0">
          </div>
          <div class="form-group">
            <label class="form-label">Religion Total</label>
            <div class="total-cell compact-cell ${rOk ? 'ok' : rBad ? 'bad' : ''}" id="tc-r-${cls}">
              <span class="tn">${t.r}</span>
              <span class="tl">${rBad ? '⚠ MISMATCH' : rOk ? '✓ MATCH' : 'AUTO TOTAL'}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- STEP 3: MEDIUM -->
      <div class="enroll-sec">
        <div class="enroll-title">③ Medium of Instruction</div>
        <div class="form-group">
          <label class="form-label">Language of Teaching</label>
          <select class="form-select compact" data-f="medium" id="f-${cls}-medium">
            ${MEDIUM_OPTS.map(o => `<option value="${o.v}" ${(cd.medium||'sindhi')===o.v?'selected':''}>${o.l}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- STEP 4: FACILITIES -->
      <div class="enroll-sec">
        <div class="enroll-title">④ Facilities & Sections</div>
        <div class="g2 compact-g2">
          <div class="form-group">
            <label class="form-label">Furniture Status</label>
            <select class="form-select compact" data-f="furniture" id="f-${cls}-furniture">
              ${FURNITURE_OPTS.map(o => `<option value="${o.v}" ${o.v===cd.furniture?'selected':''}>${o.l}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Sections</label>
            <select class="form-select compact" data-f="sections" id="f-${cls}-sections">
              ${[...Array(13).keys()].map(n => `<option value="${n}" ${n===Number(cd.sections)?'selected':''}>${sectionLabel(n)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    </div>
  `;
}

function attachClassListeners(card, cls, school) {
  card.querySelectorAll('[data-f]').forEach(inp => {
    const evt = inp.tagName === 'SELECT' ? 'change' : 'input';
    inp.addEventListener(evt, () => {
      if (!school.classes[cls])
        school.classes[cls] = { boys:0, girls:0, muslim:0, nonMuslim:0, medium:'sindhi', furniture:'available', sections:0 };
      school.classes[cls][inp.dataset.f] = inp.type === 'number' ? (Number(inp.value) || 0) : inp.value;
      refreshClassUI(cls, school.classes[cls]);
      renderValBanner(school);
      updateProgressKPIs();
      triggerAutoSave(school);
    });
  });
}

function refreshClassUI(cls, cd) {
  const t   = classTotals(cd);
  const rOk  = t.g > 0 && t.r === t.g;
  const rBad = t.g > 0 && t.r !== t.g;

  // Gender total
  const tcG = document.getElementById(`tc-g-${cls}`);
  if (tcG) tcG.innerHTML = `<span class="tn">${t.g}</span><span class="tl">AUTO TOTAL</span>`;

  // Religion total
  const tcR = document.getElementById(`tc-r-${cls}`);
  if (tcR) {
    tcR.className = `total-cell ${rOk ? 'ok' : rBad ? 'bad' : ''}`;
    tcR.innerHTML = `<span class="tn">${t.r}</span><span class="tl">${rBad ? '⚠ MISMATCH' : rOk ? '✓ MATCH' : 'AUTO TOTAL'}</span>`;
  }

  // Header badge and running total
  const badge    = document.getElementById(`badge-${cls}`);
  const clsTotal = document.getElementById(`clsTotal-${cls}`);
  if (badge)    badge.innerHTML        = badgeHtml(t);
  if (clsTotal) clsTotal.textContent  = t.g > 0 ? `${t.g} students` : '';
}

function toggleCard(cls) {
  document.getElementById(`body-${cls}`)?.classList.toggle('open');
  document.getElementById(`chev-${cls}`)?.classList.toggle('open');
}

/* ─────────────────────────────────────
   VALIDATION BANNER
───────────────────────────────────── */
function renderValBanner(school) {
  const banner = document.getElementById('valBanner');
  const errors = [];
  classNums(school).forEach(cls => {
    const cd = school.classes[cls] || {};
    const t  = classTotals(cd);
    if (!t.match && t.g > 0) errors.push({ cls, t });
  });
  if (errors.length === 0) {
    const st = schoolTotals(school);
    if (st.total > 0) {
      banner.className = 'val-banner ok';
      banner.innerHTML = `<span style="font-size:16px">✓</span>
        <div><b>All figures balance!</b> Total: ${st.total} students (${st.boys} boys, ${st.girls} girls) · ${st.sections} sections</div>`;
    } else { banner.className = 'val-banner'; }
    return;
  }
  banner.className = 'val-banner bad';
  banner.innerHTML = `<b>⚠ Validation errors in ${errors.length} class${errors.length > 1 ? 'es' : ''}:</b>
    <table class="mm-table">
      <thead><tr><th>Class</th><th>Gender (B+G)</th><th>Religion</th><th>Medium</th><th>Problem</th></tr></thead>
      <tbody>
        ${errors.map(({ cls, t }) => `
          <tr>
            <td><b>Class ${cls}</b></td>
            <td>${t.g}</td>
            <td class="${t.r !== t.g ? 'mm-diff ' + (t.r > t.g ? 'pos' : 'neg') : ''}">${t.r}${t.r !== t.g ? ` (${t.r > t.g ? '+' : ''}${t.r - t.g})` : ' ✓'}</td>
            <td class="${t.m !== t.g ? 'mm-diff ' + (t.m > t.g ? 'pos' : 'neg') : ''}">${t.m}${t.m !== t.g ? ` (${t.m > t.g ? '+' : ''}${t.m - t.g})` : ' ✓'}</td>
            <td>${t.diffs.map(d => `${d.field}: ${d.diff > 0 ? '+' : ''}${d.diff}`).join(', ')}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div style="margin-top:8px;font-size:11.5px;opacity:.85">💡 Boys+Girls must equal Muslim+Non-Muslim and Sindhi+Urdu+English.</div>`;
}

/* ─────────────────────────────────────
   SAVE
───────────────────────────────────── */
let autoSaveTimeout = null;

function triggerAutoSave(school) {
  clearTimeout(autoSaveTimeout);
  syncStatus.textContent = 'Unsaved…'; dbDot.className = 'dot sync';
  autoSaveTimeout = setTimeout(() => performSave(school, true), 800);
}

async function handleSave() {
  const cluster = activeCluster(); if (!cluster) return;
  const sel    = document.getElementById('entrySchoolSelect');
  const school = cluster.schools.find(s => s.id === sel.value);
  if (!school) { toast('Select a school first', 'err'); return; }
  clearTimeout(autoSaveTimeout);
  await performSave(school, false);
}

async function performSave(school, isAuto) {
  const mainBtn  = document.getElementById('mainSaveBtn');
  const icon     = document.getElementById('saveBtnIcon');
  const lbl      = document.getElementById('saveBtnLbl');
  const tsEl     = document.getElementById('saveTs');
  const fsEl     = document.getElementById('footerSaveStatus');

  if (mainBtn) { mainBtn.className = 'btn-save saving'; if (icon) icon.textContent = '⏳'; if (lbl) lbl.textContent = isAuto ? 'Auto-saving…' : 'Saving…'; }
  syncStatus.textContent = 'Saving…'; dbDot.className = 'dot sync';

  try {
    await saveClasses(school.id, school.classes);
    school.isSubmitted = true;
    school.submittedAt = new Date().toISOString();
    updateProgressKPIs();
    renderSchoolsGrid();
    const now = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    dbDot.className = 'dot'; syncStatus.textContent = 'Saved';
    if (tsEl) tsEl.innerHTML = `✓ Last saved at <b>${now}</b>`;
    if (fsEl) fsEl.innerHTML = `<span style="color:var(--ok)">✓ Saved ${now}</span>`;
    if (!isAuto) toast(`✓ Saved: ${school.name}`, 'ok');
    if (mainBtn) {
      mainBtn.className = 'btn-save saved'; if (icon) icon.textContent = '✓'; if (lbl) lbl.textContent = 'Saved!';
      setTimeout(() => { mainBtn.className = 'btn-save'; if (icon) icon.textContent = '💾'; if (lbl) lbl.textContent = 'Save Data'; }, 1600);
    }
  } catch (e) {
    dbDot.className = 'dot err'; syncStatus.textContent = 'Save failed';
    toast('Save error: ' + e.message, 'err');
    if (mainBtn) { mainBtn.className = 'btn-save'; if (icon) icon.textContent = '⚠️'; if (lbl) lbl.textContent = 'Retry Save'; }
  }
}

window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    if (document.getElementById('panel-enrollment').classList.contains('active')) handleSave();
  }
});

/* ─────────────────────────────────────
   DASHBOARD
───────────────────────────────────── */
let charts = {};
function destroyCharts() { Object.values(charts).forEach(c => c && c.destroy()); charts = {}; }

function renderDashboard() {
  const cluster = activeCluster(); if (!cluster) return;
  destroyCharts();
  const g        = clusterTotals(cluster);
  const mismatch = cluster.schools.filter(s => !schoolTotals(s).match).length;
  document.getElementById('dashSubTitle').textContent =
    `${cluster.code} · ${cluster.district} — ${cluster.schools.length} schools`;
  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card g"><div class="stat-num">${cluster.schools.length}</div><div class="stat-lbl">Schools</div></div>
    <div class="stat-card g"><div class="stat-num">${g.total}</div><div class="stat-lbl">Total Students</div></div>
    <div class="stat-card g"><div class="stat-num">${g.boys}</div><div class="stat-lbl">Boys</div></div>
    <div class="stat-card g"><div class="stat-num">${g.girls}</div><div class="stat-lbl">Girls</div></div>
    <div class="stat-card a"><div class="stat-num">${g.sections}</div><div class="stat-lbl">Sections</div></div>
    <div class="stat-card ${mismatch ? 'r' : 'g'}"><div class="stat-num" style="${mismatch ? 'color:var(--danger)' : ''}">${mismatch}</div><div class="stat-lbl">Errors</div></div>
  `;
  const cOpts = { plugins: { legend: { position: 'bottom' } } };
  charts.g = new Chart(document.getElementById('chartGender'),
    { type:'doughnut', data:{ labels:['Boys','Girls'], datasets:[{ data:[g.boys,g.girls], backgroundColor:['#0f6c3a','#d4900a'], borderWidth:0 }] }, options: cOpts });
  charts.r = new Chart(document.getElementById('chartReligion'),
    { type:'doughnut', data:{ labels:['Muslim','Non-Muslim'], datasets:[{ data:[g.muslim,g.nonMuslim], backgroundColor:['#0f6c3a','#dc2626'], borderWidth:0 }] }, options: cOpts });
  charts.m = new Chart(document.getElementById('chartMedium'),
    { type:'doughnut', data:{ labels:['Sindhi','Urdu','English','Sindhi+Urdu'], datasets:[{ data:[g.medCount.sindhi,g.medCount.urdu,g.medCount.english,g.medCount.both], backgroundColor:['#0f6c3a','#d4900a','#6b7280','#0284c7'], borderWidth:0 }] }, options: cOpts });

  const tbody = document.querySelector('#summaryTable tbody'); tbody.innerHTML = '';
  cluster.schools.forEach((s, i) => {
    const t = schoolTotals(s);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i+1}</td>
      <td><span class="tag ${s.isHub ? 'tag-hub' : 'tag-cell'}">${s.isHub ? 'HUB' : 'Cell ' + s.cell}</span></td>
      <td>${s.isHub ? '★ ' : ''}<b>${esc(s.name)}</b></td>
      <td><span class="tag tag-type">${s.type}</span></td>
      <td class="num">${t.boys}</td><td class="num">${t.girls}</td>
      <td class="num"><b>${t.total}</b></td>
      <td class="num">${t.sections}</td>
      <td>${t.match ? '<span class="tag tag-ok">✓ OK</span>' : '<span class="tag tag-bad">⚠ Error</span>'}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ─────────────────────────────────────
   SCHOOLS REGISTER
───────────────────────────────────── */
function renderSchoolsTable() {
  const cluster = activeCluster(); if (!cluster) return;
  const tbody = document.querySelector('#schoolsTable tbody'); tbody.innerHTML = '';
  cluster.schools.forEach((s, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i+1}</td>
      <td><span class="tag ${s.isHub ? 'tag-hub' : 'tag-cell'}">${s.isHub ? 'HUB' : 'Cell ' + s.cell}</span></td>
      <td><input value="${esc(s.name)}" style="width:190px"></td>
      <td><select>${Object.keys(TYPE_INFO).map(t => `<option value="${t}" ${t===s.type?'selected':''}>${t}</option>`).join('')}</select></td>
      <td style="color:var(--text-lt);font-size:12px">${s.classMin}–${s.classMax}</td>
      <td><input value="${esc(s.semis||'')}" style="width:100px"></td>
      <td><input value="${esc(s.headTeacher||'')}" style="width:140px"></td>
      <td><input value="${esc(s.contact||'')}" style="width:100px"></td>
      <td>${s.isHub ? '' : '<button class="btn btn-danger btn-sm" data-del>Remove</button>'}</td>
    `;
    tr.querySelectorAll('input')[0].addEventListener('input', e => { s.name = e.target.value; metaSave(s); });
    tr.querySelectorAll('input')[1].addEventListener('input', e => { s.semis = e.target.value; metaSave(s); });
    tr.querySelectorAll('input')[2].addEventListener('input', e => { s.headTeacher = e.target.value; metaSave(s); });
    tr.querySelectorAll('input')[3].addEventListener('input', e => { s.contact = e.target.value; metaSave(s); });
    tr.querySelector('select').addEventListener('change', e => {
      s.type = e.target.value; const ti = TYPE_INFO[s.type];
      s.classMin = ti.min; s.classMax = ti.max; metaSave(s); renderSchoolsTable();
    });
    const del = tr.querySelector('[data-del]');
    if (del) del.addEventListener('click', () => deleteSchool(s));
    tbody.appendChild(tr);
  });
}

const metaSaveTimers = {};
function metaSave(school) {
  clearTimeout(metaSaveTimers[school.id]);
  metaSaveTimers[school.id] = setTimeout(async () => {
    const d = await api('PUT', `/api/schools/${school.id}`, school);
    if (d.success) toast('School updated'); else toast('Update failed: ' + d.error, 'err');
  }, 500);
}

async function deleteSchool(s) {
  if (!confirm(`Remove "${s.name}" from cluster?`)) return;
  const d = await api('DELETE', `/api/schools/${s.id}`);
  if (d.success) { toast('Removed'); await loadData(); renderSchoolsTable(); }
  else toast('Error: ' + d.error, 'err');
}

async function addCellSchool() {
  const cluster = activeCluster(); if (!cluster) return;
  const name = prompt('School name:'); if (!name) return;
  const type = (prompt('Type (GBPS/GGPS/GBELS/GGELS/GGHS):', 'GBPS') || 'GBPS').toUpperCase().trim();
  if (!TYPE_INFO[type]) { alert('Unknown type'); return; }
  const cell = (prompt('Cell group (C1, C2…):', 'C1') || 'C1').toUpperCase().trim();
  const d = await api('POST', `/api/clusters/${cluster.code}/schools`, { name, type, cell });
  if (d.success) { toast('School added'); await loadData(); renderSchoolsTable(); }
  else toast('Error: ' + d.error, 'err');
}

/* ─────────────────────────────────────
   EXPORT
───────────────────────────────────── */
function exportCsv() {
  const cluster = activeCluster(); if (!cluster) return;
  const rows = [['Cluster','Cell','School','Type','SEMIS','Head','Contact','Class','Boys','Girls','Total','Muslim','NonMuslim','Sindhi','Urdu','English','Furniture','Sections','Balanced']];
  cluster.schools.forEach(s => {
    classNums(s).forEach(cls => {
      const cd = s.classes[cls] || {};
      const t  = classTotals(cd);
      rows.push([cluster.code,s.cell,s.name,s.type,s.semis||'',s.headTeacher||'',s.contact||'',cls,cd.boys||0,cd.girls||0,t.g,cd.muslim||0,cd.nonMuslim||0,cd.sindhi||0,cd.urdu||0,cd.english||0,cd.furniture||'available',sectionLabel(cd.sections),t.match?'YES':'NO']);
    });
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' }));
  a.download = `${cluster.code}_enrollment_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); toast('CSV downloaded');
}

/* ─────────────────────────────────────
   OFFICIAL A4 PRINT & PDF GENERATION
───────────────────────────────────── */
function generateSchoolReportHtml(school, cluster) {
  const c = cluster || activeCluster();
  const nums = classNums(school);
  const st = schoolTotals(school);
  const ti = TYPE_INFO[school.type] || { label: school.type };

  let rowsHtml = '';
  nums.forEach(cls => {
    const cd = school.classes[cls] || {};
    const t  = classTotals(cd);
    const medOpt = MEDIUM_OPTS.find(m => m.v === (cd.medium || 'sindhi'));
    const medLabel = medOpt ? medOpt.l : (cd.medium || 'Sindhi');
    const furnOpt = FURNITURE_OPTS.find(f => f.v === (cd.furniture || 'available'));
    const furnLabel = furnOpt ? furnOpt.l : (cd.furniture || 'Available');
    const isBalanced = t.match;

    rowsHtml += `
      <tr>
        <td class="p-class-name">${classLabel(cls)}</td>
        <td>${cd.boys || 0}</td>
        <td>${cd.girls || 0}</td>
        <td style="font-weight:700">${t.g}</td>
        <td>${cd.muslim || 0}</td>
        <td>${cd.nonMuslim || 0}</td>
        <td><span class="${isBalanced ? 'p-tag-ok' : 'p-tag-bad'}">${isBalanced ? '✓ OK' : '⚠ Mismatch'}</span></td>
        <td>${esc(medLabel)}</td>
        <td>${sectionLabel(cd.sections || 0)}</td>
        <td>${esc(furnLabel)}</td>
      </tr>
    `;
  });

  const totalBoys = nums.reduce((acc, cls) => acc + (school.classes[cls]?.boys || 0), 0);
  const totalGirls = nums.reduce((acc, cls) => acc + (school.classes[cls]?.girls || 0), 0);
  const totalMuslim = nums.reduce((acc, cls) => acc + (school.classes[cls]?.muslim || 0), 0);
  const totalNonMuslim = nums.reduce((acc, cls) => acc + (school.classes[cls]?.nonMuslim || 0), 0);
  const totalSections = nums.reduce((acc, cls) => acc + (Number(school.classes[cls]?.sections) || 0), 0);
  const allBalanced = nums.every(cls => classTotals(school.classes[cls] || {}).match);

  const grandTotalRow = `
    <tr class="p-total-row">
      <td class="p-class-name">TOTAL</td>
      <td>${totalBoys}</td>
      <td>${totalGirls}</td>
      <td style="font-weight:800">${st.total}</td>
      <td>${totalMuslim}</td>
      <td>${totalNonMuslim}</td>
      <td><span class="${allBalanced ? 'p-tag-ok' : 'p-tag-bad'}">${allBalanced ? '✓ BALANCED' : '⚠ MISMATCH'}</span></td>
      <td>—</td>
      <td>${totalSections} sec</td>
      <td>—</td>
    </tr>
  `;

  return `
    <div class="print-page">
      <div>
        <div class="p-header">
          <img src="/logo.jpg" alt="Seal" class="p-logo">
          <div class="p-head-text">
            <div class="p-dept">School Education &amp; Literacy Department · Government of Sindh</div>
            <div class="p-title">Office of the Headmaster · Cluster Hub GBHS Thari Mirwah</div>
            <div class="p-sub">Taluka Mirwah · District Khairpur Mirs · Cluster Code: <b>${esc(c.code)}</b> · SEMIS: <b>415060805</b></div>
          </div>
          <div class="p-creator-badge">
            <div style="font-size:6.5pt;text-transform:uppercase;color:#1e40af;font-weight:700">Website Created By</div>
            <div class="p-cr-name">Asif Ali Shar</div>
            <div style="font-size:6.5pt;color:#475569">JEST, GBHS Thari Mirwah</div>
          </div>
        </div>

        <div class="p-doc-badge">Annual School Enrollment &amp; Facilities Verification Proforma (2025–2026)</div>

        <div class="p-school-box">
          <div>
            <div class="p-info-row"><span class="p-info-lbl">School Name:</span> <span class="p-info-val" style="font-size:9.5pt;color:#0f6c3a">${esc(school.name)}</span></div>
            <div class="p-info-row"><span class="p-info-lbl">SEMIS Code:</span> <span class="p-info-val">${esc(school.semis || 'N/A')}</span></div>
            <div class="p-info-row"><span class="p-info-lbl">Personal ID (PID):</span> <span class="p-info-val">${esc(school.pid || 'N/A')}</span></div>
            <div class="p-info-row"><span class="p-info-lbl">Cluster Status:</span> <span class="p-info-val">${school.isHub ? 'CLUSTER HUB HEADQUARTERS' : 'Cell ' + esc(school.cell)} · ${esc(school.type)} (${esc(ti.label)})</span></div>
          </div>
          <div>
            <div class="p-info-row"><span class="p-info-lbl">Head Teacher:</span> <span class="p-info-val">${esc(school.headTeacher || 'Not Assigned')}</span></div>
            <div class="p-info-row"><span class="p-info-lbl">Designation:</span> <span class="p-info-val">${esc(school.designation || 'PST / In-charge')}</span></div>
            <div class="p-info-row"><span class="p-info-lbl">Class Range:</span> <span class="p-info-val">${formatClassRange(school.classMin, school.classMax)}</span></div>
            <div class="p-info-row"><span class="p-info-lbl">Report Date:</span> <span class="p-info-val">${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</span></div>
          </div>
        </div>

        <table class="p-table">
          <thead>
            <tr>
              <th>Class</th>
              <th>Boys</th>
              <th>Girls</th>
              <th>Total Students</th>
              <th>Muslim</th>
              <th>Non-Muslim</th>
              <th>Religion Check</th>
              <th>Medium</th>
              <th>Sections</th>
              <th>Furniture</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            ${grandTotalRow}
          </tbody>
        </table>

        <div class="p-cert">
          <b>Official Undertaking:</b> Certified that the enrollment figures and physical facilities recorded in this proforma have been thoroughly cross-checked and physically verified against the General Register (G.R) and daily attendance registers of the school.
        </div>
      </div>

      <div>
        <div class="p-sigs">
          <div class="p-sig-box">
            <div style="height:32px"></div>
            <div class="p-sig-title">Head Teacher / School In-charge</div>
            <div class="p-sig-sub">${esc(school.name)} (SEMIS: ${esc(school.semis||'—')})</div>
          </div>
          <div class="p-sig-box">
            <div style="height:32px"></div>
            <div class="p-sig-title">Headmaster / Cluster Hub Supervisor</div>
            <div class="p-sig-sub">GBHS Thari Mirwah (Cluster Code: ${esc(c.code)})</div>
          </div>
        </div>

        <div class="p-footer-note">
          Cluster Hub Management Information System • Official Government Proforma • Website created by Asif Ali Shar, JEST, GBHS Thari Mirwah • Printed on: ${new Date().toLocaleString()}
        </div>
      </div>
    </div>
  `;
}

function printCurrentSchoolReport(specifiedSchoolId) {
  const cluster = activeCluster(); if (!cluster) return;
  const sel = document.getElementById('entrySchoolSelect');
  const schoolId = specifiedSchoolId || sel?.value || state.expandedSchoolId || state.currentSchoolId || cluster.schools[0]?.id;
  const school = cluster.schools.find(s => s.id === schoolId);
  if (!school) {
    alert('Please select a school first to print its official proforma.');
    return;
  }
  const container = document.getElementById('printReportContainer');
  container.innerHTML = generateSchoolReportHtml(school, cluster);
  setTimeout(() => window.print(), 100);
}

function printSelectedSchoolReport() {
  const cluster = activeCluster(); if (!cluster) return;
  const sel = document.getElementById('exportSchoolSelect');
  const schoolId = sel?.value || cluster.schools[0]?.id;
  const school = cluster.schools.find(s => s.id === schoolId);
  if (!school) {
    alert('Please choose a school to print.');
    return;
  }
  const container = document.getElementById('printReportContainer');
  container.innerHTML = generateSchoolReportHtml(school, cluster);
  setTimeout(() => window.print(), 100);
}

function printAllSchoolsReport() {
  const cluster = activeCluster(); if (!cluster) return;
  const container = document.getElementById('printReportContainer');
  let fullHtml = '';
  cluster.schools.forEach(s => {
    fullHtml += generateSchoolReportHtml(s, cluster);
  });
  container.innerHTML = fullHtml;
  setTimeout(() => window.print(), 150);
}

function printClusterSummaryReport() {
  const cluster = activeCluster(); if (!cluster) return;
  const g = clusterTotals(cluster);
  const container = document.getElementById('printReportContainer');

  let rows = '';
  cluster.schools.forEach((s, i) => {
    const st = schoolTotals(s);
    const nums = classNums(s);
    const totalBoys = nums.reduce((acc, cls) => acc + (s.classes[cls]?.boys || 0), 0);
    const totalGirls = nums.reduce((acc, cls) => acc + (s.classes[cls]?.girls || 0), 0);
    const totalMuslim = nums.reduce((acc, cls) => acc + (s.classes[cls]?.muslim || 0), 0);
    const totalNonMuslim = nums.reduce((acc, cls) => acc + (s.classes[cls]?.nonMuslim || 0), 0);

    rows += `
      <tr>
        <td>${i + 1}</td>
        <td><b>${s.isHub ? 'HUB' : s.cell}</b></td>
        <td style="text-align:left;font-weight:700">${esc(s.name)}</td>
        <td>${s.type}</td>
        <td>${esc(s.semis || '—')}</td>
        <td style="text-align:left">${esc(s.headTeacher || '—')}</td>
        <td>${totalBoys}</td>
        <td>${totalGirls}</td>
        <td style="font-weight:700">${st.total}</td>
        <td>${totalMuslim}</td>
        <td>${totalNonMuslim}</td>
        <td><span class="${st.match ? 'p-tag-ok' : 'p-tag-bad'}">${st.match ? '✓ OK' : '⚠ Mismatch'}</span></td>
      </tr>
    `;
  });

  container.innerHTML = `
    <div class="print-page">
      <div>
        <div class="p-header">
          <img src="/logo.jpg" alt="Seal" class="p-logo">
          <div class="p-head-text">
            <div class="p-dept">School Education &amp; Literacy Department · Government of Sindh</div>
            <div class="p-title">Office of the Headmaster · Cluster Hub GBHS Thari Mirwah</div>
            <div class="p-sub">Taluka Mirwah · District Khairpur Mirs · Cluster Code: <b>${esc(cluster.code)}</b></div>
          </div>
          <div class="p-creator-badge">
            <div style="font-size:6.5pt;text-transform:uppercase;color:#1e40af;font-weight:700">Website Created By</div>
            <div class="p-cr-name">Asif Ali Shar</div>
            <div style="font-size:6.5pt;color:#475569">JEST, GBHS Thari Mirwah</div>
          </div>
        </div>

        <div class="p-doc-badge">Cluster Master Summary Matrix · All 23 Schools (2025–2026)</div>

        <table class="p-table" style="font-size:7.5pt">
          <thead>
            <tr>
              <th>#</th>
              <th>Cell</th>
              <th>School Name</th>
              <th>Type</th>
              <th>SEMIS</th>
              <th>Head Teacher</th>
              <th>Boys</th>
              <th>Girls</th>
              <th>Total</th>
              <th>Muslim</th>
              <th>Non-Muslim</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="p-total-row">
              <td colspan="6" style="text-align:right;font-weight:800">CLUSTER GRAND TOTAL (23 SCHOOLS):</td>
              <td>${g.boys}</td>
              <td>${g.girls}</td>
              <td style="font-weight:800">${g.total}</td>
              <td>${g.muslim}</td>
              <td>${g.nonMuslim}</td>
              <td><span class="p-tag-ok">✓ VERIFIED</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        <div class="p-sigs">
          <div class="p-sig-box">
            <div style="height:32px"></div>
            <div class="p-sig-title">Headmaster / Cluster Hub Supervisor</div>
            <div class="p-sig-sub">GBHS Thari Mirwah (Cluster Code: ${esc(cluster.code)})</div>
          </div>
          <div class="p-sig-box">
            <div style="height:32px"></div>
            <div class="p-sig-title">District Education Officer (ES&amp;HS / Primary)</div>
            <div class="p-sig-sub">District Khairpur Mirs, Sindh</div>
          </div>
        </div>

        <div class="p-footer-note">
          Cluster Hub Management Information System • Official Government Document • Website created by Asif Ali Shar, JEST, GBHS Thari Mirwah • Printed on: ${new Date().toLocaleString()}
        </div>
      </div>
    </div>
  `;
  setTimeout(() => window.print(), 100);
}

function doPrint() { printAllSchoolsReport(); }

async function resetCluster() {
  const cluster = activeCluster(); if (!cluster) return;
  if (!confirm(`Reset ALL class figures for Cluster ${cluster.code} to zero?`)) return;
  const d = await api('POST', `/api/clusters/${cluster.code}/reset`);
  if (d.success) { toast('Reset complete'); await loadData(); loadSchoolForm(); }
  else toast('Reset failed: ' + d.error, 'err');
}

/* ─────────────────────────────────────
   SUBMISSIONS TRACKER & REALTIME REPORTS
───────────────────────────────────── */
const subState = {
  data: null,
  filter: 'all',
  loading: false,
};

async function loadSubmissionsReport(forceRefresh = false) {
  const container = document.getElementById('submissionsTable')?.querySelector('tbody');
  if (forceRefresh && container) {
    container.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text-lt)">🔄 Querying PostgreSQL in real-time…</td></tr>';
  }
  try {
    const res = await api('GET', `/api/clusters/${state.activeCode}/submissions`);
    if (res.success && res.report) {
      subState.data = res.report;
      renderSubmissionsView();
      if (forceRefresh) toast('Live submissions query updated', 'ok');
    }
  } catch (err) {
    console.error('Error fetching submissions report:', err);
    if (container) {
      container.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--danger)">⚠️ Error querying database: ${esc(err.message)}</td></tr>`;
    }
  }
}

function renderSubmissionsView() {
  const rep = subState.data;
  if (!rep) return;

  const cntAll = document.getElementById('cntAll'); if (cntAll) cntAll.textContent = rep.totalSchools;
  const cntSub = document.getElementById('cntSub'); if (cntSub) cntSub.textContent = rep.submittedCount;
  const cntPend = document.getElementById('cntPend'); if (cntPend) cntPend.textContent = rep.pendingCount;

  const sbBadge = document.getElementById('sbSubBadge');
  if (sbBadge) {
    sbBadge.textContent = `${rep.submittedCount}/${rep.totalSchools}`;
    sbBadge.style.background = rep.pendingCount === 0 ? '#16a34a' : '#2563eb';
  }

  const queryTimeEl = document.getElementById('subQueryTime');
  if (queryTimeEl) {
    queryTimeEl.innerHTML = `Live DB: <b>${new Date(rep.queriedAt).toLocaleTimeString()}</b>`;
  }

  const statsGrid = document.getElementById('subStatsGrid');
  if (statsGrid) {
    statsGrid.innerHTML = `
      <div class="stat-card g">
        <div class="stat-num">${rep.totalSchools}</div>
        <div class="stat-lbl">Total Schools</div>
      </div>
      <div class="stat-card ${rep.submittedCount > 0 ? 'g' : ''}">
        <div class="stat-num" style="color:#16a34a">${rep.submittedCount}</div>
        <div class="stat-lbl">Submitted (${rep.submissionRate}%)</div>
      </div>
      <div class="stat-card ${rep.pendingCount > 0 ? 'r' : 'g'}">
        <div class="stat-num" style="color:${rep.pendingCount > 0 ? '#dc2626' : '#16a34a'}">${rep.pendingCount}</div>
        <div class="stat-lbl">Pending Defaulters</div>
      </div>
      <div class="stat-card g">
        <div class="stat-num">${rep.totalStudents}</div>
        <div class="stat-lbl">Enrolled Students</div>
      </div>
    `;
  }

  filterSubmissionsTable();
}

function setSubFilter(filter) {
  subState.filter = filter;
  document.querySelectorAll('.sub-filter-btn').forEach(btn => {
    const isTarget = btn.dataset.filter === filter;
    btn.classList.toggle('active', isTarget);
    btn.classList.toggle('btn-primary', isTarget);
    btn.classList.toggle('btn-outline', !isTarget);
  });
  filterSubmissionsTable();
}

function filterSubmissionsTable() {
  const rep = subState.data;
  if (!rep) return;
  const tbody = document.querySelector('#submissionsTable tbody');
  if (!tbody) return;

  const query = (document.getElementById('subSearchInput')?.value || '').toLowerCase().trim();
  const filter = subState.filter;

  let list = rep.schools.slice();
  if (filter === 'submitted') list = list.filter(s => s.isSubmitted);
  if (filter === 'pending')   list = list.filter(s => !s.isSubmitted);

  if (query) {
    list = list.filter(s =>
      s.name.toLowerCase().includes(query) ||
      (s.semis && s.semis.includes(query)) ||
      (s.headTeacher && s.headTeacher.toLowerCase().includes(query)) ||
      s.cell.toLowerCase().includes(query) ||
      s.type.toLowerCase().includes(query)
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text-lt)">No schools match the current filter.</td></tr>`;
    return;
  }

  let html = '';
  list.forEach((s, idx) => {
    const isSub = s.isSubmitted;
    const subTimeStr = s.submittedAt ? new Date(s.submittedAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '';
    const statusBadge = isSub
      ? `<span class="tag-submitted">✓ Submitted${subTimeStr ? ' <span style="font-weight:400;font-size:10px">(' + subTimeStr + ')</span>' : ''}</span>`
      : `<span class="tag-pending">⏳ Pending Defaulter</span>`;

    const progressPct = s.percentComplete || 0;
    const progressBar = `
      <div class="sub-prog-wrap">
        <div style="font-size:11px;font-weight:600">${s.classesWithData} / ${s.totalClasses} classes</div>
        <div class="sub-prog-bar"><div class="sub-prog-fill ${progressPct === 100 ? 'full' : ''}" style="width:${progressPct}%"></div></div>
      </div>
    `;

    const cleanContact = (s.contact || '').replace(/[^0-9]/g, '');
    const waContact = cleanContact.startsWith('0') ? '92' + cleanContact.substring(1) : cleanContact;

    let actionHtml = '';
    if (isSub) {
      actionHtml = `<button class="btn btn-outline btn-sm" onclick="printSingleSchoolById('${s.id}')" title="Print this school's verified proforma">🖨️ Proforma</button>`;
    } else {
      if (cleanContact) {
        actionHtml = `
          <a href="https://wa.me/${waContact}?text=${encodeURIComponent(getIndividualReminderMsg(s))}" target="_blank" class="btn-wa-remind" title="Send reminder via WhatsApp">
            <span>📲</span> Remind
          </a>
        `;
      } else {
        actionHtml = `<span style="font-size:11px;color:var(--text-xlt)">No contact</span>`;
      }
    }

    html += `
      <tr style="${!isSub ? 'background:#fffbfb' : ''}">
        <td>${idx + 1}</td>
        <td>${statusBadge}</td>
        <td><span class="tag ${s.isHub ? 'tag-hub' : 'tag-cell'}">${s.isHub ? 'HUB' : 'Cell ' + s.cell}</span></td>
        <td>
          <div style="font-weight:700;color:var(--text)">${s.isHub ? '★ ' : ''}${esc(s.name)}</div>
          <div style="font-size:11px;color:var(--text-lt)">SEMIS: <b>${esc(s.semis || '—')}</b></div>
        </td>
        <td><span class="tag tag-type">${s.type}</span></td>
        <td style="font-size:11px;color:var(--text-lt)">${formatClassRange(s.classMin, s.classMax)}</td>
        <td>${progressBar}</td>
        <td class="num">
          <span style="font-weight:800;font-size:13px">${s.totalStudents}</span>
          <div style="font-size:10px;color:var(--text-lt)">${s.totalBoys}B / ${s.totalGirls}G</div>
        </td>
        <td>
          <div style="font-weight:600">${esc(s.headTeacher || 'Not Assigned')}</div>
          <div style="font-size:11px;color:var(--text-lt)">${esc(s.contact || '—')}</div>
        </td>
        <td>${actionHtml}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function getIndividualReminderMsg(school) {
  return `Dear ${school.headTeacher || 'Head Teacher'},\n\n` +
    `*URGENT REMINDER: School Enrollment Submission*\n` +
    `*School:* ${school.name}\n` +
    `*Cluster:* Hub GBHS Thari Mirwah (KX03099)\n\n` +
    `Your school data has not yet been submitted in the cluster database. Please open the online portal and submit your class-wise enrollment (Boys/Girls), religion & facilities figures today:\n\n` +
    `🔗 *Portal Link:* https://cluster-hub-thari-mirwah.vercel.app\n\n` +
    `*Steps:* Select your school ⭐, fill enrollment, and click *Save School Data*.\n\n` +
    `Office of the Headmaster, GBHS Thari Mirwah\n` +
    `Website created by: Asif Ali Shar, JEST, GBHS Thari Mirwah`;
}

function sharePortalOnWhatsApp() {
  const msg = `🏫 *Cluster Hub Thari Mirwah (KX03099)*\n` +
    `*Official Annual School Enrollment & Facilities Portal*\n\n` +
    `Dear Head Teachers / School In-charges,\n` +
    `Please submit your school's class-wise enrollment data online:\n\n` +
    `🔗 *Portal Link:* https://cluster-hub-thari-mirwah.vercel.app\n\n` +
    `📝 *Quick Steps to Submit:*\n` +
    `1️⃣ Open link and select your school from the ⭐ dropdown\n` +
    `2️⃣ Enter class-wise Boys & Girls enrollment, Religion & Facilities\n` +
    `3️⃣ Click *'Save School Data'* to save directly to database\n` +
    `4️⃣ Click *'Print School PDF'* to print verified A4 sheet\n\n` +
    `💻 *Website created by:* Asif Ali Shar, JEST, GBHS Thari Mirwah`;

  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
}

function sharePendingListWhatsApp() {
  const rep = subState.data;
  if (!rep) {
    toast('Please load submissions data first', 'err');
    return;
  }
  const pending = rep.pendingSchools || [];
  if (!pending.length) {
    alert('All schools have submitted their data! No pending schools.');
    return;
  }

  let msg = `⚠️ *URGENT: Cluster KX03099 Enrollment Submission Status*\n` +
    `Total Schools: ${rep.totalSchools} | Submitted: ${rep.submittedCount} | *Pending: ${rep.pendingCount}*\n\n` +
    `*List of Pending Defaulter Schools:*\n`;

  pending.forEach((s, idx) => {
    msg += `${idx + 1}. *${s.name}* (${s.type}) - Head: ${s.headTeacher || 'Incharge'} [${s.contact || 'No No.'}]\n`;
  });

  msg += `\n🔗 *Submit online immediately at:*\nhttps://cluster-hub-thari-mirwah.vercel.app\n\n` +
    `Office of the Headmaster, GBHS Thari Mirwah\n` +
    `Website created by: Asif Ali Shar, JEST, GBHS Thari Mirwah`;

  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
}

function generateSubmissionsReportHtml(rep) {
  const c = activeCluster() || { code: 'KX03099', district: 'Khairpur Mirs' };
  let rows = '';

  rep.schools.forEach((s, i) => {
    const isSub = s.isSubmitted;
    const subTimeStr = s.submittedAt ? new Date(s.submittedAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short' }) : '—';

    rows += `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td style="font-weight:700;color:${isSub ? '#166534' : '#991b1b'}">${isSub ? 'SUBMITTED' : 'PENDING'}</td>
        <td style="text-align:center">${esc(s.cell)}</td>
        <td style="font-weight:700">${esc(s.name)}</td>
        <td style="text-align:center">${s.type}</td>
        <td style="text-align:center">${esc(s.semis || '—')}</td>
        <td style="text-align:center">${s.classesWithData} / ${s.totalClasses}</td>
        <td style="text-align:right">${s.totalBoys}</td>
        <td style="text-align:right">${s.totalGirls}</td>
        <td style="text-align:right;font-weight:800">${s.totalStudents}</td>
        <td>${esc(s.headTeacher || '—')}</td>
        <td style="font-size:7.5pt">${subTimeStr}</td>
      </tr>
    `;
  });

  return `
    <div class="print-page">
      <div>
        <div class="p-header">
          <img src="/logo.jpg" alt="Seal" class="p-logo">
          <div class="p-head-text">
            <div class="p-dept">School Education &amp; Literacy Department · Government of Sindh</div>
            <div class="p-title">Office of the Headmaster · Cluster Hub GBHS Thari Mirwah</div>
            <div class="p-sub">Taluka Mirwah · District Khairpur Mirs · Cluster Code: <b>${esc(c.code)}</b> · SEMIS: <b>415060805</b></div>
          </div>
          <div class="p-creator-badge">
            <div style="font-size:6.5pt;text-transform:uppercase;color:#1e40af;font-weight:700">Website Created By</div>
            <div class="p-cr-name">Asif Ali Shar</div>
            <div style="font-size:6.5pt;color:#475569">JEST, GBHS Thari Mirwah</div>
          </div>
        </div>

        <div class="p-doc-badge" style="background:#1e3a8a;color:#fff">Official School Data Submission Status &amp; Defaulters Verification Proforma (2025–2026)</div>

        <div class="p-school-box" style="margin-bottom:8px">
          <div>
            <div class="p-info-row"><span class="p-info-lbl">Total Schools:</span> <span class="p-info-val">${rep.totalSchools} Schools</span></div>
            <div class="p-info-row"><span class="p-info-lbl">Submitted:</span> <span class="p-info-val" style="color:#166534">${rep.submittedCount} Schools (${rep.submissionRate}%)</span></div>
            <div class="p-info-row"><span class="p-info-lbl">Pending Defaulters:</span> <span class="p-info-val" style="color:#991b1b">${rep.pendingCount} Schools</span></div>
          </div>
          <div>
            <div class="p-info-row"><span class="p-info-lbl">Total Enrolled:</span> <span class="p-info-val">${rep.totalStudents} Students (${rep.totalBoys} Boys / ${rep.totalGirls} Girls)</span></div>
            <div class="p-info-row"><span class="p-info-lbl">Cluster Hub:</span> <span class="p-info-val">GBHS Thari Mirwah (KX03099)</span></div>
            <div class="p-info-row"><span class="p-info-lbl">Report Date:</span> <span class="p-info-val">${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })} ${new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span></div>
          </div>
        </div>

        <table class="p-submissions-table">
          <thead>
            <tr>
              <th style="width:24px">#</th>
              <th>Status</th>
              <th>Cell</th>
              <th>School Name</th>
              <th>Type</th>
              <th>SEMIS</th>
              <th>Filled</th>
              <th>Boys</th>
              <th>Girls</th>
              <th>Total</th>
              <th>Head Teacher</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="p-cert">
          <b>Official Undertaking:</b> Certified that this submission tracking report reflects the real-time live database status of Cluster Hub KX03099. Schools flagged as Pending Defaulter have been formally notified via official communication to complete online data entry.
        </div>
      </div>

      <div>
        <div class="p-sigs">
          <div class="p-sig-box">
            <div style="height:32px"></div>
            <div class="p-sig-title">Cluster Monitoring In-charge / Incharge Data Cell</div>
            <div class="p-sig-sub">GBHS Thari Mirwah (Cluster Code: ${esc(c.code)})</div>
          </div>
          <div class="p-sig-box">
            <div style="height:32px"></div>
            <div class="p-sig-title">Headmaster / Cluster Hub Supervisor</div>
            <div class="p-sig-sub">GBHS Thari Mirwah · Taluka Mirwah, Khairpur</div>
          </div>
        </div>

        <div class="p-footer-note">
          Cluster Hub Management Information System • Official Government Proforma • Website created by Asif Ali Shar, JEST, GBHS Thari Mirwah • Printed on: ${new Date().toLocaleString()}
        </div>
      </div>
    </div>
  `;
}

function printSubmissionsReport() {
  const rep = subState.data;
  if (!rep) {
    loadSubmissionsReport(true).then(() => {
      if (subState.data) {
        const container = document.getElementById('printReportContainer');
        container.innerHTML = generateSubmissionsReportHtml(subState.data);
        setTimeout(() => window.print(), 100);
      }
    });
    return;
  }
  const container = document.getElementById('printReportContainer');
  container.innerHTML = generateSubmissionsReportHtml(rep);
  setTimeout(() => window.print(), 100);
}

function printSingleSchoolById(schoolId) {
  const cluster = activeCluster(); if (!cluster) return;
  const school = cluster.schools.find(s => s.id === schoolId);
  if (!school) {
    alert('School not found.');
    return;
  }
  const container = document.getElementById('printReportContainer');
  container.innerHTML = generateSchoolReportHtml(school, cluster);
  setTimeout(() => window.print(), 100);
}

/* ─────────────────────────────────────
   INIT
───────────────────────────────────── */
async function init() {
  updateAuthUI();
  checkHealth();
  setInterval(checkHealth, 15000);
  await loadData();
}

init();

