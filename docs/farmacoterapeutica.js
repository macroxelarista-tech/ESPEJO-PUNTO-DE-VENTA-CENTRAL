(function (global) {
  'use strict';

  const MODULE_ID = 'farmacoterapeutica';
  const state = {
    prepared: false,
    loading: false,
    items: [],
    filtered: [],
    traces: new Map(),
    selectedKey: '',
    excludedDepartments: new Set(),
    lastLoadedAt: 0
  };

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const plain = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const norm = value => plain(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const num = value => {
    const n = Number(String(value ?? '').replace(/[$,%\s,]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = value => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(Number(value || 0));
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const toVisibleDate = iso => {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : (plain(iso) || '—');
  };
  const parseDateISO = value => {
    const raw = plain(value);
    if (!raw || raw === '-') return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0,10);
    const dmy = raw.split(',')[0].trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (!dmy) return '';
    let y = dmy[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${String(Number(dmy[2])).padStart(2,'0')}-${String(Number(dmy[1])).padStart(2,'0')}`;
  };
  const earliest = (a,b) => !a ? b : (!b ? a : (a <= b ? a : b));
  const latest = (a,b) => !a ? b : (!b ? a : (a >= b ? a : b));

  function notify(message, title = 'Farmacoterapéutica') {
    try {
      if (typeof global.notificarSistema === 'function') global.notificarSistema(message, title);
      else console.info(`${title}: ${message}`);
    } catch (_) { console.info(`${title}: ${message}`); }
  }

  function injectStyles() {
    if ($('macroxel-farmacoterapeutica-style')) return;
    const style = document.createElement('style');
    style.id = 'macroxel-farmacoterapeutica-style';
    style.textContent = `
      #${MODULE_ID} .ft-toolbar{display:grid;grid-template-columns:minmax(260px,1.6fr) minmax(170px,.7fr) minmax(170px,.7fr) minmax(230px,1fr);gap:10px;align-items:end;margin-bottom:10px}
      #${MODULE_ID} .ft-field{display:flex;flex-direction:column;gap:5px;min-width:0}
      #${MODULE_ID} .ft-field label{font-size:11px;font-weight:900;color:#12385f;text-transform:uppercase}
      #${MODULE_ID} .ft-field input,#${MODULE_ID} .ft-field select{height:34px;border:1px solid #c9d8e7;border-radius:8px;padding:0 10px;background:#fff;font-weight:700;color:#132f4e;width:100%;box-sizing:border-box}
      #${MODULE_ID} .ft-dept-filter{position:relative}
      #${MODULE_ID} .ft-dept-filter summary{height:34px;border:1px solid #c9d8e7;border-radius:8px;padding:8px 10px;background:#fff;box-sizing:border-box;cursor:pointer;font-weight:800;color:#163a60;list-style:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #${MODULE_ID} .ft-dept-filter summary::-webkit-details-marker{display:none}
      #${MODULE_ID} .ft-dept-menu{position:absolute;z-index:120;top:38px;right:0;left:0;min-width:310px;max-height:330px;overflow:auto;background:#fff;border:1px solid #b9ccdf;border-radius:10px;box-shadow:0 12px 28px rgba(0,34,70,.18);padding:10px}
      #${MODULE_ID} .ft-dept-actions{display:flex;gap:7px;position:sticky;top:-10px;background:#fff;padding:0 0 8px;z-index:1}
      #${MODULE_ID} .ft-dept-item{display:flex;gap:8px;align-items:center;padding:6px 4px;border-bottom:1px solid #edf2f7;font-size:12px;font-weight:700;color:#173d63}
      #${MODULE_ID} .ft-dept-item input{width:16px;height:16px;margin:0}
      #${MODULE_ID} .ft-kpis{display:grid;grid-template-columns:repeat(5,minmax(130px,1fr));gap:10px;margin:10px 0}
      #${MODULE_ID} .ft-kpi{border:1px solid #d9e5ef;border-radius:12px;padding:10px 12px;background:#f8fbfe;min-width:0}
      #${MODULE_ID} .ft-kpi span{display:block;font-size:10px;font-weight:900;color:#60758a;text-transform:uppercase}
      #${MODULE_ID} .ft-kpi strong{display:block;font-size:20px;color:#0e477c;margin-top:3px}
      #${MODULE_ID} .ft-kpi.warn strong{color:#b85d00}
      #${MODULE_ID} .ft-info{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:11px;font-weight:750;color:#536a80;margin:7px 0}
      #${MODULE_ID} .ft-table-wrap{border:1px solid #cfdeeb;border-radius:12px;overflow:auto;max-height:55vh;background:#fff}
      #${MODULE_ID} table.ft-table{width:100%;border-collapse:collapse;min-width:1760px;font-size:10px}
      #${MODULE_ID} .ft-table th{position:sticky;top:0;z-index:2;background:#e8f2fb;color:#0b365e;text-align:left;padding:8px 7px;border-bottom:1px solid #bad0e2;text-transform:uppercase;font-size:9px}
      #${MODULE_ID} .ft-table td{padding:7px;border-bottom:1px solid #e5edf4;vertical-align:top;color:#1a334c}
      #${MODULE_ID} .ft-table tbody tr{cursor:pointer}
      #${MODULE_ID} .ft-table tbody tr:hover{background:#f3f9ff}
      #${MODULE_ID} .ft-table tbody tr.ft-selected{background:#fff7d8;outline:1px solid #e7bc40}
      #${MODULE_ID} .ft-badge{display:inline-block;border-radius:999px;padding:3px 7px;font-size:9px;font-weight:900;white-space:nowrap;background:#e5eef7;color:#224663}
      #${MODULE_ID} .ft-badge.ok{background:#dff6e7;color:#087134}
      #${MODULE_ID} .ft-badge.warn{background:#fff1d5;color:#9d5900}
      #${MODULE_ID} .ft-badge.danger{background:#ffe0e0;color:#a32020}
      #${MODULE_ID} .ft-detail{margin-top:12px;border:1px solid #cfdeeb;border-radius:12px;background:#fafdff;padding:12px}
      #${MODULE_ID} .ft-detail[hidden]{display:none}
      #${MODULE_ID} .ft-detail-title{display:flex;justify-content:space-between;gap:12px;align-items:start;border-bottom:1px solid #dae6ef;padding-bottom:9px;margin-bottom:10px}
      #${MODULE_ID} .ft-detail-title h3{margin:0;color:#0a3f70;font-size:16px}
      #${MODULE_ID} .ft-detail-title p{margin:3px 0 0;color:#667b90;font-size:11px}
      #${MODULE_ID} .ft-detail-grid{display:grid;grid-template-columns:repeat(4,minmax(180px,1fr));gap:8px}
      #${MODULE_ID} .ft-detail-cell{background:#fff;border:1px solid #dfebf4;border-radius:9px;padding:8px;min-width:0}
      #${MODULE_ID} .ft-detail-cell span{display:block;font-size:9px;text-transform:uppercase;font-weight:900;color:#70849a}
      #${MODULE_ID} .ft-detail-cell strong{display:block;margin-top:3px;font-size:11px;color:#163b60;word-break:break-word}
      #${MODULE_ID} .ft-indication{grid-column:1/-1}
      @media(max-width:1100px){#${MODULE_ID} .ft-toolbar{grid-template-columns:1fr 1fr}#${MODULE_ID} .ft-kpis{grid-template-columns:repeat(2,1fr)}#${MODULE_ID} .ft-detail-grid{grid-template-columns:repeat(2,1fr)}}
    `;
    document.head.appendChild(style);
  }

  async function waitSQLite(maxMs = 8000) {
    try {
      if (typeof global.esperarSQLiteFinanciero === 'function') {
        await global.esperarSQLiteFinanciero(maxMs);
        return;
      }
      if (typeof global.iniciarSQLiteAltoVolumen === 'function') await global.iniciarSQLiteAltoVolumen(false);
    } catch (_) {}
    const until = Date.now() + Math.max(1000, Number(maxMs || 8000));
    while (global.macroxelSQLiteEstado?.migrando && Date.now() < until) {
      await new Promise(resolve => setTimeout(resolve, 80));
    }
  }

  async function queryAll(tableId, pageSize = 5000) {
    await waitSQLite();
    if (global.macroxelLocalDB?.query) {
      const all = [];
      let page = 1;
      let total = Infinity;
      while (all.length < total && page <= 1000) {
        const r = await global.macroxelLocalDB.query({ tableId, page, pageSize, search:'', filters:[], includeTotal: page === 1 });
        if (!r?.ok) break;
        const rows = Array.isArray(r.rows) ? r.rows : [];
        all.push(...rows);
        if (page === 1 && Number.isFinite(Number(r.total)) && Number(r.total) >= 0) total = Number(r.total);
        if (!rows.length || rows.length < pageSize) break;
        page += 1;
        if (page % 4 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (all.length) return all;
    }
    const table = document.getElementById(tableId);
    return Array.from(table?.tBodies?.[0]?.rows || []).map((tr, index) => ({
      key: tr.dataset?.rowKey || `${tableId}-${index}`,
      orderIndex: index + 1,
      cells: Array.from(tr.cells || []).map(td => plain(td.querySelector('input,select,textarea')?.value ?? td.textContent)),
      attrs: { dataset: { ...(tr.dataset || {}) } }
    }));
  }

  function ds(row) {
    const raw = row?.attrs?.dataset || row?.dataset || {};
    return raw && typeof raw === 'object' ? raw : {};
  }

  function traceKey(code, generic, distinctive, presentation) {
    const c = norm(code);
    return c ? `C:${c}` : `P:${norm(generic)}|${norm(distinctive)}|${norm(presentation)}`;
  }

  function classifyMovement(value) {
    const t = norm(value);
    if (t.includes('ENTRADA') || t.includes('ADQUISIC') || t.includes('COMPRA') || t.includes('DEVOLUCION CLIENTE')) return 'ENTRADA';
    if (t.includes('VENTA') || t.includes('RECETA')) return 'VENTA';
    if (t.includes('SALIDA') || t.includes('DESTRUCCION') || t.includes('AJUSTE NEGATIVO')) return 'SALIDA';
    return 'OTRO';
  }

  function buildTrace(rows) {
    const map = new Map();
    for (const row of rows || []) {
      const c = row.cells || [];
      if (!c.length) continue;
      const code = plain(c[3]);
      const generic = plain(c[4]);
      const distinctive = plain(c[5]);
      const key = traceKey(code, generic, distinctive, '');
      if (!key) continue;
      const date = parseDateISO(c[0]);
      const movement = plain(c[7]);
      const type = classifyMovement(movement);
      const qty = Math.abs(num(c[8]));
      const current = map.get(key) || {
        firstDate:'', firstFolio:'', lastDate:'', lastFolio:'', lastMovement:'', lastUser:'',
        lastEntryDate:'', lastEntryFolio:'', lastEntryParty:'', lastSaleDate:'', lastSaleFolio:'',
        movements:0, entered:0, sold:0, exited:0, titular:''
      };
      current.movements += 1;
      if (date && (!current.firstDate || date < current.firstDate)) { current.firstDate = date; current.firstFolio = plain(c[1]); }
      if (date && (!current.lastDate || date > current.lastDate || (date === current.lastDate && plain(c[1]) > current.lastFolio))) {
        current.lastDate = date; current.lastFolio = plain(c[1]); current.lastMovement = movement; current.lastUser = plain(c[14]);
      }
      if (type === 'ENTRADA') {
        current.entered += qty;
        if (date && (!current.lastEntryDate || date >= current.lastEntryDate)) { current.lastEntryDate = date; current.lastEntryFolio = plain(c[1]); current.lastEntryParty = plain(c[9]); }
      } else if (type === 'VENTA') {
        current.sold += qty;
        if (date && (!current.lastSaleDate || date >= current.lastSaleDate)) { current.lastSaleDate = date; current.lastSaleFolio = plain(c[1]); }
      } else if (type === 'SALIDA') current.exited += qty;
      if (!current.titular && plain(c[16])) current.titular = plain(c[16]);
      map.set(key, current);
    }
    return map;
  }

  function sanitaryField(dataset, names) {
    for (const n of names) {
      const v = plain(dataset?.[n]);
      if (v && v !== '-') return v;
    }
    return '';
  }

  function compactSanitaryFraction(value) {
    const raw = plain(value);
    if (!raw || raw === '-') return '';
    const upper = norm(raw);
    const explicit = upper.match(/\bFRACCION\s*(VI|IV|V|III|II|I|[1-6])\b/);
    const leading = upper.match(/^(VI|IV|V|III|II|I|[1-6])(?:\b|[.):-])/);
    const token = (explicit || leading)?.[1] || '';
    if (!token) return '';
    const numeric = { '1':'I', '2':'II', '3':'III', '4':'IV', '5':'V', '6':'VI' };
    return numeric[token] || token;
  }

  function isMedicine(item) {
    const dep = norm(item.department);
    const strong = /ANTIBIOT|ANTIMICROB|MEDIC|GENERIC|PATENTE|CONTROLAD|PSICOTROP|ESTUPEFAC|ACCESO|VIGILANCIA|RESERVA|OTC|FARMAC/.test(dep);
    if (strong || item.registration || item.fraction || item.indication) return true;
    const non = /ASEO|LIMPIEZA|PAPELERIA|ALIMENTO|BEBIDA|DULCE|BOTANA|PAQUETERIA|SERVICIO|RECARGA|COSMET|PERFUM|ACCESORIO|JUGUETE/.test(dep);
    return !non && Boolean(item.generic && item.presentation);
  }

  function productStatus(item) {
    if (item.stock <= 0) return { key:'SIN_EXISTENCIA', label:'SIN EXISTENCIA', cls:'warn' };
    const today = todayISO();
    const activeLots = item.lots.filter(l => Number(l.stock || 0) > 0 && l.expiryISO);
    if (activeLots.length && activeLots.every(l => l.expiryISO < today)) return { key:'CADUCADO', label:'CADUCADO', cls:'danger' };
    const threshold = new Date(`${today}T00:00:00`); threshold.setDate(threshold.getDate() + 90);
    const thresholdISO = `${threshold.getFullYear()}-${String(threshold.getMonth()+1).padStart(2,'0')}-${String(threshold.getDate()).padStart(2,'0')}`;
    if (activeLots.some(l => l.expiryISO >= today && l.expiryISO <= thresholdISO)) return { key:'POR_CADUCAR', label:'POR CADUCAR', cls:'warn' };
    return { key:'ACTIVO', label:'ACTIVO', cls:'ok' };
  }

  function groupInventory(rows, traces) {
    const groups = new Map();
    for (const row of rows || []) {
      const c = row.cells || [];
      if (!c.length) continue;
      const code = plain(c[0]);
      const generic = plain(c[1]);
      const distinctive = plain(c[2]);
      const presentation = plain(c[3]);
      const key = traceKey(code, generic, distinctive, presentation);
      if (!key) continue;
      const dataset = ds(row);
      const g = groups.get(key) || {
        key, code, generic, distinctive, presentation, department:'', stock:0, lots:[], registration:'', fraction:'', indication:'', titular:'',
        altaDataset:'', rows:0, rowKeys:[]
      };
      g.rows += 1;
      if (row.key) g.rowKeys.push(row.key);
      g.stock += num(c[7]);
      if (!g.department && plain(c[8])) g.department = plain(c[8]);
      const expiryISO = parseDateISO(c[5]);
      const lot = plain(c[4]);
      if (lot || expiryISO) g.lots.push({ lot: lot || '—', expiry: plain(c[5]) || '—', expiryISO, stock:num(c[7]) });
      g.registration ||= sanitaryField(dataset, ['registroSanitario','numeroRegistroSanitario','controlRegistroSanitario','registroSanitarioNumero']);
      g.fraction ||= compactSanitaryFraction(sanitaryField(dataset, ['fraccionSanitaria','fraccion','controlFraccionSanitaria']));
      g.indication ||= sanitaryField(dataset, ['indicacionSanitaria','indicacionesTerapeuticas','indicacionTerapeutica']);
      g.titular ||= sanitaryField(dataset, ['titularSanitario','titularRegistroSanitario','laboratorioSanitario']);
      g.altaDataset = earliest(g.altaDataset, parseDateISO(dataset.fechaAltaCatalogo || dataset.fechaAlta || ''));
      groups.set(key, g);
    }
    const out = [];
    for (const g of groups.values()) {
      let trace = traces.get(traceKey(g.code, g.generic, g.distinctive, '')) || null;
      if (!trace && g.code) trace = traces.get(`C:${norm(g.code)}`) || null;
      const item = { ...g, trace };
      if (!item.titular && trace?.titular) item.titular = trace.titular;
      item.dateAlta = earliest(item.altaDataset, trace?.firstDate || '');
      item.status = productStatus(item);
      item.isMedicine = isMedicine(item);
      item.lotSummary = item.lots.length ? item.lots.map(l => `${l.lot} / ${l.expiry || '—'} (${fmt(l.stock)})`).join(' · ') : '—';
      item.lastMoveDate = trace?.lastDate || '';
      item.lastMove = trace?.lastMovement || '';
      item.lastEntryDate = trace?.lastEntryDate || '';
      item.lastSaleDate = trace?.lastSaleDate || '';
      out.push(item);
    }
    return out.sort((a,b) => `${norm(a.generic)}|${norm(a.distinctive)}|${norm(a.code)}`.localeCompare(`${norm(b.generic)}|${norm(b.distinctive)}|${norm(b.code)}`, 'es'));
  }

  function deptList(items) {
    return Array.from(new Set((items || []).map(i => plain(i.department) || 'SIN DEPARTAMENTO'))).sort((a,b) => a.localeCompare(b,'es'));
  }

  function renderDepartmentFilter() {
    const host = $('ft-departamentos-lista');
    if (!host) return;
    const depts = deptList(state.items);
    const valid = new Set(depts.map(norm));
    state.excludedDepartments = new Set(Array.from(state.excludedDepartments).filter(v => valid.has(v)));
    host.innerHTML = depts.map(dep => {
      const n = norm(dep);
      const checked = state.excludedDepartments.has(n) ? ' checked' : '';
      return `<label class="ft-dept-item"><input type="checkbox" data-ft-department="${esc(n)}"${checked}><span>${esc(dep)}</span></label>`;
    }).join('') || '<div class="ft-dept-item">SIN DEPARTAMENTOS REGISTRADOS</div>';
    host.querySelectorAll('[data-ft-department]').forEach(input => input.addEventListener('change', () => {
      const key = String(input.dataset.ftDepartment || '');
      if (input.checked) state.excludedDepartments.add(key); else state.excludedDepartments.delete(key);
      updateDeptSummary();
      applyFilters();
    }));
    updateDeptSummary();
  }

  function updateDeptSummary() {
    const summary = $('ft-departamentos-resumen');
    if (!summary) return;
    summary.textContent = state.excludedDepartments.size ? `Excluir departamentos (${state.excludedDepartments.size})` : 'Excluir departamentos (ninguno)';
  }

  function applyFilters() {
    const q = norm($('ft-buscar')?.value || '');
    const focus = String($('ft-enfoque')?.value || 'MEDICAMENTOS');
    const status = String($('ft-estado')?.value || 'TODOS');
    state.filtered = state.items.filter(item => {
      if (focus === 'MEDICAMENTOS' && !item.isMedicine) return false;
      if (state.excludedDepartments.has(norm(item.department || 'SIN DEPARTAMENTO'))) return false;
      if (status === 'SIN_REGISTRO' && item.registration) return false;
      if (status !== 'TODOS' && status !== 'SIN_REGISTRO' && item.status.key !== status) return false;
      if (q) {
        const hay = norm([item.code,item.generic,item.distinctive,item.presentation,item.department,item.registration,item.titular,item.indication,item.lotSummary].join(' | '));
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    renderList();
  }

  function renderKPIs() {
    const shown = state.filtered.length;
    const meds = state.filtered.filter(i => i.isMedicine).length;
    const stock = state.filtered.reduce((a,i) => a + Math.max(0, Number(i.stock || 0)), 0);
    const noReg = state.filtered.filter(i => !i.registration).length;
    const expired = state.filtered.filter(i => i.status.key === 'CADUCADO').length;
    if ($('ft-kpi-productos')) $('ft-kpi-productos').textContent = fmt(shown);
    if ($('ft-kpi-medicamentos')) $('ft-kpi-medicamentos').textContent = fmt(meds);
    if ($('ft-kpi-existencia')) $('ft-kpi-existencia').textContent = fmt(stock);
    if ($('ft-kpi-sin-registro')) $('ft-kpi-sin-registro').textContent = fmt(noReg);
    if ($('ft-kpi-caducados')) $('ft-kpi-caducados').textContent = fmt(expired);
  }

  function renderList() {
    renderKPIs();
    const tbody = $('ft-tabla-body');
    if (!tbody) return;
    if ($('ft-resultados')) $('ft-resultados').textContent = `MOSTRANDO ${state.filtered.length} DE ${state.items.length} PRODUCTOS · CLIC EN UNA FILA PARA VER TRAZABILIDAD`;
    if (!state.filtered.length) {
      tbody.innerHTML = '<tr><td colspan="16" style="text-align:center;padding:18px;font-weight:800;color:#657a90">SIN PRODUCTOS PARA LOS FILTROS SELECCIONADOS.</td></tr>';
      return;
    }
    tbody.innerHTML = state.filtered.map(item => {
      const tr = item.trace || {};
      const selected = state.selectedKey === item.key ? ' class="ft-selected"' : '';
      const reg = item.registration || '—';
      const stateBadge = `<span class="ft-badge ${esc(item.status.cls)}">${esc(item.status.label)}</span>`;
      return `<tr data-ft-key="${esc(item.key)}"${selected}>
        <td>${esc(item.code || '—')}</td>
        <td>${esc(item.generic || '—')}</td>
        <td>${esc(item.distinctive || '—')}</td>
        <td>${esc(item.presentation || '—')}</td>
        <td>${esc(item.department || '—')}</td>
        <td>${esc(reg)}</td>
        <td>${esc(item.fraction || '—')}</td>
        <td>${esc(item.titular || '—')}</td>
        <td>${esc(toVisibleDate(item.dateAlta))}</td>
        <td>${esc(toVisibleDate(tr.lastEntryDate || ''))}</td>
        <td>${esc(toVisibleDate(tr.lastSaleDate || ''))}</td>
        <td>${esc(toVisibleDate(item.lastMoveDate))}<br><small>${esc(item.lastMove || '')}</small></td>
        <td>${esc(item.lotSummary)}</td>
        <td style="text-align:right;font-weight:900">${esc(fmt(item.stock))}</td>
        <td>${stateBadge}</td>
        <td style="text-align:right">${esc(fmt(tr.movements || 0))}</td>
      </tr>`;
    }).join('');
    tbody.querySelectorAll('tr[data-ft-key]').forEach(tr => tr.addEventListener('click', () => selectItem(String(tr.dataset.ftKey || ''))));
  }

  function selectItem(key) {
    state.selectedKey = key;
    const item = state.items.find(i => i.key === key);
    renderList();
    renderDetail(item);
    // El listado está contenido en un área con scroll propio; incluso con cientos
    // de claves la ficha no se desplaza hasta el final del catálogo completo.
    // Al seleccionar una fila, acercamos la ficha al área visible sin saltos bruscos.
    const detail = $('ft-detalle');
    if (detail && !detail.hidden) {
      requestAnimationFrame(() => {
        try { detail.scrollIntoView({ behavior:'smooth', block:'nearest' }); } catch (_) {}
      });
    }
  }

  function detailCell(label, value, extraClass='') {
    return `<div class="ft-detail-cell ${extraClass}"><span>${esc(label)}</span><strong>${esc(value || '—')}</strong></div>`;
  }

  function renderDetail(item) {
    const host = $('ft-detalle');
    const btn = $('btn-ft-pdf-ficha');
    if (!host || !item) {
      if (host) host.hidden = true;
      if (btn) btn.disabled = true;
      return;
    }
    const tr = item.trace || {};
    if (btn) btn.disabled = false;
    host.hidden = false;
    host.innerHTML = `<div class="ft-detail-title"><div><h3>${esc(item.generic || item.distinctive || item.code || 'PRODUCTO')}</h3><p>${esc([item.distinctive,item.presentation,item.code].filter(Boolean).join(' · '))}</p></div><span class="ft-badge ${esc(item.status.cls)}">${esc(item.status.label)}</span></div>
      <div class="ft-detail-grid">
        ${detailCell('Fecha de alta / primer movimiento', toVisibleDate(item.dateAlta))}
        ${detailCell('Primer folio', tr.firstFolio || '—')}
        ${detailCell('Última entrada', `${toVisibleDate(tr.lastEntryDate)}${tr.lastEntryFolio ? ` · ${tr.lastEntryFolio}` : ''}`)}
        ${detailCell('Proveedor última entrada', tr.lastEntryParty || '—')}
        ${detailCell('Última venta', `${toVisibleDate(tr.lastSaleDate)}${tr.lastSaleFolio ? ` · ${tr.lastSaleFolio}` : ''}`)}
        ${detailCell('Último movimiento', `${toVisibleDate(tr.lastDate)}${tr.lastFolio ? ` · ${tr.lastFolio}` : ''}`)}
        ${detailCell('Piezas adquiridas registradas', fmt(tr.entered || 0))}
        ${detailCell('Piezas vendidas registradas', fmt(tr.sold || 0))}
        ${detailCell('Otras salidas registradas', fmt(tr.exited || 0))}
        ${detailCell('Movimientos Kardex', fmt(tr.movements || 0))}
        ${detailCell('Registro sanitario', item.registration || '—')}
        ${detailCell('Fracción', item.fraction || '—')}
        ${detailCell('Titular / laboratorio', item.titular || '—')}
        ${detailCell('Existencia actual', fmt(item.stock))}
        ${detailCell('Lotes / caducidades', item.lotSummary, 'ft-indication')}
        ${detailCell('Indicaciones terapéuticas', item.indication || 'SIN INDICACIÓN SANITARIA VINCULADA', 'ft-indication')}
      </div>`;
  }

  async function refresh(force = true) {
    if (state.loading) return;
    if (!force && state.items.length && Date.now() - state.lastLoadedAt < 15000) { applyFilters(); return; }
    state.loading = true;
    const status = $('ft-estado-carga');
    if (status) status.textContent = 'ACTUALIZANDO INVENTARIO Y KARDEX...';
    try {
      const [inventoryRows, kardexRows] = await Promise.all([
        queryAll('tabla-inventario', 5000),
        queryAll('tabla-kardex', 10000)
      ]);
      state.traces = buildTrace(kardexRows);
      state.items = groupInventory(inventoryRows, state.traces);
      state.lastLoadedAt = Date.now();
      renderDepartmentFilter();
      applyFilters();
      const selected = state.items.find(i => i.key === state.selectedKey);
      renderDetail(selected || null);
      if (status) status.textContent = `ACTUALIZADO ${new Date().toLocaleString('es-MX')} · INVENTARIO ${inventoryRows.length} FILAS · KARDEX ${kardexRows.length} MOVIMIENTOS`;
    } catch (error) {
      console.error('Farmacoterapéutica: error al actualizar:', error);
      if (status) status.textContent = 'NO SE PUDO ACTUALIZAR EL CATÁLOGO.';
      notify(`NO SE PUDO ACTUALIZAR EL CATÁLOGO FARMACOTERAPÉUTICO. ${plain(error?.message || error)}`);
    } finally { state.loading = false; }
  }

  function filterDescription() {
    const focus = $('ft-enfoque')?.selectedOptions?.[0]?.textContent || 'MEDICAMENTOS';
    const status = $('ft-estado')?.selectedOptions?.[0]?.textContent || 'TODOS';
    const q = plain($('ft-buscar')?.value || '');
    const excluded = Array.from(state.excludedDepartments);
    return [`ENFOQUE: ${focus}`, `ESTADO: ${status}`, q ? `BÚSQUEDA: ${q}` : '', excluded.length ? `DEPARTAMENTOS EXCLUIDOS: ${excluded.join(', ')}` : ''].filter(Boolean).join(' · ');
  }

  function catalogPdfHtml(items) {
    const rows = (items || []).map(item => {
      const tr = item.trace || {};
      return `<tr>
        <td>${esc(item.code || '—')}</td><td>${esc(item.titular || '—')}</td><td>${esc(item.distinctive || '—')}</td><td>${esc(item.generic || '—')}</td>
        <td>${esc(item.presentation || '—')}</td><td>${esc(item.fraction || '—')}</td><td>${esc(item.registration || '—')}</td><td>${esc(item.indication || item.department || '—')}</td>
        <td>${esc(toVisibleDate(item.dateAlta))}</td><td>${esc(toVisibleDate(tr.lastEntryDate || ''))}</td><td>${esc(toVisibleDate(tr.lastSaleDate || ''))}</td>
        <td>${esc(item.lotSummary)}</td><td>${esc(fmt(item.stock))}</td><td>${esc(item.status.label)}</td>
      </tr>`;
    }).join('');
    return `<div class="ft-pdf-summary"><b>FECHA DE EMISIÓN:</b> ${esc(new Date().toLocaleString('es-MX'))}<br><b>FILTROS:</b> ${esc(filterDescription())}<br><b>PRODUCTOS INCLUIDOS:</b> ${esc(fmt(items.length))}</div>
      <table class="ft-pdf-table"><thead><tr><th>EAN / CÓDIGO</th><th>LABORATORIO / TITULAR</th><th>NOMBRE COMERCIAL</th><th>GENÉRICO</th><th>PRESENTACIÓN</th><th>FRACCIÓN</th><th>REGISTRO SSA</th><th>LÍNEA / CLASIFICACIÓN</th><th>ALTA</th><th>ÚLT. ENTRADA</th><th>ÚLT. VENTA</th><th>LOTE / CADUCIDAD</th><th>EXIST.</th><th>ESTADO</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  async function printPno(title, subtitle, body, options = {}) {
    if (typeof global.imprimirFormatoPnoSanitarioPDF === 'function') {
      return global.imprimirFormatoPnoSanitarioPDF(title, subtitle, body, options);
    }
    if (global.MacroxelFormatoPNO?.buildDocument) {
      const html = global.MacroxelFormatoPNO.buildDocument({ title, documentType: options.documentLabel || 'CATÁLOGO / TRAZABILIDAD', code: options.code || 'CAT-SAN-FT-01', relatedPnos:[], bodyHtml:body, landscape:true, extraCss:options.extraCss || '' });
      const win = global.open('', '_blank');
      if (!win) throw new Error('NO SE PUDO ABRIR LA VENTANA DE IMPRESIÓN.');
      win.document.open(); win.document.write(html.replace('</body>','<script>window.onload=()=>setTimeout(()=>window.print(),200);<\/script></body>')); win.document.close();
      return { ok:true, fallback:true };
    }
    throw new Error('NO ESTÁ DISPONIBLE EL GENERADOR DE PDF DEL SISTEMA.');
  }

  async function exportCatalog() {
    if (!state.filtered.length) return notify('NO HAY PRODUCTOS PARA GENERAR EL PDF.');
    const css = `.ft-pdf-summary{font-size:7pt;line-height:1.35;margin-bottom:7px}.ft-pdf-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:5.6pt}.ft-pdf-table th,.ft-pdf-table td{border:1px solid #777;padding:2px;vertical-align:top;word-break:break-word}.ft-pdf-table th{background:#e9e9e9;font-weight:900;text-align:center}.ft-pdf-table th:nth-child(1){width:7%}.ft-pdf-table th:nth-child(2){width:9%}.ft-pdf-table th:nth-child(3){width:8%}.ft-pdf-table th:nth-child(4){width:9%}.ft-pdf-table th:nth-child(5){width:10%}.ft-pdf-table th:nth-child(6){width:6%}.ft-pdf-table th:nth-child(7){width:7%}.ft-pdf-table th:nth-child(8){width:8%}.ft-pdf-table th:nth-child(9),.ft-pdf-table th:nth-child(10),.ft-pdf-table th:nth-child(11){width:5.5%}.ft-pdf-table th:nth-child(12){width:10%}.ft-pdf-table th:nth-child(13){width:4%}.ft-pdf-table th:nth-child(14){width:6%}`;
    try {
      await printPno('CATÁLOGO FARMACOTERAPÉUTICO', 'CATÁLOGO INTERNO Y TRAZABILIDAD DE PRODUCTOS', catalogPdfHtml(state.filtered), {
        documentLabel:'CATÁLOGO / TRAZABILIDAD', documentType:'Farmacoterapéutica', code:'CAT-SAN-FT-01', landscape:true, omitBodyHeader:true,
        fileName:`CAT-SAN-FT-01_CATALOGO_FARMACOTERAPEUTICO_${todayISO()}.pdf`, extraCss:css
      });
    } catch (error) { notify(plain(error?.message || error)); }
  }

  async function selectedMovements(item) {
    if (!item) return [];
    await waitSQLite();
    if (global.macroxelLocalDB?.query && item.code) {
      const rows = [];
      let page=1, total=Infinity;
      while (rows.length < total && page <= 100) {
        const r = await global.macroxelLocalDB.query({ tableId:'tabla-kardex', page, pageSize:1000, search:'', filters:[{index:3,value:item.code,match:'equals'}], includeTotal:page===1 });
        if (!r?.ok) break;
        const part = r.rows || []; rows.push(...part);
        if (page===1 && Number.isFinite(Number(r.total)) && Number(r.total)>=0) total=Number(r.total);
        if (!part.length || part.length<1000) break;
        page++;
      }
      if (rows.length) return rows;
    }
    const all = await queryAll('tabla-kardex',10000);
    return all.filter(r => norm(r.cells?.[3]) === norm(item.code));
  }

  async function exportSelected() {
    const item = state.items.find(i => i.key === state.selectedKey);
    if (!item) return notify('SELECCIONA UN PRODUCTO PARA GENERAR SU FICHA.');
    const tr = item.trace || {};
    const movements = await selectedMovements(item);
    const moveRows = movements.slice(0,1000).map(row => {
      const c = row.cells || [];
      return `<tr><td>${esc(c[0]||'—')}</td><td>${esc(c[1]||'—')}</td><td>${esc(c[7]||'—')}</td><td>${esc(c[8]||'—')}</td><td>${esc(c[9]||'—')}</td><td>${esc(c[10]||c[11]||'—')}</td><td>${esc(c[14]||'—')}</td><td>${esc(c[15]||'—')}</td></tr>`;
    }).join('');
    const body = `<div class="ft-card-grid">
      <div><b>CÓDIGO / EAN</b><br>${esc(item.code||'—')}</div><div><b>GENÉRICO</b><br>${esc(item.generic||'—')}</div><div><b>DISTINTIVA</b><br>${esc(item.distinctive||'—')}</div><div><b>PRESENTACIÓN</b><br>${esc(item.presentation||'—')}</div>
      <div><b>REGISTRO SANITARIO</b><br>${esc(item.registration||'—')}</div><div><b>FRACCIÓN</b><br>${esc(item.fraction||'—')}</div><div><b>TITULAR / LABORATORIO</b><br>${esc(item.titular||'—')}</div><div><b>CLASIFICACIÓN</b><br>${esc(item.department||'—')}</div>
      <div><b>FECHA ALTA / PRIMER MOVIMIENTO</b><br>${esc(toVisibleDate(item.dateAlta))}</div><div><b>ÚLTIMA ENTRADA</b><br>${esc(toVisibleDate(tr.lastEntryDate))} ${esc(tr.lastEntryFolio||'')}</div><div><b>ÚLTIMA VENTA</b><br>${esc(toVisibleDate(tr.lastSaleDate))} ${esc(tr.lastSaleFolio||'')}</div><div><b>EXISTENCIA ACTUAL</b><br>${esc(fmt(item.stock))}</div>
      <div class="wide"><b>LOTES / CADUCIDADES</b><br>${esc(item.lotSummary)}</div><div class="wide"><b>INDICACIONES TERAPÉUTICAS</b><br>${esc(item.indication||'SIN INDICACIÓN SANITARIA VINCULADA')}</div>
    </div><h2>HISTORIAL DE TRAZABILIDAD EN KARDEX</h2><table class="ft-move-table"><thead><tr><th>FECHA</th><th>FOLIO</th><th>MOVIMIENTO</th><th>CANT.</th><th>PROVEEDOR / DESTINO</th><th>SALDO</th><th>USUARIO</th><th>OBSERVACIONES</th></tr></thead><tbody>${moveRows || '<tr><td colspan="8">SIN MOVIMIENTOS REGISTRADOS.</td></tr>'}</tbody></table>${movements.length>1000?'<p><b>NOTA:</b> Se muestran los primeros 1,000 movimientos del producto.</p>':''}`;
    const css = `.ft-card-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:8px;font-size:7pt}.ft-card-grid>div{border:1px solid #aaa;padding:4px;min-height:28px}.ft-card-grid .wide{grid-column:1/-1}.ft-move-table{width:100%;border-collapse:collapse;font-size:6pt}.ft-move-table th,.ft-move-table td{border:1px solid #888;padding:2px;vertical-align:top}.ft-move-table th{background:#eee}.ft-move-table th:nth-child(8){width:24%}h2{font-size:9pt;margin:8px 0 4px}`;
    try {
      await printPno('FICHA FARMACOTERAPÉUTICA', 'TRAZABILIDAD INDIVIDUAL DEL PRODUCTO', body, {
        documentLabel:'FICHA / TRAZABILIDAD', documentType:'Farmacoterapéutica', code:'CAT-SAN-FT-02', landscape:true, omitBodyHeader:true,
        fileName:`CAT-SAN-FT-02_FICHA_${norm(item.code||item.distinctive||'PRODUCTO').replace(/[^A-Z0-9_-]+/g,'_')}_${todayISO()}.pdf`, extraCss:css
      });
    } catch (error) { notify(plain(error?.message || error)); }
  }

  function bind() {
    if (state.prepared) return;
    injectStyles();
    state.prepared = true;
    $('btn-ft-actualizar')?.addEventListener('click', () => refresh(true));
    $('btn-ft-pdf-catalogo')?.addEventListener('click', exportCatalog);
    $('btn-ft-pdf-ficha')?.addEventListener('click', exportSelected);
    let timer = null;
    $('ft-buscar')?.addEventListener('input', () => { clearTimeout(timer); timer=setTimeout(applyFilters,90); });
    $('ft-enfoque')?.addEventListener('change', applyFilters);
    $('ft-estado')?.addEventListener('change', applyFilters);
    $('btn-ft-limpiar-exclusiones')?.addEventListener('click', () => {
      state.excludedDepartments.clear();
      renderDepartmentFilter(); applyFilters();
    });
    $('btn-ft-excluir-no-medicamentos')?.addEventListener('click', () => {
      deptList(state.items).forEach(dep => {
        const products = state.items.filter(i => norm(i.department || 'SIN DEPARTAMENTO') === norm(dep));
        if (products.length && products.every(i => !i.isMedicine)) state.excludedDepartments.add(norm(dep));
      });
      renderDepartmentFilter(); applyFilters();
    });
  }

  function prepare() {
    bind();
    refresh(false);
  }

  // El botón existe antes de ejecutar el script principal. Este oyente permite
  // refrescar al volver a entrar al módulo aunque la preparación lazy ya haya ocurrido.
  const nav = document.querySelector('.nav-btn[data-module="farmacoterapeutica"]');
  if (nav && nav.dataset.ftRefreshBound !== '1') {
    nav.dataset.ftRefreshBound = '1';
    nav.addEventListener('click', () => setTimeout(() => refresh(false), 90));
  }

  global.MacroxelFarmacoterapeutica = Object.freeze({ prepare, refresh, exportCatalog, exportSelected, version:'1.0.0' });
})(window);
