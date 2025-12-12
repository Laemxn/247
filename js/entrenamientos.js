/***************************************************
 * CONFIG
 ***************************************************/
const BACKEND_URL = 'http://192.168.1.81:3000/api/generar-rutina';


/***************************************************
 * DOM
 ***************************************************/
const hamburgerMenu = document.querySelector('.hamburger-menu');
const navMenu = document.querySelector('.nav-menu');

const routineForm = document.getElementById('routineForm');
const generateRoutineBtn = document.getElementById('generateRoutineBtn');
const routineLoading = document.getElementById('routineLoading');

const currentRoutineSection = document.getElementById('currentRoutineSection');
const routineGeneratorSection = document.getElementById('routineGeneratorSection');
const routineContent = document.getElementById('routineContent');

// Botón PDF: sin asumir un solo ID
const exportPdfBtn =
  document.getElementById('exportPdfBtn') ||
  document.getElementById('exportPDFBtn') ||
  document.getElementById('btnExportPdf') ||
  document.querySelector('[data-export-pdf]') ||
  document.querySelector('.export-pdf-btn');
const downloadRoutineBtn = document.getElementById('downloadRoutineBtn');

const regenerateRoutineBtn = document.getElementById('regenerateRoutineBtn');
const eliminarRutinaBtn = document.getElementById('eliminarRutinaBtn');
const completeDayBtn = document.getElementById('completeDayBtn');

const completedSessionsEl = document.getElementById('completedSessions');
const routineProgressEl = document.getElementById('routineProgress');
const nextSessionEl = document.getElementById('nextSession');

// Progreso 1-2-3-4 (si existen en tu HTML)
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const step4 = document.getElementById('step4');
const routineStatus = document.getElementById('routineStatus');
const routineProgressFill = document.getElementById('routineProgressFill');
const routineTimeIndicator = document.getElementById('routineTimeIndicator');
const routineGenerationTime = document.getElementById('routineGenerationTime');

let currentRoutineJSON = null;
let generationTimer = null;
let startTime = null;

/***************************************************
 * MAPS (para mostrar bonito)
 ***************************************************/
const objetivosMap = {
  ganar_masa_muscular: 'Ganar Masa Muscular',
  perder_grasa: 'Perder Grasa Corporal',
  definicion_muscular: 'Definición Muscular',
  aumentar_fuerza: 'Aumentar Fuerza',
  mejorar_resistencia: 'Mejorar Resistencia',
  salud_general: 'Salud General'
};

const nivelMap = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado'
};

const enfoqueMap = {
  fullbody: 'Full Body',
  upper_lower: 'Upper/Lower',
  push_pull_legs: 'Push/Pull/Legs',
  bro_split: 'Split por Grupo Muscular'
};

const equipamientoMap = {
  gimnasio_completo: 'Gimnasio Completo',
  equipamiento_basico: 'Equipamiento Básico',
  peso_corporal: 'Solo Peso Corporal',
  mancuernas: 'Mancuernas'
};

/***************************************************
 * MENÚ
 ***************************************************/
hamburgerMenu?.addEventListener('click', () => {
  hamburgerMenu.classList.toggle('active');
  navMenu.classList.toggle('active');
});

document.querySelectorAll('.nav-menu a').forEach(link => {
  link.addEventListener('click', () => {
    hamburgerMenu.classList.remove('active');
    navMenu.classList.remove('active');
  });
});

/***************************************************
 * UI: Progreso 1-2-3-4
 ***************************************************/
function setStepState(stepEl, state) {
  if (!stepEl) return;
  stepEl.classList.remove('active', 'completed');
  if (state === 'active') stepEl.classList.add('active');
  if (state === 'completed') stepEl.classList.add('completed');
}

function actualizarPasoRutina(paso, mensaje) {
  const steps = [step1, step2, step3, step4];

  steps.forEach((el, idx) => {
    const n = idx + 1;
    if (!el) return;
    if (n < paso) setStepState(el, 'completed');
    else if (n === paso) setStepState(el, 'active');
    else setStepState(el, '');
  });

  if (routineStatus) routineStatus.textContent = mensaje || '';

  if (routineProgressFill) {
    const pct = Math.max(0, Math.min(100, Math.round((paso / 4) * 100)));
    routineProgressFill.style.width = `${pct}%`;
  }
}

function iniciarTemporizador() {
  if (!routineTimeIndicator) return;
  startTime = Date.now();
  clearInterval(generationTimer);

  routineTimeIndicator.textContent = 'Tiempo estimado: 20-40 segundos';
  if (routineGenerationTime) routineGenerationTime.style.display = 'none';

  generationTimer = setInterval(() => {
    const secs = Math.round((Date.now() - startTime) / 1000);
    routineTimeIndicator.textContent = `Tiempo transcurrido: ${secs}s (estimado: 20-40s)`;
  }, 500);
}

function detenerTemporizador() {
  clearInterval(generationTimer);
  if (!routineGenerationTime || !startTime) return;
  const secs = (Date.now() - startTime) / 1000;
  routineGenerationTime.style.display = 'block';
  routineGenerationTime.textContent = `Tiempo real: ${secs.toFixed(1)}s`;
}

/***************************************************
 * STORAGE
 ***************************************************/
function guardarRutinaLocal(routineObj, formData) {
  localStorage.setItem('smartTrainer_rutinaJSON', JSON.stringify({
    rutina: routineObj,
    formData,
    fecha: new Date().toISOString()
  }));
}

function cargarRutinaLocal() {
  const raw = localStorage.getItem('smartTrainer_rutinaJSON');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// progreso de días (ciclo semanal)
function obtenerProgreso() {
  try {
    const raw = localStorage.getItem('smartTrainer_rutinaProgreso');
    if (raw) return JSON.parse(raw);
  } catch {}
  return { currentDay: 0, week: 1 };
}

function guardarProgreso(p) {
  localStorage.setItem('smartTrainer_rutinaProgreso', JSON.stringify(p));
}

function resetearProgreso() {
  localStorage.removeItem('smartTrainer_rutinaProgreso');
  const p = { currentDay: 0, week: 1 };
  guardarProgreso(p);
  actualizarEstadoRutina();
}

/***************************************************
 * HELPERS
 ***************************************************/
function escapeHTML(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/***************************************************
 * JSON: limpieza, parse, validación
 ***************************************************/
function limpiarRespuestaAJSON(raw) {
  let t = String(raw || '').trim();
  t = t.replace(/```json/gi, '').replace(/```/g, '').trim();

  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    t = t.slice(first, last + 1);
  }
  return t.trim();
}

function parseJSONSeguro(raw) {
  const cleaned = limpiarRespuestaAJSON(raw);
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('RAW IA:', raw);
    console.error('CLEANED:', cleaned);
    throw new Error('La IA no devolvió un JSON válido.');
  }
}

function validarRutinaJSON(obj, diasEsperados) {
  const fail = (m) => ({ ok: false, msg: m });

  if (!obj || typeof obj !== 'object') return fail('JSON vacío');
  if (!Array.isArray(obj.days)) return fail('Falta "days" (array)');
  if (obj.days.length !== diasEsperados) return fail(`Días incorrectos: ${obj.days.length} (esperados ${diasEsperados})`);

  for (let i = 0; i < obj.days.length; i++) {
    const d = obj.days[i];
    if (!d || typeof d !== 'object') return fail(`Día ${i + 1}: inválido`);
    if (!d.name || typeof d.name !== 'string') return fail(`Día ${i + 1}: falta name`);
    if (!d.muscles || typeof d.muscles !== 'string') return fail(`Día ${i + 1}: falta muscles`);
    if (!Array.isArray(d.exercises) || d.exercises.length < 3) return fail(`Día ${i + 1}: ejercicios insuficientes`);

    for (let j = 0; j < d.exercises.length; j++) {
      const ex = d.exercises[j];
      if (!ex.name || typeof ex.name !== 'string') return fail(`Día ${i + 1} Ej ${j + 1}: falta name`);
      if (typeof ex.sets !== 'number' || ex.sets < 1) return fail(`Día ${i + 1} Ej ${j + 1}: sets inválido`);
      if (!ex.reps || typeof ex.reps !== 'string') return fail(`Día ${i + 1} Ej ${j + 1}: reps inválido`);
      if (typeof ex.restSec !== 'number' || ex.restSec < 10) return fail(`Día ${i + 1} Ej ${j + 1}: restSec inválido`);
    }
  }

  return { ok: true, msg: 'OK' };
}

/***************************************************
 * PROMPT: SOLO JSON
 ***************************************************/
function buildPromptJSON(formData) {
  const dias = parseInt(formData.trainingDays, 10);

  return `
Responde SOLO con JSON válido (sin markdown, sin texto extra).

ESQUEMA OBLIGATORIO:
{
  "days": [
    {
      "name": "string",
      "muscles": "string",
      "exercises": [
        { "name": "string", "sets": number, "reps": "string", "restSec": number }
      ]
    }
  ],
  "notes": ["string","string","string"]
}

REGLAS:
- days EXACTAMENTE ${dias}
- mínimo 3 ejercicios por día
- sets: number
- reps: string (ej "8-12")
- restSec: number (ej 60, 90, 120)
- coherente con objetivo, nivel, equipo y enfoque

DATOS:
Objetivo: ${objetivosMap[formData.trainingGoal] || formData.trainingGoal}
Nivel: ${nivelMap[formData.trainingLevel] || formData.trainingLevel}
Días: ${dias}
Duración: ${formData.sessionDuration} minutos
Equipo: ${equipamientoMap[formData.availableEquipment] || formData.availableEquipment}
Enfoque: ${enfoqueMap[formData.trainingFocus] || formData.trainingFocus}
Necesidades: ${formData.specificNeeds || 'Ninguna'}

Devuelve SOLO el JSON.
`.trim();
}

/***************************************************
 * IA: fetch al backend local
 ***************************************************/
async function generarRutinaConIA_JSON(formData) {
  const prompt = buildPromptJSON(formData);

  const response = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2200
    })
  });

  if (!response.ok) {
    const txt = await response.text().catch(() => '');
    console.error('Backend error:', response.status, txt);
    throw new Error(`Error del servidor IA (${response.status})`);
  }

  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Respuesta inválida de la IA.');

  const routineObj = parseJSONSeguro(raw);
  const valid = validarRutinaJSON(routineObj, parseInt(formData.trainingDays, 10));
  if (!valid.ok) {
    console.error('Rutina inválida:', valid.msg, routineObj);
    throw new Error('La IA devolvió una rutina inválida. Regenera.');
  }

  return routineObj;
}

/***************************************************
 * RENDER: HTML con TU estructura y TU CSS
 ***************************************************/
function buildRoutineHTML(routine, formData) {
  const goal = objetivosMap[formData.trainingGoal] || formData.trainingGoal;
  const level = nivelMap[formData.trainingLevel] || formData.trainingLevel;
  const equip = equipamientoMap[formData.availableEquipment] || formData.availableEquipment;
  const focus = enfoqueMap[formData.trainingFocus] || formData.trainingFocus;

  const overview = `
    <div class="routine-overview">
      <h3>📌 Resumen de tu Rutina</h3>
      <div class="meta-grid">
        <div class="meta-item">
          <i class="fas fa-bullseye"></i>
          <div>
            <div class="meta-label">Objetivo</div>
            <div class="meta-value">${escapeHTML(goal)}</div>
          </div>
        </div>
        <div class="meta-item">
          <i class="fas fa-chart-line"></i>
          <div>
            <div class="meta-label">Nivel</div>
            <div class="meta-value">${escapeHTML(level)}</div>
          </div>
        </div>
        <div class="meta-item">
          <i class="fas fa-dumbbell"></i>
          <div>
            <div class="meta-label">Equipo</div>
            <div class="meta-value">${escapeHTML(equip)}</div>
          </div>
        </div>
        <div class="meta-item">
          <i class="fas fa-layer-group"></i>
          <div>
            <div class="meta-label">Enfoque</div>
            <div class="meta-value">${escapeHTML(focus)}</div>
          </div>
        </div>
        <div class="meta-item">
          <i class="fas fa-calendar"></i>
          <div>
            <div class="meta-label">Días/Semana</div>
            <div class="meta-value">${escapeHTML(String(formData.trainingDays))} días</div>
          </div>
        </div>
        <div class="meta-item">
          <i class="fas fa-clock"></i>
          <div>
            <div class="meta-label">Duración</div>
            <div class="meta-value">${escapeHTML(String(formData.sessionDuration))} min/sesión</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const dayCards = routine.days.map((d, idx) => {
    const exLis = d.exercises.map(ex => {
      const name = escapeHTML(ex.name);
      const setsReps = `${ex.sets}x${escapeHTML(ex.reps)}`;
      const rest = `${ex.restSec}s`;
      return `
        <li>
          <strong>${name}:</strong> ${setsReps} - ${rest}
        </li>
      `;
    }).join('');

    return `
      <div class="day-card" data-day-index="${idx}">
        <div class="day-header">
          <div class="day-number">DÍA ${idx + 1}</div>
          <div class="day-name">${escapeHTML(d.name)}</div>
        </div>

        <div class="day-info">
          <div class="day-muscles"><i class="fas fa-dumbbell"></i> ${escapeHTML(d.muscles)}</div>
          <div class="day-duration"><i class="fas fa-clock"></i> ${escapeHTML(String(formData.sessionDuration))} min</div>
        </div>

        <div class="exercises">
          <h4>Ejercicios:</h4>
          <ul>
            ${exLis}
          </ul>
        </div>
      </div>
    `;
  }).join('');

  const weekly = `
    <div class="weekly-schedule">
      <h3>🗓️ Planificación Semanal</h3>
      <div class="schedule-grid">
        ${dayCards}
      </div>
    </div>
  `;

  const progression = `
    <div class="progression-plan">
      <h3>📈 Plan de Progresión</h3>
      <div class="progression-content">
        <h4>Semana 1-2:</h4>
        <ul>
          <li>Enfócate en técnica, rango completo y control.</li>
          <li>RPE 6-7 (deja 2-4 repeticiones en reserva).</li>
        </ul>
        <h4>Semana 3-4:</h4>
        <ul>
          <li>Sube carga 2.5%-5% cuando completes el tope de reps en todas las series.</li>
          <li>Mantén descansos como están definidos.</li>
        </ul>
      </div>
    </div>
  `;

  const notesArr = Array.isArray(routine.notes) ? routine.notes : [];
  const notesLis = (notesArr.length ? notesArr : [
    'Calienta 5-10 min antes de iniciar.',
    'Prioriza técnica sobre peso.',
    'Duerme 7-9 horas para mejorar recuperación.'
  ]).map(n => `<li>${escapeHTML(n)}</li>`).join('');

  const notes = `
    <div class="training-notes">
      <h3>💡 Notas Importantes</h3>
      <div class="notes-content">
        <ul>${notesLis}</ul>
      </div>
    </div>
  `;

  return `${overview}${weekly}${progression}${notes}`;
}

/***************************************************
 * ESTADO DE RUTINA (usa TU CSS: .current-day)
 ***************************************************/
function actualizarEstadoRutina() {
  if (!currentRoutineJSON) return;

  const total = currentRoutineJSON.days.length;
  const progreso = obtenerProgreso();

  const completados = progreso.currentDay;
  const porcentaje = Math.round((completados / total) * 100);

  if (completedSessionsEl) completedSessionsEl.textContent = `${completados}/${total}`;
  if (routineProgressEl) routineProgressEl.textContent = `${porcentaje}%`;
  if (nextSessionEl) nextSessionEl.textContent = `Día ${progreso.currentDay + 1} (Semana ${progreso.week})`;

  document.querySelectorAll('.day-card').forEach((card, index) => {
    card.classList.remove('current-day', 'day-completed');

    if (index < progreso.currentDay) {
      card.classList.add('day-completed');
    } else if (index === progreso.currentDay) {
      card.classList.add('current-day');
    }
  });
}

function marcarDiaCompletado() {
  if (!currentRoutineJSON) return;

  const total = currentRoutineJSON.days.length;
  const progreso = obtenerProgreso();

  progreso.currentDay++;

  if (progreso.currentDay >= total) {
    alert(`🎉 Semana ${progreso.week} completada. Inicia una nueva semana.`);
    progreso.currentDay = 0;
    progreso.week++;
  }

  guardarProgreso(progreso);
  actualizarEstadoRutina();
}

/***************************************************
 * PDF (SIN html2pdf) – imprime con el layout del “documento”
 ***************************************************/
function buildPdfHTML(routine, formData) {
  const goal = objetivosMap[formData.trainingGoal] || formData.trainingGoal;
  const level = nivelMap[formData.trainingLevel] || formData.trainingLevel;
  const equip = equipamientoMap[formData.availableEquipment] || formData.availableEquipment;
  const focus = enfoqueMap[formData.trainingFocus] || formData.trainingFocus;

  const fecha = new Date().toLocaleDateString('es-MX', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  const notesArr = Array.isArray(routine.notes) ? routine.notes : [];

  const diasHTML = routine.days.map((d, i) => {
    const rows = (Array.isArray(d.exercises) ? d.exercises : []).map(ex => `
      <tr>
        <td class="c-ej">${escapeHTML(ex.name)}</td>
        <td class="c-num">${Number(ex.sets) || ''}</td>
        <td class="c-num">${escapeHTML(ex.reps)}</td>
        <td class="c-num">${Number(ex.restSec) ? `${ex.restSec}s` : ''}</td>
      </tr>
    `).join('');

    return `
      <section class="day">
        <div class="day-title">
          <div class="day-badge">DÍA ${i + 1}</div>
          <div class="day-name">${escapeHTML(d.name)}</div>
        </div>
        <div class="day-sub">
          <div><span class="k">Músculos:</span> ${escapeHTML(d.muscles)}</div>
          <div><span class="k">Duración:</span> ${escapeHTML(String(formData.sessionDuration))} min</div>
        </div>

        <table class="tbl">
          <thead>
            <tr>
              <th>Ejercicio</th>
              <th>Series</th>
              <th>Reps</th>
              <th>Descanso</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
    `;
  }).join('');

  const notesLis = notesArr.map(n => `<li>${escapeHTML(n)}</li>`).join('');

  return `
  <div class="pdf">
    <style>
      @page { size: A4; margin: 10mm; }
      @media print {
        html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }

      html, body { background:#ffffff !important; margin:0; padding:0; }
      * { box-shadow:none !important; text-shadow:none !important; }

      .pdf {
        font-family: Arial, Helvetica, sans-serif;
        color:#111;
        padding: 0;
      }

      .title { text-align:center; font-size: 22px; font-weight: 800; letter-spacing: 1px; margin: 0; }
      .subtitle { text-align:center; margin: 6px 0 0; color:#555; font-size: 12px; }
      .hr { height: 3px; background: #111; margin: 14px 0 14px; }

      .meta {
        border: 1px solid #111;
        padding: 10px 12px;
        border-radius: 8px;
        font-size: 12px;
        margin-bottom: 12px;
      }
      .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; }
      .k { font-weight: 700; }

      /* OJO: NO evitar salto dentro de todo el día (si es largo, el navegador recorta) */
      .day {
        margin-top: 12px;
        padding-top: 10px;
        border-top: 2px solid #111;
        break-inside: auto;
        page-break-inside: auto;
      }

      .day-title { display:flex; align-items:baseline; gap: 10px; margin-bottom: 6px; }
      .day-badge {
        background: #111; color: #fff; font-weight: 800; font-size: 11px;
        padding: 4px 8px; border-radius: 999px; letter-spacing: 0.8px;
      }
      .day-name { font-size: 14px; font-weight: 800; }
      .day-sub {
        display:flex; justify-content: space-between; gap: 10px;
        font-size: 12px; color:#333; margin: 6px 0 10px;
      }

      .tbl {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        font-size: 12px;
      }

      thead { display: table-header-group; }
      tr { break-inside: avoid; page-break-inside: avoid; }

      .tbl th, .tbl td {
        border: 1px solid #111;
        padding: 6px 7px;
        vertical-align: top;
      }
      .tbl th { background: #f2f2f2; font-weight: 800; text-align: left; }

      .c-num { text-align:center; white-space: nowrap; }
      .c-ej { width: 60%; word-wrap: break-word; }

      .notes {
        margin-top: 14px;
        border-top: 2px solid #111;
        padding-top: 10px;
      }
      .notes h3 { margin: 0 0 8px; font-size: 13px; font-weight: 800; }
      .notes ul { margin: 0 0 0 18px; padding:0; font-size: 12px; }
      .notes li { margin: 0 0 6px; }

      .footer { margin-top: 12px; font-size: 11px; color: #666; text-align: center; }
    </style>

    <h1 class="title">SMART TRAINER</h1>
    <p class="subtitle">Rutina de entrenamiento generada por IA • ${escapeHTML(fecha)}</p>
    <div class="hr"></div>

    <div class="meta">
      <div class="meta-grid">
        <div><span class="k">Objetivo:</span> ${escapeHTML(goal)}</div>
        <div><span class="k">Nivel:</span> ${escapeHTML(level)}</div>
        <div><span class="k">Equipo:</span> ${escapeHTML(equip)}</div>
        <div><span class="k">Enfoque:</span> ${escapeHTML(focus)}</div>
        <div><span class="k">Días/Semana:</span> ${escapeHTML(String(formData.trainingDays))}</div>
        <div><span class="k">Duración:</span> ${escapeHTML(String(formData.sessionDuration))} min</div>
      </div>
    </div>

    ${diasHTML}

    <section class="notes">
      <h3>Notas generales</h3>
      <ul>
        ${notesLis || '<li>Calienta 5-10 min antes de iniciar y prioriza técnica.</li>'}
      </ul>
    </section>

    <div class="footer">Smart Trainer • Exportación PDF</div>
  </div>
  `;
}

function exportarPdfPro() {
  const saved = cargarRutinaLocal();
  if (!saved?.rutina || !saved?.formData) {
    alert('No hay rutina guardada para exportar.');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Rutina Smart Trainer</title>
      </head>
      <body>
        ${buildPdfHTML(saved.rutina, saved.formData)}
      </body>
    </html>
  `.trim();

  const win = window.open('', '_blank');
  if (!win) {
    alert('Permite pop-ups para exportar el PDF.');
    return;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();

  win.focus();

  // Importante: esperar un poquito a que renderice antes de imprimir
  setTimeout(() => {
    win.print();
  }, 300);
}

function descargarRutinaJSON() {
  const saved = cargarRutinaLocal();
  if (!saved?.rutina || !saved?.formData) {
    alert('No hay rutina guardada para descargar.');
    return;
  }

  const payload = {
    rutina: saved.rutina,
    formData: saved.formData,
    exportadoEn: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `rutina-smart-trainer-${Date.now()}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

function actualizarEstadoDescarga(hayRutina) {
  if (!downloadRoutineBtn) return;

  downloadRoutineBtn.disabled = !hayRutina;
  downloadRoutineBtn.title = hayRutina
    ? 'Descargar la última rutina generada'
    : 'Genera o carga una rutina para habilitar la descarga';
}

/***************************************************
 * EVENTOS
 ***************************************************/
routineForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = {
    trainingGoal: document.getElementById('trainingGoal').value,
    trainingLevel: document.getElementById('trainingLevel').value,
    trainingDays: document.getElementById('trainingDays').value,
    sessionDuration: document.getElementById('sessionDuration').value,
    availableEquipment: document.getElementById('availableEquipment').value,
    trainingFocus: document.getElementById('trainingFocus').value,
    specificNeeds: document.getElementById('specificNeeds').value
  };

  generateRoutineBtn && (generateRoutineBtn.disabled = true);
  routineLoading && (routineLoading.style.display = 'block');

  actualizarPasoRutina(1, 'Analizando tus datos...');
  iniciarTemporizador();

  try {
    await new Promise(r => setTimeout(r, 350));
    actualizarPasoRutina(2, 'Conectando con DeepSeek...');

    await new Promise(r => setTimeout(r, 650));
    actualizarPasoRutina(3, 'Generando rutina...');

    const routineObj = await generarRutinaConIA_JSON(formData);

    actualizarPasoRutina(4, 'Rutina generada ✅');
    detenerTemporizador();

    currentRoutineJSON = routineObj;

    routineContent.innerHTML = buildRoutineHTML(routineObj, formData);
    guardarRutinaLocal(routineObj, formData);
    actualizarEstadoDescarga(true);

    // Reinicia progreso al generar una rutina nueva
    localStorage.removeItem('smartTrainer_rutinaProgreso');
    guardarProgreso({ currentDay: 0, week: 1 });

    // Mostrar secciones
    if (currentRoutineSection) currentRoutineSection.style.display = 'block';
    if (routineGeneratorSection) routineGeneratorSection.style.display = 'none';

    // Aplica highlight según TU CSS (.current-day)
    actualizarEstadoRutina();

    currentRoutineSection?.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error(err);
    alert('Error al generar la rutina: ' + err.message);
  } finally {
    generateRoutineBtn && (generateRoutineBtn.disabled = false);
    routineLoading && (routineLoading.style.display = 'none');
  }
});

completeDayBtn?.addEventListener('click', () => {
  marcarDiaCompletado();
});

regenerateRoutineBtn?.addEventListener('click', () => {
  if (routineGeneratorSection) routineGeneratorSection.style.display = 'block';
  if (currentRoutineSection) currentRoutineSection.style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

eliminarRutinaBtn?.addEventListener('click', () => {
  if (!confirm('¿Eliminar la rutina actual?')) return;

  localStorage.removeItem('smartTrainer_rutinaJSON');
  localStorage.removeItem('smartTrainer_rutinaProgreso');

  currentRoutineJSON = null;
  if (routineContent) routineContent.innerHTML = '';

  actualizarEstadoDescarga(false);

  if (currentRoutineSection) currentRoutineSection.style.display = 'none';
  if (routineGeneratorSection) routineGeneratorSection.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Exportar PDF (solo una vez, sin duplicados, sin html2pdf)
exportPdfBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  exportarPdfPro();
});

downloadRoutineBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  descargarRutinaJSON();
});

/***************************************************
 * INIT
 ***************************************************/
(function init() {
  const saved = cargarRutinaLocal();
  if (!saved?.rutina || !saved?.formData) {
    actualizarEstadoDescarga(false);
    return;
  }

  currentRoutineJSON = saved.rutina;
  routineContent.innerHTML = buildRoutineHTML(saved.rutina, saved.formData);

  if (currentRoutineSection) currentRoutineSection.style.display = 'block';
  if (routineGeneratorSection) routineGeneratorSection.style.display = 'none';

  const p = obtenerProgreso();
  if (typeof p.currentDay !== 'number' || typeof p.week !== 'number') {
    guardarProgreso({ currentDay: 0, week: 1 });
  }

  actualizarEstadoRutina();
  actualizarEstadoDescarga(true);
})();
