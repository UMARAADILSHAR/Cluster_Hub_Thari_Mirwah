'use strict';

/* ─────────────────────────────────────
   CONSTANTS
───────────────────────────────────── */
const TYPE_INFO = {
  GBHS:  { label:'Boys High School',              min:1,  max:10 },
  GBPS:  { label:'Boys Primary School',           min:1,  max:5  },
  GGPS:  { label:'Girls Primary School',          min:1,  max:5  },
  GBELS: { label:'Boys Elementary Lower School',  min:1,  max:8  },
  GGELS: { label:'Girls Elementary Lower School', min:1,  max:8  },
  GGHS:  { label:'Girls Higher Secondary School', min:6,  max:12 },
};
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
      dbDot.className = 'dot';
      dbStatusTxt.textContent = `PostgreSQL connected — ${d.database} · ${d.latencyMs}ms`;
    } else throw new Error(d.error);
  } catch (e) {
    dbDot.className = 'dot err';
    dbStatusTxt.textContent = 'Database disconnected';
  }
}

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
      updateAuthUI();
      // auto-load first school
      const sel = document.getElementById('entrySchoolSelect');
      if (sel && !sel.value) {
        const cluster = activeCluster();
        if (cluster && cluster.schools.length) {
          sel.value = cluster.schools[0].id;
          loadSchoolForm();
        }
      } else if (sel && sel.value) {
        loadSchoolForm();
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
  ['sbDashLock','sbSchoolsLock','sbExportLock'].forEach(id => {
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
   PANEL NAVIGATION
───────────────────────────────────── */
function switchPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-item[id^="sb"]').forEach(i => i.classList.remove('active'));
  const panel = document.getElementById(`panel-${name}`);
  if (panel) panel.classList.add('active');
  const sb = document.getElementById(`sb${name.charAt(0).toUpperCase() + name.slice(1)}`);
  if (sb) sb.classList.add('active');
  document.getElementById('navCrumb').textContent = {
    enrollment: 'Enrollment Data',
    dashboard:  'Dashboard',
    schools:    'Schools Register',
    export:     'Export & Print',
  }[name] || name;

  if (name === 'enrollment') document.getElementById('sbEnrollment').classList.add('active');

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
  const prev = sel.value;
  const groups = {};
  cluster.schools.forEach(s => { (groups[s.cell] = groups[s.cell] || []).push(s); });
  let html = '<option value="">— Select a school —</option>';
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
   ENROLLMENT FORM
───────────────────────────────────── */
function loadSchoolForm() {
  const cluster = activeCluster(); if (!cluster) return;
  const sel    = document.getElementById('entrySchoolSelect');
  const school = cluster.schools.find(s => s.id === sel.value);
  if (!school) {
    document.getElementById('classCardsContainer').innerHTML = '';
    document.getElementById('saveFooterArea').style.display = 'none';
    document.getElementById('schoolMetaStrip').innerHTML =
      '<span style="color:var(--text-xlt)">Select a school above to begin</span>';
    return;
  }
  state.currentSchoolId = school.id;
  renderMetaStrip(school);
  renderClassCards(school);
  renderValBanner(school);
  document.getElementById('saveFooterArea').style.display = 'flex';
}

function renderMetaStrip(school) {
  const ti = TYPE_INFO[school.type] || { label: school.type };
  document.getElementById('schoolMetaStrip').innerHTML = `
    <div class="meta-chip"><b>${esc(school.name)}</b></div>
    <div class="meta-chip"><span class="chip-tag ${school.isHub ? 'chip-hub' : 'chip-cell'}">${school.isHub ? 'HUB' : 'Cell ' + school.cell}</span></div>
    <div class="meta-chip"><span class="chip-tag chip-type">${school.type}</span> ${esc(ti.label)}</div>
    <div class="meta-chip">Classes <b>${school.classMin}–${school.classMax}</b></div>
    ${school.semis       ? `<div class="meta-chip">SEMIS: <b>${esc(school.semis)}</b></div>` : ''}
    ${school.headTeacher ? `<div class="meta-chip">Head: <b>${esc(school.headTeacher)}</b></div>` : ''}
    ${school.contact     ? `<div class="meta-chip">📞 <b>${esc(school.contact)}</b></div>` : ''}
  `;
}

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
          <span class="class-badge-pill">CLASS ${cls}</span>
          <span class="class-title-text">Class ${cls}</span>
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

function doPrint() { switchPanel('dashboard'); setTimeout(() => window.print(), 200); }

async function resetCluster() {
  const cluster = activeCluster(); if (!cluster) return;
  if (!confirm(`Reset ALL class figures for Cluster ${cluster.code} to zero?`)) return;
  const d = await api('POST', `/api/clusters/${cluster.code}/reset`);
  if (d.success) { toast('Reset complete'); await loadData(); loadSchoolForm(); }
  else toast('Reset failed: ' + d.error, 'err');
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
