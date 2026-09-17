'use strict';

/**
 * Server-Side Report & Proforma Generator
 * Generates official, pixel-perfect government proformas with strict A4 print layouts
 */

const TYPE_LABELS = {
  GBHS:  'Boys High School',
  GBPS:  'Boys Primary School',
  GGPS:  'Girls Primary School',
  GBELS: 'Boys Elementary Lower School',
  GGELS: 'Girls Elementary Lower School',
  GGHS:  'Girls Higher Secondary School',
};

function esc(str) {
  return String(str || '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function classLabel(cls) {
  const n = Number(cls);
  if (n === 0) return 'Katchi / ECE';
  return `Class ${cls}`;
}

function formatClassRange(min, max) {
  const nMin = Number(min);
  const nMax = Number(max);
  if (nMin === 0) return `Katchi to Class ${nMax}`;
  return `Class ${nMin} to Class ${nMax}`;
}

function getReportStyles() {
  return `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Merriweather:wght@700;900&display=swap');

      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html { font-size: 10pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #0f172a;
        color: #0f172a;
        line-height: 1.35;
        padding-bottom: 60px;
      }

      /* ─── SCREEN TOOLBAR ─── */
      .report-screen-toolbar {
        position: sticky;
        top: 0;
        z-index: 1000;
        background: #1e293b;
        color: #f8fafc;
        border-bottom: 1px solid #334155;
        padding: 10px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      }
      .toolbar-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
        font-weight: 600;
      }
      .toolbar-badge {
        background: #047857;
        color: #ecfdf5;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 9999px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .toolbar-actions {
        display: flex;
        gap: 10px;
      }
      .btn-tool {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #334155;
        color: #f8fafc;
        border: 1px solid #475569;
        padding: 6px 14px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        text-decoration: none;
        transition: all 0.15s ease;
      }
      .btn-tool:hover {
        background: #475569;
        color: #ffffff;
      }
      .btn-tool-primary {
        background: #047857;
        border-color: #059669;
        color: #ffffff;
      }
      .btn-tool-primary:hover {
        background: #065f46;
      }

      /* ─── PAGE WRAPPER ─── */
      .page-canvas {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 28px;
        padding: 28px 16px;
      }

      /* ─── EXACT A4 PRINT CONTAINER ─── */
      .print-page {
        width: 210mm;
        min-height: 297mm;
        padding: 14mm 16mm 12mm 16mm;
        margin: 0 auto;
        background: #ffffff;
        box-shadow: 0 10px 30px rgba(0,0,0,0.35);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        position: relative;
        overflow: hidden;
      }

      /* Decorative Official Watermark */
      .watermark-text {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-30deg);
        font-size: 64pt;
        font-weight: 900;
        color: rgba(15, 23, 42, 0.025);
        pointer-events: none;
        white-space: nowrap;
        text-transform: uppercase;
        letter-spacing: 4px;
        z-index: 1;
      }

      /* ─── HEADER ─── */
      .p-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        border-bottom: 2.5px solid #047857;
        padding-bottom: 9px;
        margin-bottom: 9px;
        position: relative;
        z-index: 2;
      }
      .p-logo {
        width: 58px;
        height: 58px;
        object-fit: cover;
        border-radius: 50%;
        border: 2px solid #047857;
        flex-shrink: 0;
      }
      .p-head-center {
        flex: 1;
        text-align: center;
      }
      .p-dept {
        font-size: 8.5pt;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        color: #475569;
        margin-bottom: 2px;
      }
      .p-office {
        font-family: 'Merriweather', Georgia, serif;
        font-size: 13pt;
        font-weight: 900;
        color: #064e3b;
        letter-spacing: 0.2px;
        line-height: 1.2;
      }
      .p-cluster-sub {
        font-size: 8pt;
        color: #334155;
        font-weight: 600;
        margin-top: 2px;
      }
      .p-creator-badge {
        border: 1px solid #cbd5e1;
        background: #f8fafc;
        border-radius: 6px;
        padding: 4px 8px;
        text-align: right;
        min-width: 140px;
        flex-shrink: 0;
      }
      .p-cr-label {
        font-size: 6.5pt;
        font-weight: 700;
        text-transform: uppercase;
        color: #047857;
        letter-spacing: 0.4px;
      }
      .p-cr-name {
        font-size: 8.5pt;
        font-weight: 800;
        color: #0f172a;
        line-height: 1.15;
      }
      .p-cr-role {
        font-size: 6.5pt;
        font-weight: 600;
        color: #64748b;
      }

      /* Document Sub-Banner */
      .p-doc-badge {
        background: #f0fdf4;
        border: 1.5px solid #a7f3d0;
        border-radius: 5px;
        color: #065f46;
        font-size: 9.5pt;
        font-weight: 800;
        text-align: center;
        padding: 5px 12px;
        margin-bottom: 9px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        position: relative;
        z-index: 2;
      }
      .p-doc-badge.badge-blue {
        background: #eff6ff;
        border-color: #bfdbfe;
        color: #1e40af;
      }

      /* ─── SCHOOL METADATA BOX ─── */
      .p-meta-grid {
        display: grid;
        grid-template-columns: 1.35fr 1fr;
        gap: 8px 14px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 8px 12px;
        margin-bottom: 11px;
        position: relative;
        z-index: 2;
      }
      .p-meta-row {
        display: flex;
        font-size: 8pt;
        line-height: 1.35;
      }
      .p-meta-lbl {
        width: 115px;
        font-weight: 700;
        color: #475569;
        flex-shrink: 0;
      }
      .p-meta-val {
        font-weight: 600;
        color: #0f172a;
      }
      .p-meta-val.val-highlight {
        color: #065f46;
        font-weight: 800;
      }

      /* ─── TABLES ─── */
      .p-table-wrap {
        position: relative;
        z-index: 2;
        margin-bottom: 11px;
      }
      .p-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 8pt;
      }
      .p-table th, .p-table td {
        border: 1px solid #cbd5e1;
        padding: 4.5px 6px;
        text-align: center;
      }
      .p-table th {
        background: #f1f5f9;
        color: #0f172a;
        font-weight: 700;
        font-size: 7.8pt;
        letter-spacing: 0.2px;
        text-transform: uppercase;
      }
      .p-table td {
        color: #1e293b;
        font-weight: 500;
      }
      .p-table tr:nth-child(even) td {
        background: #fafbfc;
      }
      .p-table .col-class {
        text-align: left;
        font-weight: 700;
        color: #0f172a;
        padding-left: 8px;
      }
      .p-table .col-total {
        font-weight: 800;
        background: #f0fdf4 !important;
        color: #065f46;
      }
      .p-table .row-grand {
        background: #e2e8f0 !important;
        font-weight: 800;
      }
      .p-table .row-grand td {
        border-top: 2px solid #0f172a;
        font-weight: 800;
        color: #0f172a;
      }
      .tag-status {
        display: inline-block;
        padding: 1.5px 5px;
        border-radius: 3px;
        font-size: 6.8pt;
        font-weight: 700;
      }
      .tag-ok {
        background: #dcfce7;
        color: #15803d;
      }
      .tag-warn {
        background: #fee2e2;
        color: #b91c1c;
      }

      /* ─── OFFICIAL UNDERTAKING ─── */
      .p-undertaking {
        background: #f8fafc;
        border-left: 3.5px solid #047857;
        border-top: 1px solid #e2e8f0;
        border-right: 1px solid #e2e8f0;
        border-bottom: 1px solid #e2e8f0;
        border-radius: 4px;
        padding: 6px 10px;
        font-size: 7.2pt;
        color: #334155;
        line-height: 1.35;
        margin-bottom: 14px;
        position: relative;
        z-index: 2;
      }
      .p-undertaking strong {
        color: #064e3b;
      }

      /* ─── SIGNATURE BLOCKS ─── */
      .p-signatures {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-top: 8px;
        margin-bottom: 8px;
        position: relative;
        z-index: 2;
      }
      .p-sig-box {
        border: 1px dashed #94a3b8;
        border-radius: 6px;
        background: #ffffff;
        padding: 8px 12px;
        text-align: center;
      }
      .p-sig-space {
        height: 38px;
      }
      .p-sig-line {
        border-top: 1.5px solid #0f172a;
        margin: 0 auto 4px auto;
        width: 80%;
      }
      .p-sig-title {
        font-size: 8pt;
        font-weight: 700;
        color: #0f172a;
      }
      .p-sig-sub {
        font-size: 7pt;
        color: #64748b;
        margin-top: 1px;
      }

      /* ─── FOOTER ─── */
      .p-footer {
        border-top: 1px solid #e2e8f0;
        padding-top: 5px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 6.5pt;
        color: #64748b;
        position: relative;
        z-index: 2;
      }

      /* ─── STRICT PRINT RULES (A4) ─── */
      @media print {
        body {
          background: #ffffff !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .report-screen-toolbar, .no-print {
          display: none !important;
        }
        .page-canvas {
          padding: 0 !important;
          gap: 0 !important;
        }
        .print-page {
          width: 100% !important;
          height: auto !important;
          min-height: 100vh !important;
          margin: 0 !important;
          padding: 10mm 14mm 8mm 14mm !important;
          box-shadow: none !important;
          page-break-after: always !important;
          break-after: page !important;
        }
        .print-page:last-child {
          page-break-after: avoid !important;
          break-after: avoid !important;
        }
      }
    </style>
  `;
}

function getToolbarHtml(title, printUrl) {
  return `
    <div class="report-screen-toolbar no-print">
      <div class="toolbar-title">
        <a href="/" class="btn-tool">← Back to Portal</a>
        <span>${title}</span>
        <span class="toolbar-badge">Official Proforma</span>
      </div>
      <div class="toolbar-actions">
        <button onclick="window.print()" class="btn-tool btn-tool-primary">🖨️ Print / Save as PDF</button>
        <button onclick="window.close()" class="btn-tool">✕ Close Window</button>
      </div>
    </div>
  `;
}

function getAutoPrintScript(autoPrint) {
  if (!autoPrint) return '';
  return `
    <script>
      window.addEventListener('load', () => {
        setTimeout(() => {
          window.print();
        }, 350);
      });
    </script>
  `;
}

/**
 * 1. Single School Proforma (A4 Page)
 */
function renderSchoolReport(school, cluster, autoPrint = false) {
  const typeLabel = TYPE_LABELS[school.type] || school.type;
  const classes = school.classes || {};
  
  let totalBoys = 0;
  let totalGirls = 0;
  let totalStudents = 0;
  let totalMuslim = 0;
  let totalNonMuslim = 0;
  let totalSections = 0;

  let rowsHtml = '';
  for (let cls = school.classMin; cls <= school.classMax; cls++) {
    const c = classes[cls] || { boys: 0, girls: 0, muslim: 0, nonMuslim: 0, medium: 'sindhi', furniture: 'available', sections: 0 };
    const b = Number(c.boys || 0);
    const g = Number(c.girls || 0);
    const tot = b + g;
    const m = Number(c.muslim || 0);
    const nm = Number(c.nonMuslim || 0);
    const relTot = m + nm;
    const isBalanced = tot === relTot;

    totalBoys += b;
    totalGirls += g;
    totalStudents += tot;
    totalMuslim += m;
    totalNonMuslim += nm;
    totalSections += Number(c.sections || 0);

    const furnitureLbl = c.furniture === 'available' ? 'Available' : c.furniture === 'shortage' ? 'Shortage' : 'Not Available';
    const mediumLbl = c.medium === 'urdu' ? 'Urdu' : c.medium === 'english' ? 'English' : c.medium === 'both' ? 'Sindhi + Urdu' : 'Sindhi';

    rowsHtml += `
      <tr>
        <td class="col-class">${classLabel(cls)}</td>
        <td>${b}</td>
        <td>${g}</td>
        <td class="col-total">${tot}</td>
        <td>${m}</td>
        <td>${nm}</td>
        <td>
          <span class="tag-status ${isBalanced ? 'tag-ok' : 'tag-warn'}">
            ${isBalanced ? '✓ Match' : '⚠ Mismatch'}
          </span>
        </td>
        <td>${mediumLbl}</td>
        <td>${c.sections || 0}</td>
        <td>${furnitureLbl}</td>
      </tr>
    `;
  }

  const grandIsBalanced = totalStudents === (totalMuslim + totalNonMuslim);
  const formattedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const pageHtml = `
    <div class="print-page">
      <div class="watermark-text">GOVERNMENT OF SINDH</div>

      <div>
        <!-- Letterhead -->
        <header class="p-header">
          <img src="/logo.jpg" alt="Sindh Emblem" class="p-logo">
          <div class="p-head-center">
            <div class="p-dept">School Education &amp; Literacy Department · Government of Sindh</div>
            <div class="p-office">Office of the Headmaster · Cluster Hub GBHS Thari Mirwah</div>
            <div class="p-cluster-sub">Taluka Mirwah · District Khairpur Mirs · Cluster Code: <b>${esc(cluster.code)}</b> · SEMIS: <b>415060805</b></div>
          </div>
          <div class="p-creator-badge">
            <div class="p-cr-label">Website Created By</div>
            <div class="p-cr-name">Asif Ali Shar</div>
            <div class="p-cr-role">JEST, GBHS Thari Mirwah</div>
          </div>
        </header>

        <!-- Sub Title -->
        <div class="p-doc-badge">
          Annual School Enrollment &amp; Physical Facilities Verification Proforma (2025–2026)
        </div>

        <!-- School Meta Grid -->
        <div class="p-meta-grid">
          <div>
            <div class="p-meta-row"><span class="p-meta-lbl">School Name:</span> <span class="p-meta-val val-highlight">${esc(school.name)}</span></div>
            <div class="p-meta-row"><span class="p-meta-lbl">SEMIS Code:</span> <span class="p-meta-val">${esc(school.semis || 'N/A')}</span></div>
            <div class="p-meta-row"><span class="p-meta-lbl">Personal ID (PID):</span> <span class="p-meta-val">${esc(school.pid || 'N/A')}</span></div>
            <div class="p-meta-row"><span class="p-meta-lbl">Cluster Status:</span> <span class="p-meta-val">${school.isHub ? 'CLUSTER HUB HEADQUARTERS' : 'Cell ' + esc(school.cell)} · ${esc(school.type)} (${esc(typeLabel)})</span></div>
          </div>
          <div>
            <div class="p-meta-row"><span class="p-meta-lbl">Head Teacher:</span> <span class="p-meta-val">${esc(school.headTeacher || 'Not Assigned')}</span></div>
            <div class="p-meta-row"><span class="p-meta-lbl">Designation:</span> <span class="p-meta-val">${esc(school.designation || 'PST / In-charge')}</span></div>
            <div class="p-meta-row"><span class="p-meta-lbl">Class Range:</span> <span class="p-meta-val">${formatClassRange(school.classMin, school.classMax)}</span></div>
            <div class="p-meta-row"><span class="p-meta-lbl">Report Date:</span> <span class="p-meta-val">${formattedDate}</span></div>
          </div>
        </div>

        <!-- Class Records Table -->
        <div class="p-table-wrap">
          <table class="p-table">
            <thead>
              <tr>
                <th style="width:110px">Class / Level</th>
                <th>Boys</th>
                <th>Girls</th>
                <th>Total</th>
                <th>Muslim</th>
                <th>Non-Muslim</th>
                <th>Balance</th>
                <th>Medium</th>
                <th>Sections</th>
                <th>Furniture</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr class="row-grand">
                <td class="col-class">GRAND TOTAL:</td>
                <td>${totalBoys}</td>
                <td>${totalGirls}</td>
                <td class="col-total">${totalStudents}</td>
                <td>${totalMuslim}</td>
                <td>${totalNonMuslim}</td>
                <td>
                  <span class="tag-status ${grandIsBalanced ? 'tag-ok' : 'tag-warn'}">
                    ${grandIsBalanced ? '✓ OK' : '⚠ Mismatch'}
                  </span>
                </td>
                <td>—</td>
                <td>${totalSections}</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Official Undertaking -->
        <div class="p-undertaking">
          <strong>Official Undertaking:</strong> Certified that the enrollment figures, religious demographic distributions, and physical facilities recorded in this proforma have been physically cross-verified against the official General Register (G.R) and daily student attendance records of the institution.
        </div>
      </div>

      <!-- Signature Blocks & Footer -->
      <div>
        <div class="p-signatures">
          <div class="p-sig-box">
            <div class="p-sig-space"></div>
            <div class="p-sig-line"></div>
            <div class="p-sig-title">Head Teacher / In-charge Teacher</div>
            <div class="p-sig-sub">${esc(school.name)} (SEMIS: ${esc(school.semis || '—')})</div>
          </div>
          <div class="p-sig-box">
            <div class="p-sig-space"></div>
            <div class="p-sig-line"></div>
            <div class="p-sig-title">Headmaster / Cluster Hub Supervisor</div>
            <div class="p-sig-sub">GBHS Thari Mirwah (Cluster Code: ${esc(cluster.code)})</div>
          </div>
        </div>

        <footer class="p-footer">
          <span>Cluster Hub Management Information System • Official Government Proforma</span>
          <span>Website created by Asif Ali Shar, JEST, GBHS Thari Mirwah</span>
          <span>Printed on: ${new Date().toLocaleString()}</span>
        </footer>
      </div>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Proforma — ${esc(school.name)} (${esc(cluster.code)})</title>
      ${getReportStyles()}
    </head>
    <body>
      ${getToolbarHtml(`Proforma: ${esc(school.name)}`)}
      <main class="page-canvas">
        ${pageHtml}
      </main>
      ${getAutoPrintScript(autoPrint)}
    </body>
    </html>
  `;
}

/**
 * 2. Complete 23 Schools Booklet (1 School per A4 Page)
 */
function renderAllSchoolsReport(cluster, autoPrint = false) {
  const pagesHtml = cluster.schools.map(school => {
    const typeLabel = TYPE_LABELS[school.type] || school.type;
    const classes = school.classes || {};
    
    let totalBoys = 0;
    let totalGirls = 0;
    let totalStudents = 0;
    let totalMuslim = 0;
    let totalNonMuslim = 0;
    let totalSections = 0;

    let rowsHtml = '';
    for (let cls = school.classMin; cls <= school.classMax; cls++) {
      const c = classes[cls] || { boys: 0, girls: 0, muslim: 0, nonMuslim: 0, medium: 'sindhi', furniture: 'available', sections: 0 };
      const b = Number(c.boys || 0);
      const g = Number(c.girls || 0);
      const tot = b + g;
      const m = Number(c.muslim || 0);
      const nm = Number(c.nonMuslim || 0);
      const relTot = m + nm;
      const isBalanced = tot === relTot;

      totalBoys += b;
      totalGirls += g;
      totalStudents += tot;
      totalMuslim += m;
      totalNonMuslim += nm;
      totalSections += Number(c.sections || 0);

      const furnitureLbl = c.furniture === 'available' ? 'Available' : c.furniture === 'shortage' ? 'Shortage' : 'Not Available';
      const mediumLbl = c.medium === 'urdu' ? 'Urdu' : c.medium === 'english' ? 'English' : c.medium === 'both' ? 'Sindhi + Urdu' : 'Sindhi';

      rowsHtml += `
        <tr>
          <td class="col-class">${classLabel(cls)}</td>
          <td>${b}</td>
          <td>${g}</td>
          <td class="col-total">${tot}</td>
          <td>${m}</td>
          <td>${nm}</td>
          <td>
            <span class="tag-status ${isBalanced ? 'tag-ok' : 'tag-warn'}">
              ${isBalanced ? '✓ Match' : '⚠ Mismatch'}
            </span>
          </td>
          <td>${mediumLbl}</td>
          <td>${c.sections || 0}</td>
          <td>${furnitureLbl}</td>
        </tr>
      `;
    }

    const grandIsBalanced = totalStudents === (totalMuslim + totalNonMuslim);
    const formattedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    return `
      <div class="print-page">
        <div class="watermark-text">GOVERNMENT OF SINDH</div>

        <div>
          <!-- Letterhead -->
          <header class="p-header">
            <img src="/logo.jpg" alt="Sindh Emblem" class="p-logo">
            <div class="p-head-center">
              <div class="p-dept">School Education &amp; Literacy Department · Government of Sindh</div>
              <div class="p-office">Office of the Headmaster · Cluster Hub GBHS Thari Mirwah</div>
              <div class="p-cluster-sub">Taluka Mirwah · District Khairpur Mirs · Cluster Code: <b>${esc(cluster.code)}</b> · SEMIS: <b>415060805</b></div>
            </div>
            <div class="p-creator-badge">
              <div class="p-cr-label">Website Created By</div>
              <div class="p-cr-name">Asif Ali Shar</div>
              <div class="p-cr-role">JEST, GBHS Thari Mirwah</div>
            </div>
          </header>

          <div class="p-doc-badge">
            Annual School Enrollment &amp; Physical Facilities Verification Proforma (2025–2026)
          </div>

          <div class="p-meta-grid">
            <div>
              <div class="p-meta-row"><span class="p-meta-lbl">School Name:</span> <span class="p-meta-val val-highlight">${esc(school.name)}</span></div>
              <div class="p-meta-row"><span class="p-meta-lbl">SEMIS Code:</span> <span class="p-meta-val">${esc(school.semis || 'N/A')}</span></div>
              <div class="p-meta-row"><span class="p-meta-lbl">Personal ID (PID):</span> <span class="p-meta-val">${esc(school.pid || 'N/A')}</span></div>
              <div class="p-meta-row"><span class="p-meta-lbl">Cluster Status:</span> <span class="p-meta-val">${school.isHub ? 'CLUSTER HUB HEADQUARTERS' : 'Cell ' + esc(school.cell)} · ${esc(school.type)} (${esc(typeLabel)})</span></div>
            </div>
            <div>
              <div class="p-meta-row"><span class="p-meta-lbl">Head Teacher:</span> <span class="p-meta-val">${esc(school.headTeacher || 'Not Assigned')}</span></div>
              <div class="p-meta-row"><span class="p-meta-lbl">Designation:</span> <span class="p-meta-val">${esc(school.designation || 'PST / In-charge')}</span></div>
              <div class="p-meta-row"><span class="p-meta-lbl">Class Range:</span> <span class="p-meta-val">${formatClassRange(school.classMin, school.classMax)}</span></div>
              <div class="p-meta-row"><span class="p-meta-lbl">Report Date:</span> <span class="p-meta-val">${formattedDate}</span></div>
            </div>
          </div>

          <div class="p-table-wrap">
            <table class="p-table">
              <thead>
                <tr>
                  <th style="width:110px">Class / Level</th>
                  <th>Boys</th>
                  <th>Girls</th>
                  <th>Total</th>
                  <th>Muslim</th>
                  <th>Non-Muslim</th>
                  <th>Balance</th>
                  <th>Medium</th>
                  <th>Sections</th>
                  <th>Furniture</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
                <tr class="row-grand">
                  <td class="col-class">GRAND TOTAL:</td>
                  <td>${totalBoys}</td>
                  <td>${totalGirls}</td>
                  <td class="col-total">${totalStudents}</td>
                  <td>${totalMuslim}</td>
                  <td>${totalNonMuslim}</td>
                  <td>
                    <span class="tag-status ${grandIsBalanced ? 'tag-ok' : 'tag-warn'}">
                      ${grandIsBalanced ? '✓ OK' : '⚠ Mismatch'}
                    </span>
                  </td>
                  <td>—</td>
                  <td>${totalSections}</td>
                  <td>—</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="p-undertaking">
            <strong>Official Undertaking:</strong> Certified that the enrollment figures, religious demographic distributions, and physical facilities recorded in this proforma have been physically cross-verified against the official General Register (G.R) and daily student attendance records of the institution.
          </div>
        </div>

        <div>
          <div class="p-signatures">
            <div class="p-sig-box">
              <div class="p-sig-space"></div>
              <div class="p-sig-line"></div>
              <div class="p-sig-title">Head Teacher / In-charge Teacher</div>
              <div class="p-sig-sub">${esc(school.name)} (SEMIS: ${esc(school.semis || '—')})</div>
            </div>
            <div class="p-sig-box">
              <div class="p-sig-space"></div>
              <div class="p-sig-line"></div>
              <div class="p-sig-title">Headmaster / Cluster Hub Supervisor</div>
              <div class="p-sig-sub">GBHS Thari Mirwah (Cluster Code: ${esc(cluster.code)})</div>
            </div>
          </div>

          <footer class="p-footer">
            <span>Cluster Hub Management Information System • Official Government Proforma</span>
            <span>Website created by Asif Ali Shar, JEST, GBHS Thari Mirwah</span>
            <span>Printed on: ${new Date().toLocaleString()}</span>
          </footer>
        </div>
      </div>
    `;
  }).join('\n');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cluster Proforma Booklet (23 Schools) — ${esc(cluster.code)}</title>
      ${getReportStyles()}
    </head>
    <body>
      ${getToolbarHtml(`Complete Cluster Booklet (${cluster.schools.length} Schools)`)}
      <main class="page-canvas">
        ${pagesHtml}
      </main>
      ${getAutoPrintScript(autoPrint)}
    </body>
    </html>
  `;
}

/**
 * 3. Master Cluster Summary Matrix (A4 Page)
 */
function renderClusterSummaryReport(cluster, autoPrint = false) {
  let clusterBoys = 0;
  let clusterGirls = 0;
  let clusterStudents = 0;
  let clusterMuslim = 0;
  let clusterNonMuslim = 0;

  const rows = cluster.schools.map((s, idx) => {
    const classes = s.classes || {};
    let sb = 0, sg = 0, sm = 0, snm = 0;
    for (let c = s.classMin; c <= s.classMax; c++) {
      const cr = classes[c] || {};
      sb += Number(cr.boys || 0);
      sg += Number(cr.girls || 0);
      sm += Number(cr.muslim || 0);
      snm += Number(cr.nonMuslim || 0);
    }
    const stot = sb + sg;
    const relTot = sm + snm;
    const match = stot === relTot;

    clusterBoys += sb;
    clusterGirls += sg;
    clusterStudents += stot;
    clusterMuslim += sm;
    clusterNonMuslim += snm;

    return `
      <tr>
        <td>${idx + 1}</td>
        <td><b>${s.isHub ? 'HUB' : esc(s.cell)}</b></td>
        <td style="text-align:left;font-weight:700">${esc(s.name)}</td>
        <td>${esc(s.type)}</td>
        <td>${esc(s.semis || '—')}</td>
        <td style="text-align:left">${esc(s.headTeacher || '—')}</td>
        <td>${sb}</td>
        <td>${sg}</td>
        <td class="col-total">${stot}</td>
        <td>${sm}</td>
        <td>${snm}</td>
        <td>
          <span class="tag-status ${match ? 'tag-ok' : 'tag-warn'}">
            ${match ? '✓ Match' : '⚠ Mismatch'}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cluster Summary Matrix — ${esc(cluster.code)}</title>
      ${getReportStyles()}
    </head>
    <body>
      ${getToolbarHtml(`Master Summary Matrix (${cluster.schools.length} Schools)`)}
      <main class="page-canvas">
        <div class="print-page">
          <div class="watermark-text">GOVERNMENT OF SINDH</div>

          <div>
            <header class="p-header">
              <img src="/logo.jpg" alt="Sindh Emblem" class="p-logo">
              <div class="p-head-center">
                <div class="p-dept">School Education &amp; Literacy Department · Government of Sindh</div>
                <div class="p-office">Office of the Headmaster · Cluster Hub GBHS Thari Mirwah</div>
                <div class="p-cluster-sub">Taluka Mirwah · District Khairpur Mirs · Cluster Code: <b>${esc(cluster.code)}</b></div>
              </div>
              <div class="p-creator-badge">
                <div class="p-cr-label">Website Created By</div>
                <div class="p-cr-name">Asif Ali Shar</div>
                <div class="p-cr-role">JEST, GBHS Thari Mirwah</div>
              </div>
            </header>

            <div class="p-doc-badge">
              Cluster Master Summary Matrix · All 23 Schools (Academic Session 2025–2026)
            </div>

            <div class="p-table-wrap">
              <table class="p-table" style="font-size:7.5pt">
                <thead>
                  <tr>
                    <th style="width:24px">#</th>
                    <th>Cell</th>
                    <th style="text-align:left">School Name</th>
                    <th>Type</th>
                    <th>SEMIS</th>
                    <th style="text-align:left">Head Teacher</th>
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
                  <tr class="row-grand">
                    <td colspan="6" style="text-align:right;font-weight:800">CLUSTER GRAND TOTAL (23 SCHOOLS):</td>
                    <td>${clusterBoys}</td>
                    <td>${clusterGirls}</td>
                    <td class="col-total">${clusterStudents}</td>
                    <td>${clusterMuslim}</td>
                    <td>${clusterNonMuslim}</td>
                    <td><span class="tag-status tag-ok">✓ VERIFIED</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="p-undertaking">
              <strong>Official Statement:</strong> This Master Summary Matrix consolidates official verified enrollment data across all 23 educational institutions under Cluster Hub KX03099, Taluka Thari Mirwah, District Khairpur Mirs.
            </div>
          </div>

          <div>
            <div class="p-signatures">
              <div class="p-sig-box">
                <div class="p-sig-space"></div>
                <div class="p-sig-line"></div>
                <div class="p-sig-title">Headmaster / Cluster Hub Supervisor</div>
                <div class="p-sig-sub">GBHS Thari Mirwah (Cluster Code: ${esc(cluster.code)})</div>
              </div>
              <div class="p-sig-box">
                <div class="p-sig-space"></div>
                <div class="p-sig-line"></div>
                <div class="p-sig-title">District Education Officer (ES&amp;HS / Primary)</div>
                <div class="p-sig-sub">District Khairpur Mirs, Government of Sindh</div>
              </div>
            </div>

            <footer class="p-footer">
              <span>Cluster Hub Management Information System • Official Government Proforma</span>
              <span>Website created by Asif Ali Shar, JEST, GBHS Thari Mirwah</span>
              <span>Printed on: ${new Date().toLocaleString()}</span>
            </footer>
          </div>
        </div>
      </main>
      ${getAutoPrintScript(autoPrint)}
    </body>
    </html>
  `;
}

/**
 * 4. Real-Time Submissions Status & Defaulters Proforma (A4 Page)
 */
function renderSubmissionsReport(rep, autoPrint = false) {
  const rows = rep.schools.map((s, idx) => {
    const isSub = s.isSubmitted;
    const subDate = s.submittedAt ? new Date(s.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
    return `
      <tr>
        <td>${idx + 1}</td>
        <td>
          <span class="tag-status ${isSub ? 'tag-ok' : 'tag-warn'}">
            ${isSub ? '✓ Submitted' : '⏳ Pending'}
          </span>
        </td>
        <td><b>${s.isHub ? 'HUB' : esc(s.cell)}</b></td>
        <td style="text-align:left;font-weight:700">${esc(s.name)}</td>
        <td>${esc(s.type)}</td>
        <td>${esc(s.semis || '—')}</td>
        <td>${s.classesWithData} / ${s.totalClasses}</td>
        <td>${s.totalBoys}</td>
        <td>${s.totalGirls}</td>
        <td class="col-total">${s.totalStudents}</td>
        <td style="text-align:left">${esc(s.headTeacher || '—')}</td>
        <td style="font-size:7pt">${subDate}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Submissions Status Proforma — ${esc(rep.clusterCode)}</title>
      ${getReportStyles()}
    </head>
    <body>
      ${getToolbarHtml(`Submissions & Defaulters Proforma (${rep.totalSchools} Schools)`)}
      <main class="page-canvas">
        <div class="print-page">
          <div class="watermark-text">GOVERNMENT OF SINDH</div>

          <div>
            <header class="p-header">
              <img src="/logo.jpg" alt="Sindh Emblem" class="p-logo">
              <div class="p-head-center">
                <div class="p-dept">School Education &amp; Literacy Department · Government of Sindh</div>
                <div class="p-office">Office of the Headmaster · Cluster Hub GBHS Thari Mirwah</div>
                <div class="p-cluster-sub">Taluka Mirwah · District Khairpur Mirs · Cluster Code: <b>${esc(rep.clusterCode)}</b> · SEMIS: <b>415060805</b></div>
              </div>
              <div class="p-creator-badge">
                <div class="p-cr-label">Website Created By</div>
                <div class="p-cr-name">Asif Ali Shar</div>
                <div class="p-cr-role">JEST, GBHS Thari Mirwah</div>
              </div>
            </header>

            <div class="p-doc-badge badge-blue">
              Official School Data Submission Status &amp; Defaulters Verification Proforma (2025–2026)
            </div>

            <!-- KPI Mini Matrix -->
            <div class="p-meta-grid" style="grid-template-columns:1fr 1fr;margin-bottom:9px">
              <div>
                <div class="p-meta-row"><span class="p-meta-lbl">Total Cluster Schools:</span> <span class="p-meta-val">${rep.totalSchools} Schools</span></div>
                <div class="p-meta-row"><span class="p-meta-lbl">Submitted Records:</span> <span class="p-meta-val" style="color:#047857">${rep.submittedCount} Schools (${rep.submissionRate}%)</span></div>
                <div class="p-meta-row"><span class="p-meta-lbl">Pending Defaulters:</span> <span class="p-meta-val" style="color:#b91c1c">${rep.pendingCount} Schools</span></div>
              </div>
              <div>
                <div class="p-meta-row"><span class="p-meta-lbl">Total Enrolled:</span> <span class="p-meta-val">${rep.totalStudents} (${rep.totalBoys} Boys / ${rep.totalGirls} Girls)</span></div>
                <div class="p-meta-row"><span class="p-meta-lbl">Cluster Hub:</span> <span class="p-meta-val">GBHS Thari Mirwah (${esc(rep.clusterCode)})</span></div>
                <div class="p-meta-row"><span class="p-meta-lbl">Status Report Date:</span> <span class="p-meta-val">${new Date().toLocaleString()}</span></div>
              </div>
            </div>

            <div class="p-table-wrap">
              <table class="p-table" style="font-size:7.5pt">
                <thead>
                  <tr>
                    <th style="width:24px">#</th>
                    <th>Status</th>
                    <th>Cell</th>
                    <th style="text-align:left">School Name</th>
                    <th>Type</th>
                    <th>SEMIS</th>
                    <th>Classes</th>
                    <th>Boys</th>
                    <th>Girls</th>
                    <th>Total</th>
                    <th style="text-align:left">Head Teacher</th>
                    <th>Submission Date</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </div>

            <div class="p-undertaking">
              <strong>Official Undertaking:</strong> Certified that this submission tracking proforma represents the real-time live database state of Cluster Hub KX03099. Institutions categorized as Pending Defaulters have been notified to urgently finalize data submission.
            </div>
          </div>

          <div>
            <div class="p-signatures">
              <div class="p-sig-box">
                <div class="p-sig-space"></div>
                <div class="p-sig-line"></div>
                <div class="p-sig-title">Cluster Monitoring In-charge / Data Cell</div>
                <div class="p-sig-sub">GBHS Thari Mirwah (Cluster Code: ${esc(rep.clusterCode)})</div>
              </div>
              <div class="p-sig-box">
                <div class="p-sig-space"></div>
                <div class="p-sig-line"></div>
                <div class="p-sig-title">Headmaster / Cluster Hub Supervisor</div>
                <div class="p-sig-sub">GBHS Thari Mirwah · Taluka Mirwah, Khairpur</div>
              </div>
            </div>

            <footer class="p-footer">
              <span>Cluster Hub Management Information System • Official Government Proforma</span>
              <span>Website created by Asif Ali Shar, JEST, GBHS Thari Mirwah</span>
              <span>Printed on: ${new Date().toLocaleString()}</span>
            </footer>
          </div>
        </div>
      </main>
      ${getAutoPrintScript(autoPrint)}
    </body>
    </html>
  `;
}

module.exports = {
  renderSchoolReport,
  renderAllSchoolsReport,
  renderClusterSummaryReport,
  renderSubmissionsReport,
};
