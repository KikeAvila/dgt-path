/* =============================================================================
   app.js (PWA) — Lógica 100% en el navegador. No necesita servidor.
   Los datos están en window.DGT_QUESTIONS (data.js). El progreso se guarda en
   localStorage. Mecánicas: SRS (SM-2), vidas, racha, XP, sonidos y:

   NUEVO (mejora septiembre 2026):
   - El camino de cada unidad recorre TODAS sus preguntas en subbloques de 5.
   - Al acertar se avanza solo (sin pulsar "Continuar"); solo al fallar se
     muestra la explicación y hay que continuar manualmente.
   - Al terminar los subbloques de una unidad se desbloquea un "Examen de unidad"
     (30 preguntas de ese tema, estilo examen).
   - 3 niveles de dificultad (1 normal, 2 difícil, 3 muy difícil). El nivel 2 se
     desbloquea al completar todas las unidades + el examen general del nivel 1;
     el nivel 3 igual respecto al nivel 2.
   ============================================================================= */
"use strict";

// -------- Configuración --------
const CFG = {
  QUIZ_SIZE: 5, MAX_VIDAS: 5, VIDA_REGEN_MIN: 30,
  XP_ACIERTO: 10, XP_NODO: 20, XP_EXAMEN: 50, XP_EXAMEN_UNIDAD: 30,
  EXAM_SIZE: 30, EXAM_MIN: 30, EXAM_MAX_FAILS: 3,
  UNIT_EXAM_SIZE: 30,
  AUTO_ADVANCE_MS: 1100, // pausa tras acertar antes de pasar a la siguiente
};
const TEMAS = {
  1: "Definiciones", 2: "Documentación e ITV", 3: "Alcohol, drogas y fármacos",
  4: "Velocidades", 5: "Señales", 6: "Prioridad y maniobras", 7: "Seguridad y mecánica",
};
const NIVELES = { 1: "Nivel 1 · Aprender", 2: "Nivel 2 · Difícil", 3: "Nivel 3 · Experto" };

const QUESTIONS = window.DGT_QUESTIONS || [];
QUESTIONS.forEach((q) => { if (!q.dificultad) q.dificultad = 1; });
const BY_ID = {};
QUESTIONS.forEach((q) => (BY_ID[q.id] = q));

// Teoría (fichas de lectura) desde teoria.js.
const TEORIA = window.DGT_TEORIA || {};
let teoriaSel = 1;
// Catálogo completo de señales (catalogo.js).
const CATALOGO = (window.DGT_CATALOGO && window.DGT_CATALOGO.senales) || [];

// -------- Estado persistente --------
const KEY = "dgtpath_state_v2";
const KEY_OLD = "dgtpath_state_v1";
let S = null;

function nuevoEstado() {
  return {
    xp: 0, vidas: CFG.MAX_VIDAS, vidasTs: Date.now(), racha: 0, ultima: null,
    srs: {}, nodes: {}, unitExam: {}, generalExam: {}, nivelDif: 1,
    perfil: { nombre: "", pin: "" },
  };
}
function loadState() {
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (_) { S = null; }
  if (!S) {
    S = nuevoEstado();
    // Migración best-effort desde la versión anterior: conservamos XP, vidas,
    // racha y el historial SRS (siguen siendo válidos). El progreso del camino
    // se reinicia porque la estructura de nodos ha cambiado.
    try {
      const old = JSON.parse(localStorage.getItem(KEY_OLD));
      if (old) {
        S.xp = old.xp || 0; S.vidas = old.vidas ?? CFG.MAX_VIDAS;
        S.vidasTs = old.vidasTs || Date.now(); S.racha = old.racha || 0;
        S.ultima = old.ultima || null; S.srs = old.srs || {};
      }
    } catch (_) {}
    saveState();
  }
  // Rellenar claves que puedan faltar.
  S.unitExam = S.unitExam || {}; S.generalExam = S.generalExam || {};
  S.nodes = S.nodes || {}; S.srs = S.srs || {}; S.nivelDif = S.nivelDif || 1;
  S.perfil = S.perfil || { nombre: "", pin: "" };
  return S;
}
function saveState() {
  localStorage.setItem(KEY, JSON.stringify(S));
  if (typeof cloudGuardar === "function") cloudGuardar(); // sube a la nube si está conectada
}

// -------- Fechas --------
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(iso, n) {
  const d = iso ? new Date(iso + "T00:00:00") : new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// -------- Vidas y racha --------
function regenVidas() {
  if (S.vidas >= CFG.MAX_VIDAS) { S.vidasTs = Date.now(); return; }
  const ms = CFG.VIDA_REGEN_MIN * 60 * 1000;
  const trans = Date.now() - (S.vidasTs || Date.now());
  const ganadas = Math.floor(trans / ms);
  if (ganadas > 0) {
    S.vidas = Math.min(CFG.MAX_VIDAS, S.vidas + ganadas);
    S.vidasTs = S.vidas >= CFG.MAX_VIDAS ? Date.now() : Date.now() - (trans % ms);
  }
}
function actualizarRacha() {
  const t = today();
  if (S.ultima === t) return;
  S.racha = S.ultima === addDays(t, -1) ? S.racha + 1 : 1;
  S.ultima = t;
}
function nivel() { return 1 + Math.floor(S.xp / 100); }

// -------- SRS (SM-2 simplificado) --------
function srsOf(qid) {
  if (!S.srs[qid]) S.srs[qid] = { reps: 0, ease: 2.5, interval: 0, due: null, vecesVista: 0, vecesFallada: 0, dominada: 0, lastSeen: null };
  return S.srs[qid];
}
function actualizarSrs(qid, correcto) {
  const s = srsOf(qid);
  s.vecesVista++; s.lastSeen = Date.now();
  const q = correcto ? 5 : 2;
  if (q < 3) { s.reps = 0; s.interval = 1; s.dominada = 0; s.vecesFallada++; }
  else {
    s.reps++;
    if (s.reps === 1) s.interval = 1;
    else if (s.reps === 2) s.interval = 3;
    else s.interval = Math.max(1, Math.round(s.interval * s.ease));
    s.ease = Math.max(1.3, s.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    s.dominada = s.reps >= 2 ? 1 : 0;
  }
  s.due = addDays(today(), s.interval);
}

// -------- Preguntas por nivel/tema --------
function poolTema(niv, tema) {
  return QUESTIONS
    .filter((q) => q.tema_id === tema && (q.dificultad || 1) === niv)
    .sort((a, b) => a.id - b.id); // partición estable en subbloques
}
function nSubbloques(niv, tema) { return Math.ceil(poolTema(niv, tema).length / CFG.QUIZ_SIZE); }

// -------- Utilidades --------
function sample(arr, n) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, Math.min(n, a.length));
}
function shuffleOptions(question) {
  const arr = question.opciones.map((text, canonical) => ({ text, canonical }));
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

// -------- Etiqueta de reforma de reglamento --------
const REFORMA_LABELS = {
  nuevo: { t: "NUEVO", i: "🆕" },
  modificado: { t: "MODIFICADO", i: "✏️" },
  actualizado: { t: "ACTUALIZADO", i: "🔄" },
};
function reformaHTML(q) {
  if (!q || !q.reforma_tipo) return "";
  const m = REFORMA_LABELS[q.reforma_tipo] || { t: "CAMBIO", i: "⚖️" };
  return `<span class="rb-tag rb-${q.reforma_tipo}">${m.i} ${m.t} · Reglamento 2026</span>` +
    (q.reforma_nota ? `<div class="rb-nota">${q.reforma_nota}</div>` : "");
}
function setReforma(elId, q) {
  const el = document.getElementById(elId);
  const html = reformaHTML(q);
  if (html) { el.innerHTML = html; el.classList.remove("hidden"); }
  else { el.innerHTML = ""; el.classList.add("hidden"); }
}

// -------- Desbloqueo de niveles de dificultad --------
function nivelCompleto(niv) {
  const temas = [1, 2, 3, 4, 5, 6, 7].filter((t) => poolTema(niv, t).length > 0);
  if (!temas.length) return false;
  const unidadesOk = temas.every((t) => S.unitExam[`${niv}_${t}`] && S.unitExam[`${niv}_${t}`].apto);
  const generalOk = S.generalExam[`${niv}`] && S.generalExam[`${niv}`].apto;
  return unidadesOk && generalOk;
}
function nivelDesbloqueado(niv) { return niv === 1 || nivelCompleto(niv - 1); }
function nivelTieneContenido(niv) {
  return [1, 2, 3, 4, 5, 6, 7].some((t) => poolTema(niv, t).length > 0);
}

// -------- Audio --------
const Audio = {
  ctx: null,
  ensure() {
    if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) this.ctx = new AC(); }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  },
  tone(freq, start, dur, type = "sine", gain = 0.18) {
    const ctx = this.ensure(); if (!ctx) return;
    const t0 = ctx.currentTime + start, osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination); osc.start(t0); osc.stop(t0 + dur + 0.02);
  },
  correct() { this.tone(660, 0, 0.12, "triangle"); this.tone(880, 0.1, 0.18, "triangle"); },
  wrong() { this.tone(200, 0, 0.28, "sawtooth", 0.14); this.tone(150, 0.08, 0.3, "sawtooth", 0.12); },
  levelup() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, i * 0.09, 0.2, "triangle")); },
};

// -------- Render estado --------
function renderState() {
  document.getElementById("stat-racha").textContent = S.racha;
  document.getElementById("stat-xp").textContent = S.xp;
  document.getElementById("stat-nivel").textContent = nivel();
  document.getElementById("stat-vidas").textContent =
    "❤️".repeat(S.vidas) + "🤍".repeat(Math.max(0, CFG.MAX_VIDAS - S.vidas));
}

// -------- Selector de niveles de dificultad --------
function pintarNiveles(contId, onPick) {
  const cont = document.getElementById(contId);
  if (!cont) return;
  cont.innerHTML = "";
  [1, 2, 3].forEach((niv) => {
    if (!nivelTieneContenido(niv)) return; // oculta niveles sin preguntas
    const btn = document.createElement("button");
    // Selección LIBRE de dificultad.
    btn.className = "nivel-btn" + (S.nivelDif === niv ? " active" : "");
    btn.textContent = NIVELES[niv] + (nivelCompleto(niv) ? " ✅" : "");
    btn.addEventListener("click", () => { S.nivelDif = niv; saveState(); onPick(); });
    cont.appendChild(btn);
  });
}
function renderNivelSelector() {
  pintarNiveles("nivel-selector", () => { renderNivelSelector(); renderTree(); });
}

// -------- Menú de Inicio (modos, revisar, categorías) --------
const CAT_ICON = { 1: "📖", 2: "🪪", 3: "🍺", 4: "⏱️", 5: "🚦", 6: "⤵️", 7: "🔧" };
function _menuSeccion(titulo, items) {
  const wrap = document.createElement("div");
  const h = document.createElement("h3"); h.className = "menu-sec-titulo"; h.textContent = titulo; wrap.appendChild(h);
  const grid = document.createElement("div"); grid.className = "menu-grid";
  items.forEach((it) => {
    const c = document.createElement("div"); c.className = "menu-card";
    c.innerHTML = `<div class="mc-ic">${it.ic}</div><div class="mc-t">${it.t}</div>${it.sub ? `<div class="mc-sub">${it.sub}</div>` : ""}`;
    c.addEventListener("click", it.fn);
    grid.appendChild(c);
  });
  wrap.appendChild(grid); return wrap;
}
function renderInicio() {
  const cont = document.getElementById("inicio-content"); if (!cont) return; cont.innerHTML = "";
  const head = document.createElement("div"); head.className = "card";
  head.innerHTML = `<h2>¡Hola${S.perfil && S.perfil.nombre ? ", " + S.perfil.nombre : ""}! 👋</h2>
    <p class="muted">Nivel ${nivel()} · ⚡ ${S.xp} XP · 🔥 ${S.racha} · ${"❤️".repeat(S.vidas)}${"🤍".repeat(Math.max(0, CFG.MAX_VIDAS - S.vidas))}</p>
    <p class="muted" style="margin-top:6px">Dificultad:</p>
    <div class="nivel-selector" id="inicio-nivel" style="margin-top:4px"></div>`;
  cont.appendChild(head);
  const modos = [
    { ic: "🧠", t: "Práctica (Camino)", fn: () => switchView("path") },
    { ic: "🛡️", t: "Examen de práctica", fn: () => startExam() },
    { ic: "📖", t: "Leer teoría", fn: () => switchView("teoria") },
    { ic: "🚦", t: "Practicar señales", fn: () => { teoriaSel = "senales"; switchView("teoria"); renderTeoriaSelector(); renderTeoriaContent(); } },
  ];
  const revisar = [
    { ic: "❌", t: "Mis errores", fn: () => startReview() },
    { ic: "🙈", t: "Menos vistas", fn: () => startMenosVistas() },
  ];
  cont.appendChild(_menuSeccion("Modos de examen", modos));
  cont.appendChild(_menuSeccion("Revisar", revisar));
  const cats = [1, 2, 3, 4, 5, 6, 7].map((t) => ({ ic: CAT_ICON[t], t: TEMAS[t], sub: NIVELES[S.nivelDif].split(" · ")[1], fn: () => startCategoria(t) }));
  cont.appendChild(_menuSeccion("Categorías", cats));
  pintarNiveles("inicio-nivel", () => renderInicio());
}
function startCategoria(tema) {
  Audio.ensure();
  const pool = poolTema(S.nivelDif, tema);
  if (!pool.length) { toast(`No hay preguntas de "${TEMAS[tema]}" en este nivel.`); return; }
  quiz = {
    mode: "categoria", titulo: "Categoría · " + TEMAS[tema],
    questions: sample(pool, Math.min(15, pool.length)),
    index: 0, aciertos: 0, fallos: 0, answered: false, shuffle: null, selected: null, advTimer: null, studyPhase: false,
  };
  openModal("quiz-modal"); renderQuizQuestion();
}
function startMenosVistas() {
  Audio.ensure();
  const arr = QUESTIONS.map((q) => ({ q, v: S.srs[q.id] ? S.srs[q.id].vecesVista : 0 }))
    .sort((a, b) => a.v - b.v).slice(0, 15).map((x) => x.q);
  if (!arr.length) { toast("No hay preguntas."); return; }
  quiz = {
    mode: "categoria", titulo: "Menos vistas",
    questions: sample(arr, arr.length),
    index: 0, aciertos: 0, fallos: 0, answered: false, shuffle: null, selected: null, advTimer: null, studyPhase: false,
  };
  openModal("quiz-modal"); renderQuizQuestion();
}

// -------- Árbol / camino --------
function buildTree(niv) {
  const unidades = [];
  let anteriorCompleta = true; // la primera unidad con contenido siempre accesible
  for (let t = 1; t <= 7; t++) {
    const pool = poolTema(niv, t);
    const n = pool.length;
    const nSub = Math.ceil(n / CFG.QUIZ_SIZE);
    const desbloqueada = anteriorCompleta && n > 0;

    const nodos = [];
    let subCompletos = 0;
    for (let i = 0; i < nSub; i++) {
      const np = S.nodes[`${niv}_${t}_${i}`] || { completado: false, estrellas: 0 };
      if (np.completado) subCompletos++;
      let desbloqueado;
      if (i === 0) desbloqueado = desbloqueada;
      else {
        const prev = S.nodes[`${niv}_${t}_${i - 1}`];
        desbloqueado = desbloqueada && !!(prev && prev.completado);
      }
      nodos.push({ kind: "sub", i, completado: !!np.completado, estrellas: np.estrellas || 0, desbloqueado });
    }

    // Examen de unidad (aparece si hay al menos un subbloque).
    let examNode = null;
    if (nSub > 0) {
      const todosSub = subCompletos === nSub;
      const ex = S.unitExam[`${niv}_${t}`];
      examNode = {
        kind: "exam",
        completado: !!(ex && ex.apto),
        estrellas: ex && ex.apto ? 3 : 0,
        desbloqueado: desbloqueada && todosSub,
      };
      nodos.push(examNode);
    }

    const completa = !!(examNode && examNode.completado);
    unidades.push({ t, titulo: TEMAS[t], n, nSub, desbloqueada, completa, nodos });
    anteriorCompleta = anteriorCompleta && (completa || n === 0);
  }
  return unidades;
}

function renderTree() {
  const niv = S.nivelDif;
  const path = document.getElementById("path"); path.innerHTML = "";
  const unidades = buildTree(niv);
  const hayContenido = unidades.some((u) => u.n > 0);
  if (!hayContenido) {
    path.innerHTML = `<div class="card center"><p class="muted">Aún no hay preguntas para este nivel.</p></div>`;
    return;
  }
  unidades.forEach((u) => {
    if (u.n === 0) return; // no mostrar unidades sin preguntas en este nivel
    const h = document.createElement("div");
    h.className = "unit-header" + (u.desbloqueada ? "" : " locked");
    h.innerHTML = `<div><h3>Unidad ${u.t} · ${u.titulo}</h3>
      <small>${u.n} preguntas · ${u.nSub} bloques ${u.desbloqueada ? "" : "· 🔒"}</small></div>
      <div style="display:flex;align-items:center;gap:8px">
        ${u.completa ? "🏆" : ""}
        ${u.desbloqueada ? `<button class="unit-exam-btn">📝 Examen</button>` : ""}
      </div>`;
    if (u.desbloqueada) {
      const eb = h.querySelector(".unit-exam-btn");
      if (eb) eb.addEventListener("click", () => abrirExamenModo(niv, u.t, u.titulo));
    }
    path.appendChild(h);

    const nodes = document.createElement("div"); nodes.className = "nodes";
    u.nodos.forEach((n) => {
      const row = document.createElement("div"); row.className = "node-row";
      const btn = document.createElement("button");
      const locked = !n.desbloqueado;
      if (n.kind === "exam") {
        btn.className = "node exam" + (n.completado ? " completed" : "") + (locked ? " locked" : "");
        btn.innerHTML = locked ? "🔒" : n.completado ? "🏆" : "📝";
        const cap = document.createElement("span");
        cap.className = "node-cap"; cap.textContent = "Examen";
        btn.appendChild(cap);
        if (!locked) btn.addEventListener("click", () => abrirExamenModo(niv, u.t, u.titulo));
      } else {
        btn.className = "node" + (n.completado ? " completed" : "") + (locked ? " locked" : "");
        btn.innerHTML = locked ? "🔒" : n.completado ? "⭐" : "▶";
        if (n.estrellas > 0) {
          const s = document.createElement("span"); s.className = "node-stars";
          s.textContent = "⭐".repeat(n.estrellas); btn.appendChild(s);
        }
        if (!locked) btn.addEventListener("click", () => startPractice(niv, u.t, n.i, u.titulo));
      }
      row.appendChild(btn); nodes.appendChild(row);
    });
    path.appendChild(nodes);
  });
}

// -------- Sesión de quiz (práctica / repaso) --------
let quiz = null;

function startPractice(niv, tema, nodeIndex, titulo) {
  Audio.ensure();
  const pool = poolTema(niv, tema);
  const bloque = pool.slice(nodeIndex * CFG.QUIZ_SIZE, nodeIndex * CFG.QUIZ_SIZE + CFG.QUIZ_SIZE);
  if (!bloque.length) return;
  quiz = {
    mode: "practice", niv, tema, nodeIndex, titulo,
    questions: sample(bloque, bloque.length), // mismo bloque, orden variado
    index: 0, aciertos: 0, fallos: 0, answered: false, shuffle: null, selected: null, advTimer: null,
  };
  openModal("quiz-modal"); renderQuizQuestion();
}
function startReview() {
  Audio.ensure();
  const t = today();
  const pend = Object.keys(S.srs)
    .map((qid) => ({ qid: +qid, s: S.srs[qid] }))
    .filter((x) => BY_ID[x.qid] && (x.s.dominada === 0 || (x.s.due && x.s.due <= t)))
    .sort((a, b) => (a.s.dominada - b.s.dominada) || String(a.s.due).localeCompare(String(b.s.due)) || (b.s.vecesFallada - a.s.vecesFallada))
    .slice(0, 15)
    .map((x) => BY_ID[x.qid]);
  if (!pend.length) { toast("🎉 ¡No tienes preguntas pendientes de repaso!"); return; }
  quiz = { mode: "review", titulo: "Repaso inteligente", questions: pend, index: 0, aciertos: 0, fallos: 0, answered: false, shuffle: null, selected: null, advTimer: null, studyPhase: true };
  openModal("quiz-modal"); renderQuizQuestion();
}

// -------- Práctica de señales (generada del catálogo) --------
const SENALES_SESION = 20; // preguntas por sesión (aleatorias)
function _preguntaSignifica(s, familia) {
  const distract = sample(familia, 2).map((o) => o.nombre);
  const opts = sample([s.nombre, ...distract], 3);
  return {
    id: "sig_" + s.codigo, tema_id: 5, imagenCat: s.img, imagen: null,
    enunciado: "¿Qué significa esta señal?",
    opciones: opts, correcta_idx: opts.indexOf(s.nombre),
    explicacion: `${s.codigo} · ${s.nombre}. ${s.descripcion || ""}`,
  };
}
function _preguntaGrupo(s, cats) {
  const otras = sample(cats.filter((c) => c !== s.categoria), 2);
  const opts = sample([s.categoria, ...otras], 3);
  return {
    id: "grp_" + s.codigo, tema_id: 5, imagenCat: s.img, imagen: null,
    enunciado: "¿A qué grupo de señales pertenece esta?",
    opciones: opts, correcta_idx: opts.indexOf(s.categoria),
    explicacion: `${s.codigo} · ${s.nombre} — grupo: ${s.categoria}.`,
  };
}
function generarSenales(modo) {
  const con = CATALOGO.filter((s) => s.img && s.nombre);
  const porCat = {}; con.forEach((s) => (porCat[s.categoria] = porCat[s.categoria] || []).push(s));
  const cats = Object.keys(porCat);
  const preg = [];
  con.forEach((s) => {
    let fam = (porCat[s.categoria] || []).filter((o) => o.codigo !== s.codigo);
    if (fam.length < 2) fam = con.filter((o) => o.codigo !== s.codigo);
    preg.push(_preguntaSignifica(s, fam));
    if (modo === "B" && cats.length >= 3) preg.push(_preguntaGrupo(s, cats));
  });
  return sample(preg, SENALES_SESION); // baraja y coge una sesión manejable
}
function startSenales(modo) {
  Audio.ensure();
  const qs = generarSenales(modo);
  if (!qs.length) { toast("No hay señales con imagen para practicar."); return; }
  quiz = {
    mode: "senales", titulo: modo === "B" ? "Señales · variantes" : "Señales",
    questions: qs, index: 0, aciertos: 0, fallos: 0, answered: false,
    shuffle: null, selected: null, advTimer: null, noVidas: true, noSrs: true, studyPhase: false,
  };
  openModal("quiz-modal"); renderQuizQuestion();
}

function setImagen(imgEl, question) {
  // imagenCat = imagen del catálogo de señales (pwa/senales/); imagen = señales antiguas (pwa/images/).
  const src = question.imagenCat
    ? "senales/" + question.imagenCat
    : (question.imagen ? "images/" + question.imagen.replace(/^.*[\\/]/, "") : null);
  if (src) { imgEl.src = src; imgEl.classList.remove("hidden"); imgEl.onerror = () => imgEl.classList.add("hidden"); }
  else imgEl.classList.add("hidden");
}

function renderQuizQuestion() {
  const q = quiz, question = q.questions[q.index];
  q.answered = false; q.selected = null; q.shuffle = shuffleOptions(question);
  // En el repaso, cada pregunta se muestra primero como LECTURA y luego como test.
  const studyMode = q.mode === "review" && q.studyPhase;

  const nivTxt = q.mode === "practice" ? ` · ${NIVELES[q.niv].split(" · ")[1] || ""}` : "";
  document.getElementById("quiz-tema").textContent = q.titulo + " · " + (TEMAS[question.tema_id] || "") + nivTxt;
  setReforma("quiz-reforma", question);
  document.getElementById("quiz-enunciado").textContent = question.enunciado;
  setImagen(document.getElementById("quiz-imagen"), question);

  const cont = document.getElementById("quiz-opciones"); cont.innerHTML = "";
  const letras = ["A", "B", "C"];
  q.shuffle.forEach((opt, i) => {
    const b = document.createElement("button"); b.className = "opcion";
    b.innerHTML = `<span class="letra">${letras[i]}</span>${opt.text}`;
    if (studyMode) {
      // Modo lectura: marca la correcta y no deja seleccionar.
      b.classList.add("disabled");
      if (opt.canonical === question.correcta_idx) b.classList.add("correct");
    } else {
      b.addEventListener("click", () => {
        if (q.answered) return;
        cont.querySelectorAll(".opcion").forEach((o) => o.classList.remove("selected"));
        b.classList.add("selected"); q.selected = { canonical: opt.canonical, el: b };
        document.getElementById("quiz-check").disabled = false;
      });
    }
    cont.appendChild(b);
  });

  // Nota de lectura (solo en la fase de estudio del repaso).
  const note = document.getElementById("quiz-study-note");
  if (studyMode) {
    note.innerHTML =
      `<span class="study-tag">📖 Lee primero</span>` +
      `<div>Respuesta correcta: <span class="study-ok">${question.opciones[question.correcta_idx]}</span></div>` +
      (question.explicacion ? `<div style="margin-top:6px">${question.explicacion}</div>` : "");
    note.classList.remove("hidden");
  } else {
    note.classList.add("hidden");
  }

  // Botones del pie: "Ponerme a prueba" en lectura; "Comprobar" en test.
  const studyBtn = document.getElementById("quiz-study-btn");
  const checkBtn = document.getElementById("quiz-check");
  if (studyMode) {
    studyBtn.classList.remove("hidden");
    checkBtn.classList.add("hidden");
  } else {
    studyBtn.classList.add("hidden");
    checkBtn.classList.remove("hidden");
    checkBtn.disabled = true;
  }

  document.getElementById("quiz-progress").style.width = (q.index / q.questions.length) * 100 + "%";
  document.getElementById("quiz-hearts").textContent = "❤️".repeat(S.vidas) + "🤍".repeat(Math.max(0, CFG.MAX_VIDAS - S.vidas));
}

function startTestPhase() {
  if (!quiz) return;
  quiz.studyPhase = false;
  renderQuizQuestion();
}

function checkAnswer() {
  const q = quiz; if (!q.selected || q.answered) return;
  q.answered = true;
  const question = q.questions[q.index];
  const correcto = q.selected.canonical === question.correcta_idx;

  regenVidas(); if (!q.noSrs) actualizarSrs(question.id, correcto); actualizarRacha();
  const nivelPrev = nivel();
  let subioNivel = false, sinVidas = false;
  if (correcto) { S.xp += CFG.XP_ACIERTO; subioNivel = nivel() > nivelPrev; q.aciertos++; }
  else { if (!q.noVidas) { S.vidas = Math.max(0, S.vidas - 1); sinVidas = S.vidas === 0; } q.fallos++; }
  saveState(); renderState();

  const cont = document.getElementById("quiz-opciones");
  const buttons = cont.querySelectorAll(".opcion");
  buttons.forEach((b) => b.classList.add("disabled"));
  q.shuffle.forEach((opt, i) => { if (opt.canonical === question.correcta_idx) buttons[i].classList.add("correct"); });
  if (!correcto) q.selected.el.classList.add("wrong");

  if (correcto) { Audio.correct(); if (subioNivel) Audio.levelup(); } else Audio.wrong();
  showFeedback(correcto, question.explicacion, sinVidas);
}

function showFeedback(correcto, explicacion, sinVidas) {
  const fb = document.getElementById("feedback");
  fb.className = "feedback " + (correcto ? "ok" : "err");
  document.getElementById("feedback-icon").textContent = correcto ? "✅" : "❌";
  document.getElementById("feedback-title").textContent = correcto ? "¡Correcto!" : "Respuesta incorrecta";
  document.getElementById("feedback-text").textContent = explicacion || "";
  fb._sinVidas = sinVidas;
  const btn = document.getElementById("feedback-continue");
  fb.classList.remove("hidden");

  if (correcto && !sinVidas) {
    // Acierto: se avanza solo, sin pulsar "Continuar".
    btn.classList.add("hidden");
    if (quiz) { clearTimeout(quiz.advTimer); quiz.advTimer = setTimeout(() => advanceQuiz(), CFG.AUTO_ADVANCE_MS); }
  } else {
    // Fallo (o sin vidas): hay que leer la explicación y continuar a mano.
    btn.classList.remove("hidden");
  }
}

function advanceQuiz() {
  if (!quiz) return;
  clearTimeout(quiz.advTimer);
  const fb = document.getElementById("feedback"); fb.classList.add("hidden");
  if (fb._sinVidas) { finishQuiz(false); return; }
  quiz.index++;
  if (quiz.index >= quiz.questions.length) finishQuiz(true);
  else { if (quiz.mode === "review") quiz.studyPhase = true; renderQuizQuestion(); }
}

function finishQuiz(completo) {
  closeModal("quiz-modal");
  const q = quiz;
  if (q.mode === "practice" && completo) {
    const total = q.questions.length;
    const aprobado = q.aciertos >= Math.max(1, Math.floor(total * 0.6));
    const ratio = q.aciertos / total;
    const estrellas = ratio === 1 ? 3 : ratio >= 0.8 ? 2 : aprobado ? 1 : 0;
    const key = `${q.niv}_${q.tema}_${q.nodeIndex}`;
    const prev = S.nodes[key] || { completado: false, estrellas: 0 };
    let xpGanado = 0;
    if (aprobado) { if (!prev.completado) { xpGanado = CFG.XP_NODO; S.xp += xpGanado; } S.nodes[key] = { completado: true, estrellas: Math.max(prev.estrellas, estrellas) }; }
    saveState(); renderState(); renderNivelSelector(); renderTree();
    showResult(aprobado ? "¡Bloque completado!" : "Bloque no superado", aprobado ? estrellas : 0, `Aciertos: ${q.aciertos}/${total} · +${xpGanado} XP`);
  } else if (q.mode === "review") {
    loadReviewCount();
    showResult("Repaso terminado", q.fallos === 0 ? 3 : q.fallos <= 2 ? 2 : 1, `Aciertos: ${q.aciertos}/${q.index}`);
  } else if (q.mode === "senales" || q.mode === "categoria") {
    const tot = q.answered ? q.index + 1 : q.index;
    renderState(); renderInicio();
    showResult(q.titulo || "Práctica", q.fallos === 0 ? 3 : q.fallos <= 3 ? 2 : 1, `Aciertos: ${q.aciertos}/${tot}`);
  } else {
    renderTree();
    showResult("Sin vidas ❤️", 0, `Aciertos: ${q.aciertos}. Espera a recuperar vidas (1 cada ${CFG.VIDA_REGEN_MIN} min).`);
  }
}
function showResult(title, estrellas, text) {
  document.getElementById("result-title").textContent = title;
  document.getElementById("result-stars").textContent = "⭐".repeat(estrellas) + "☆".repeat(Math.max(0, 3 - estrellas));
  document.getElementById("result-text").textContent = text;
  openModal("result-modal");
}

// -------- Examen (general y de unidad) --------
let exam = null;

function startExam() {
  // Examen general del nivel de dificultad activo.
  Audio.ensure();
  const niv = S.nivelDif;
  const porTema = {};
  QUESTIONS.filter((q) => (q.dificultad || 1) === niv).forEach((q) => { (porTema[q.tema_id] = porTema[q.tema_id] || []).push(q); });
  const temas = Object.keys(porTema);
  if (!temas.length) { toast("No hay preguntas para el examen en este nivel."); return; }
  let sel = [];
  const base = Math.floor(CFG.EXAM_SIZE / temas.length);
  temas.forEach((t) => { sel = sel.concat(sample(porTema[t], base)); });
  if (sel.length < CFG.EXAM_SIZE) {
    const ids = new Set(sel.map((q) => q.id));
    const resto = sample(QUESTIONS.filter((q) => (q.dificultad || 1) === niv && !ids.has(q.id)), CFG.EXAM_SIZE - sel.length);
    sel = sel.concat(resto);
  }
  sel = sample(sel, Math.min(CFG.EXAM_SIZE, sel.length));
  lanzarExamen(sel, {
    kind: "general", niv, tema: null,
    titulo: `Examen general · ${NIVELES[niv].split(" · ")[1] || ""}`,
    durMin: CFG.EXAM_MIN, maxFallos: CFG.EXAM_MAX_FAILS,
  });
}

let examenPendiente = null;
function abrirExamenModo(niv, tema, titulo) {
  // Deja elegir modo fácil / restringido antes de lanzar el examen de unidad.
  examenPendiente = { niv, tema, titulo };
  document.getElementById("examen-modo-titulo").textContent = `Unidad ${tema} · ${titulo}`;
  openModal("examen-modo-modal");
}
function lanzarExamenPendiente(modo) {
  const p = examenPendiente;
  closeModal("examen-modo-modal");
  if (p) startUnitExam(p.niv, p.tema, p.titulo, modo);
}
function startUnitExam(niv, tema, titulo, modo) {
  Audio.ensure();
  modo = modo || "facil";
  const pool = poolTema(niv, tema);
  const size = Math.min(CFG.UNIT_EXAM_SIZE, pool.length);
  const sel = sample(pool, size);
  let maxFallos;
  if (modo === "restringido") maxFallos = 0;              // hay que acertar TODAS
  else maxFallos = size >= 30 ? 3 : Math.max(1, Math.round(size * 0.1));
  lanzarExamen(sel, {
    kind: "unit", niv, tema, modo,
    titulo: `Examen U${tema} · ${modo === "restringido" ? "restringido 0 fallos" : "fácil ≤3"}`,
    durMin: Math.max(10, size), maxFallos,
  });
}

function lanzarExamen(questions, opts) {
  if (!questions.length) { toast("No hay preguntas suficientes para el examen."); return; }
  exam = {
    questions, shuffles: questions.map(shuffleOptions),
    selected: new Array(questions.length).fill(null),
    index: 0, secs: opts.durMin * 60, timer: null,
    kind: opts.kind, niv: opts.niv, tema: opts.tema, titulo: opts.titulo, maxFallos: opts.maxFallos,
  };
  openModal("exam-modal"); renderExamQuestion(); startExamTimer();
}

function startExamTimer() {
  const el = document.getElementById("exam-timer");
  const tick = () => {
    const m = Math.floor(exam.secs / 60), s = exam.secs % 60;
    el.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    if (exam.secs <= 0) { clearInterval(exam.timer); submitExam(); return; }
    exam.secs--;
  };
  tick(); exam.timer = setInterval(tick, 1000);
}
function renderExamQuestion() {
  const question = exam.questions[exam.index], shuffle = exam.shuffles[exam.index];
  document.getElementById("exam-counter").textContent = `${exam.titulo} · ${exam.index + 1}/${exam.questions.length}`;
  setReforma("exam-reforma", question);
  document.getElementById("exam-enunciado").textContent = question.enunciado;
  setImagen(document.getElementById("exam-imagen"), question);
  const cont = document.getElementById("exam-opciones"); cont.innerHTML = "";
  const letras = ["A", "B", "C"];
  shuffle.forEach((opt, i) => {
    const b = document.createElement("button"); b.className = "opcion";
    if (exam.selected[exam.index] === opt.canonical) b.classList.add("selected");
    b.innerHTML = `<span class="letra">${letras[i]}</span>${opt.text}`;
    b.addEventListener("click", () => {
      exam.selected[exam.index] = opt.canonical;
      cont.querySelectorAll(".opcion").forEach((o) => o.classList.remove("selected"));
      b.classList.add("selected");
    });
    cont.appendChild(b);
  });
  document.getElementById("exam-progress").style.width = ((exam.index + 1) / exam.questions.length) * 100 + "%";
  document.getElementById("exam-prev").disabled = exam.index === 0;
  const last = exam.index === exam.questions.length - 1;
  document.getElementById("exam-next").classList.toggle("hidden", last);
  document.getElementById("exam-finish").classList.toggle("hidden", !last);
}
function submitExam() {
  if (exam.timer) clearInterval(exam.timer);
  actualizarRacha();
  const detalle = [], resumen = {};
  let aciertos = 0, fallos = 0, enBlanco = 0;
  exam.questions.forEach((q, i) => {
    const sel = exam.selected[i];
    const correcto = sel !== null && sel === q.correcta_idx;
    if (sel === null) enBlanco++;
    actualizarSrs(q.id, correcto);
    if (correcto) aciertos++; else fallos++;
    const tema = TEMAS[q.tema_id];
    const r = resumen[tema] = resumen[tema] || { tema, aciertos: 0, fallos: 0 };
    if (correcto) r.aciertos++; else r.fallos++;
    detalle.push({ q, sel, correcto });
  });
  const apto = fallos <= exam.maxFallos;

  // Registro del resultado y recompensa.
  let xpGanado = 0;
  if (exam.kind === "unit") {
    const key = `${exam.niv}_${exam.tema}`;
    const prev = S.unitExam[key] || { apto: false, mejor: 0 };
    if (apto && !prev.apto) { xpGanado = CFG.XP_EXAMEN_UNIDAD; S.xp += xpGanado; }
    S.unitExam[key] = { apto: prev.apto || apto, mejor: Math.max(prev.mejor || 0, aciertos) };
  } else {
    const key = `${exam.niv}`;
    const prev = S.generalExam[key] || { apto: false, mejor: 0 };
    if (apto && !prev.apto) { xpGanado = CFG.XP_EXAMEN; S.xp += xpGanado; }
    S.generalExam[key] = { apto: prev.apto || apto, mejor: Math.max(prev.mejor || 0, aciertos) };
  }
  saveState(); renderState();
  closeModal("exam-modal");
  renderExamResult({ apto, aciertos, fallos, enBlanco, xpGanado, maxFallos: exam.maxFallos,
    resumen: Object.values(resumen).sort((a, b) => a.tema.localeCompare(b.tema)), detalle, kind: exam.kind, niv: exam.niv });
  if (apto) Audio.levelup(); else Audio.wrong();
  renderNivelSelector(); renderTree();
}
function renderExamResult(r) {
  const v = document.getElementById("exam-verdict");
  v.textContent = r.apto ? "✅ APTO" : "❌ NO APTO"; v.className = r.apto ? "apto" : "no-apto";
  let extra = "";
  if (r.apto && r.kind === "general" && nivelCompleto(r.niv) && r.niv < 3 && nivelTieneContenido(r.niv + 1)) {
    extra = ` · 🎉 ¡Nivel ${r.niv + 1} desbloqueado!`;
  }
  document.getElementById("exam-score").textContent =
    `Aciertos: ${r.aciertos} · Fallos: ${r.fallos} · En blanco: ${r.enBlanco} (máx. ${r.maxFallos} para APTO) · +${r.xpGanado} XP${extra}`;
  const bd = document.getElementById("exam-tema-breakdown"); bd.innerHTML = "";
  r.resumen.forEach((t) => {
    const total = t.aciertos + t.fallos, pct = total ? Math.round((t.aciertos / total) * 100) : 0;
    const row = document.createElement("div"); row.className = "bd-row";
    row.innerHTML = `<span class="bd-name">${t.tema}</span><span class="bd-bar"><span class="bd-fill" style="width:${pct}%"></span></span><span class="bd-num">${t.aciertos}/${total}${t.fallos ? " · " + t.fallos + " ✗" : ""}</span>`;
    bd.appendChild(row);
  });
  const rev = document.getElementById("exam-review"); rev.innerHTML = "";
  const letras = ["A", "B", "C"];
  r.detalle.filter((d) => !d.correcto).forEach((d) => {
    const item = document.createElement("div"); item.className = "rev-item err";
    const tu = d.sel === null ? "— (sin responder)" : `${letras[d.sel]}) ${d.q.opciones[d.sel]}`;
    const rf = reformaHTML(d.q);
    item.innerHTML = `<div class="rev-q">[${TEMAS[d.q.tema_id]}] ${d.q.enunciado}</div>
      ${rf ? `<div class="reforma-badge" style="margin:6px 0">${rf}</div>` : ""}
      <div class="rev-a">Tu respuesta: <b>${tu}</b></div>
      <div class="rev-a">Correcta: <b>${letras[d.q.correcta_idx]}) ${d.q.opciones[d.q.correcta_idx]}</b></div>
      <div class="rev-exp">${d.q.explicacion || ""}</div>`;
    rev.appendChild(item);
  });
  if (!rev.children.length) rev.innerHTML = `<div class="rev-item ok"><div class="rev-q">¡Perfecto! Sin fallos. 🎉</div></div>`;
  openModal("exam-result-modal");
}

// -------- Stats --------
function loadStats() {
  renderPerfil();
  const conteos = {};
  QUESTIONS.forEach((q) => (conteos[q.tema_id] = (conteos[q.tema_id] || 0) + 1));
  let gTotal = 0, gDom = 0, gVistas = 0, gFallos = 0;
  const temas = [];
  for (let t = 1; t <= 7; t++) {
    let dom = 0, vistas = 0, fallos = 0;
    QUESTIONS.filter((q) => q.tema_id === t).forEach((q) => {
      const s = S.srs[q.id]; if (!s) return;
      dom += s.dominada; vistas += s.vecesVista; fallos += s.vecesFallada;
    });
    const total = conteos[t] || 0;
    const precision = vistas > 0 ? Math.round((100 * (vistas - fallos)) / vistas) : null;
    temas.push({ t, titulo: TEMAS[t], total, dominadas: dom, precision });
    gTotal += total; gDom += dom; gVistas += vistas; gFallos += fallos;
  }
  const g = { total: gTotal, dominadas: gDom, precision: gVistas > 0 ? Math.round((100 * (gVistas - gFallos)) / gVistas) : null };
  document.getElementById("global-stats").innerHTML = `
    <div class="gstat"><div class="num">${g.dominadas}/${g.total}</div><div class="lbl">Dominadas</div></div>
    <div class="gstat"><div class="num">${g.precision === null ? "—" : g.precision + "%"}</div><div class="lbl">Precisión</div></div>
    <div class="gstat"><div class="num">${S.xp}</div><div class="lbl">XP · Nv ${nivel()}</div></div>
    <div class="gstat"><div class="num">🔥 ${S.racha}</div><div class="lbl">Racha</div></div>`;
  const cont = document.getElementById("tema-stats"); cont.innerHTML = "";
  temas.forEach((t) => {
    const pct = t.total ? Math.round((t.dominadas / t.total) * 100) : 0;
    const div = document.createElement("div"); div.className = "tema-stat";
    div.innerHTML = `<div class="row"><span>${t.t}. ${t.titulo}</span><span class="pct">${pct}%</span></div>
      <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
      <div class="sub">${t.dominadas}/${t.total} dominadas · precisión ${t.precision === null ? "—" : t.precision + "%"}</div>`;
    cont.appendChild(div);
  });
  const fl = document.getElementById("fallos-list"); fl.innerHTML = "";
  const fallos = Object.keys(S.srs).map((qid) => ({ q: BY_ID[+qid], s: S.srs[qid] }))
    .filter((x) => x.q && x.s.vecesFallada > 0)
    .sort((a, b) => (b.s.vecesFallada - a.s.vecesFallada) || (a.s.dominada - b.s.dominada))
    .slice(0, 15);
  if (!fallos.length) { fl.innerHTML = `<p class="muted">Aún no tienes fallos registrados. ¡Sigue practicando! 💪</p>`; document.getElementById("btn-practice-mistakes").disabled = true; }
  else {
    document.getElementById("btn-practice-mistakes").disabled = false;
    fallos.forEach((x) => {
      const item = document.createElement("div"); item.className = "fallo-item";
      item.innerHTML = `<div class="fq">[${TEMAS[x.q.tema_id]}] ${x.q.enunciado}</div><div class="badge">${x.s.vecesFallada}× ${x.s.dominada ? "✅" : ""}</div>`;
      fl.appendChild(item);
    });
  }
}
function loadReviewCount() {
  const t = today();
  const n = Object.keys(S.srs).filter((qid) => BY_ID[+qid] && (S.srs[qid].dominada === 0 || (S.srs[qid].due && S.srs[qid].due <= t))).length;
  document.getElementById("review-count").textContent = n;
}

// -------- Teoría (lectura) --------
function renderTeoriaSelector() {
  const cont = document.getElementById("teoria-selector"); cont.innerHTML = "";
  const temas = Object.keys(TEORIA).map(Number).sort((a, b) => a - b);
  temas.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = "nivel-btn" + (teoriaSel === t ? " active" : "");
    btn.textContent = `${t}. ${TEORIA[t].titulo}`;
    btn.addEventListener("click", () => { teoriaSel = t; renderTeoriaSelector(); renderTeoriaContent(); });
    cont.appendChild(btn);
  });
  if (CATALOGO.length) {
    const b = document.createElement("button");
    b.className = "nivel-btn" + (teoriaSel === "senales" ? " active" : "");
    b.textContent = `🚦 Todas las señales (${CATALOGO.length})`;
    b.addEventListener("click", () => { teoriaSel = "senales"; renderTeoriaSelector(); renderTeoriaContent(); });
    cont.appendChild(b);
  }
}
function renderTeoriaContent() {
  const cont = document.getElementById("teoria-content"); cont.innerHTML = "";
  if (teoriaSel === "senales") { renderCatalogoSenales(cont); return; }
  const tema = TEORIA[teoriaSel];
  if (!tema) { cont.innerHTML = `<div class="card"><p class="muted">Todavía no hay teoría para este tema.</p></div>`; return; }
  const ficha = document.createElement("div"); ficha.className = "teoria-ficha";
  let html = `<h3>Tema ${teoriaSel} · ${tema.titulo}</h3>`;
  (tema.secciones || []).forEach((s) => {
    html += `<div class="teoria-sec"><h4>${s.h}</h4><ul>` +
      (s.puntos || []).map((p) => `<li>${p}</li>`).join("") + `</ul></div>`;
  });
  ficha.innerHTML = html; cont.appendChild(ficha);
}
function renderCatalogoSenales(cont) {
  // Agrupa por categoría y muestra imagen (si hay) + código + nombre + significado.
  const porCat = {};
  CATALOGO.forEach((s) => { (porCat[s.categoria || "Otras"] = porCat[s.categoria || "Otras"] || []).push(s); });
  const intro = document.createElement("div"); intro.className = "teoria-ficha";
  intro.innerHTML = `<h3>🚦 Catálogo completo de señales (${CATALOGO.length})</h3>
    <p class="sig" style="color:#555">Todas las señales oficiales (catálogo DGT 2025). Estúdialas por tipo o ponte a prueba.</p>
    <button class="btn btn-primary" id="btn-practicar-senales" style="margin-top:8px">📝 Practicar estas señales (test)</button>`;
  cont.appendChild(intro);
  const bp = intro.querySelector("#btn-practicar-senales");
  if (bp) bp.addEventListener("click", () => openModal("senales-modo-modal"));
  Object.keys(porCat).forEach((cat) => {
    const h = document.createElement("h3"); h.className = "senal-cat-titulo"; h.textContent = `${cat} (${porCat[cat].length})`;
    cont.appendChild(h);
    const grid = document.createElement("div"); grid.className = "senal-grid";
    porCat[cat].forEach((s) => {
      const card = document.createElement("div"); card.className = "senal-card";
      const img = s.img ? `<img src="senales/${s.img}" alt="${s.codigo}" loading="lazy">` : `<div class="no-img">sin imagen</div>`;
      const badge = s.nuevo2025 ? `<div class="senal-badge nueva">🆕 NUEVA 2025</div>`
        : (s.cambio_diseno ? `<div class="senal-badge cambio">🔄 Diseño 2025</div>` : "");
      card.innerHTML = `${img}${badge}<div class="cod">${s.codigo}</div><div class="nom">${s.nombre || ""}</div><div class="sig">${s.descripcion || ""}</div>`;
      grid.appendChild(card);
    });
    cont.appendChild(grid);
  });
}
function loadTeoria() { renderTeoriaSelector(); renderTeoriaContent(); }

// -------- Recarga manual de vidas --------
function unidadActual(niv) {
  // Primera unidad con contenido cuyo examen aún no está aprobado.
  for (let t = 1; t <= 7; t++) {
    if (!poolTema(niv, t).length) continue;
    const ex = S.unitExam[`${niv}_${t}`];
    if (!(ex && ex.apto)) return t;
  }
  return null;
}
function recargarVidas(modo) {
  if (modo === "facil") {
    S.vidas = CFG.MAX_VIDAS; S.vidasTs = Date.now();
    saveState(); renderState(); renderPerfil();
    closeModal("vidas-modal"); toast("❤️ Vidas recargadas (modo fácil).");
    return;
  }
  // Restringido: baja una lección (el último subbloque hecho) de la unidad actual.
  const niv = S.nivelDif;
  const t = unidadActual(niv);
  if (!t) { closeModal("vidas-modal"); toast("No hay unidad en curso de la que bajar una lección."); return; }
  const nSub = nSubbloques(niv, t);
  let bajado = -1;
  for (let i = nSub - 1; i >= 0; i--) {
    const k = `${niv}_${t}_${i}`;
    if (S.nodes[k] && S.nodes[k].completado) { delete S.nodes[k]; bajado = i; break; }
  }
  if (bajado < 0) { closeModal("vidas-modal"); toast("En la unidad actual no tienes lecciones hechas que bajar; no se recarga."); return; }
  S.vidas = CFG.MAX_VIDAS; S.vidasTs = Date.now();
  saveState(); renderState(); renderPerfil(); renderNivelSelector(); renderTree();
  closeModal("vidas-modal");
  toast(`❤️ Vidas recargadas. Bajó la lección ${bajado + 1} de la Unidad ${t}: tendrás que repetirla.`);
}

// -------- Perfil (usuario + PIN) y código de progreso --------
function renderPerfil() {
  const nombre = (S.perfil && S.perfil.nombre) ? S.perfil.nombre : "";
  const el = document.getElementById("perfil-nombre");
  if (el) el.textContent = nombre || "— (sin definir)";
  const vi = document.getElementById("vidas-info");
  if (vi) vi.textContent = `${S.vidas} / ${CFG.MAX_VIDAS} ❤️`;
  // Botón de cuenta de la barra superior.
  const un = document.getElementById("stat-user-name");
  if (un) un.textContent = nombre || "Entrar";
  const ub = document.getElementById("stat-user");
  if (ub) ub.classList.toggle("logged", !!nombre);
}
function editarPerfil() {
  const nombre = prompt("Tu nombre de usuario:", (S.perfil && S.perfil.nombre) || "");
  if (nombre === null) return;
  let pin = prompt("PIN de 4 números (protege tu código de progreso):", (S.perfil && S.perfil.pin) || "");
  if (pin === null) return;
  pin = (pin || "").trim();
  if (!/^\d{4}$/.test(pin)) { toast("El PIN debe ser exactamente 4 números."); return; }
  S.perfil = { nombre: (nombre || "").trim() || "Alumno", pin };
  saveState(); renderPerfil(); toast("Perfil guardado ✔");
  if (cloudReady()) cloudLogin(S.perfil.nombre, S.perfil.pin); // conecta la nube con este usuario
}
let codigoModo = null;
// Descodifica el progreso venga como JSON (archivo nuevo) o como base64 (código antiguo)
function decodeProgreso(txt) {
  txt = (txt || "").trim();
  try { const d = JSON.parse(txt); if (d && d.perfil) return d; } catch (_) {}
  try { const d = JSON.parse(decodeURIComponent(escape(atob(txt)))); if (d && d.perfil) return d; } catch (_) {}
  return null;
}
function abrirExportar() {
  if (!S.perfil || !S.perfil.nombre || !/^\d{4}$/.test(S.perfil.pin || "")) {
    toast("Primero pon tu usuario y PIN (botón 'Poner usuario y PIN')."); return;
  }
  document.getElementById("codigo-titulo").textContent = "Exportar progreso";
  document.getElementById("codigo-ayuda").textContent =
    "Pulsa «Descargar archivo» y guárdalo o pásalo al otro móvil (WhatsApp/AirDrop/Archivos). Incluye tu PIN. Si prefieres, también puedes copiar el texto.";
  const ta = document.getElementById("codigo-texto"); ta.value = JSON.stringify(S); ta.readOnly = true;
  document.getElementById("codigo-pin-wrap").style.display = "none";
  document.getElementById("codigo-elegir-archivo").style.display = "none";
  document.getElementById("codigo-descargar").style.display = "";
  document.getElementById("codigo-accion").textContent = "Copiar texto";
  codigoModo = "export"; openModal("codigo-modal");
}
function abrirImportar() {
  document.getElementById("codigo-titulo").textContent = "Importar progreso";
  document.getElementById("codigo-ayuda").textContent =
    "Pulsa «Elegir archivo» y selecciona el archivo de progreso (o pega el texto). Después escribe el PIN de 4 cifras.";
  const ta = document.getElementById("codigo-texto"); ta.value = ""; ta.readOnly = false;
  document.getElementById("codigo-pin-wrap").style.display = "";
  document.getElementById("codigo-pin").value = "";
  document.getElementById("codigo-elegir-archivo").style.display = "";
  document.getElementById("codigo-descargar").style.display = "none";
  document.getElementById("codigo-accion").textContent = "Importar";
  codigoModo = "import"; openModal("codigo-modal");
}
function descargarProgreso() {
  const nombre = ((S.perfil && S.perfil.nombre) || "alumno").replace(/[^\w-]+/g, "_");
  const blob = new Blob([JSON.stringify(S)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `dgt-progreso-${nombre}.json`;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  toast("Archivo descargado ⬇️ Pásalo al otro móvil y usa «Importar».");
}
function elegirArchivo() { document.getElementById("codigo-file").click(); }
function archivoElegido(e) {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    document.getElementById("codigo-texto").value = (r.result || "").trim();
    toast("Archivo cargado. Escribe el PIN y pulsa «Importar».");
  };
  r.onerror = () => toast("No se pudo leer el archivo.");
  r.readAsText(f);
  e.target.value = "";
}
function accionCodigo() {
  const ta = document.getElementById("codigo-texto");
  if (codigoModo === "export") {
    ta.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(ta.value).then(() => toast("Código copiado ✔")).catch(() => toast("Selecciónalo y cópialo a mano."));
    } else { try { document.execCommand("copy"); toast("Código copiado ✔"); } catch (_) { toast("Selecciónalo y cópialo a mano."); } }
    return;
  }
  const code = (ta.value || "").trim();
  const pin = (document.getElementById("codigo-pin").value || "").trim();
  const data = decodeProgreso(code);
  if (!data) { toast("El código/archivo no es válido."); return; }
  if (!data.perfil) { toast("El código no contiene un perfil válido."); return; }
  if ((data.perfil.pin || "") !== pin) { toast("PIN incorrecto para ese código."); return; }
  S = data;
  S.unitExam = S.unitExam || {}; S.generalExam = S.generalExam || {};
  S.nodes = S.nodes || {}; S.srs = S.srs || {}; S.nivelDif = S.nivelDif || 1;
  S.perfil = S.perfil || { nombre: "", pin: "" };
  saveState();
  renderState(); renderNivelSelector(); renderTree(); renderPerfil(); loadStats();
  closeModal("codigo-modal");
  toast(`Progreso de ${S.perfil.nombre || "usuario"} importado ✔`);
}

// -------- Modales / vistas / toast --------
function openModal(id) { document.getElementById(id).classList.remove("hidden"); }
function closeModal(id) { document.getElementById(id).classList.add("hidden"); }
function switchView(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
  if (name === "review") loadReviewCount();
  if (name === "stats") loadStats();
  if (name === "teoria") loadTeoria();
  if (name === "inicio") renderInicio();
}
function toast(text) {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast";
    el.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:12px 20px;border-radius:12px;z-index:99;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,.3);max-width:90%;text-align:center";
    document.body.appendChild(el); }
  el.textContent = text; el.style.opacity = "1"; clearTimeout(el._t); el._t = setTimeout(() => (el.style.opacity = "0"), 3200);
}

// -------- Init --------
// -------- Sincronización en la nube (Firebase Firestore) --------
// El progreso se guarda en la nube bajo el usuario+PIN y se sincroniza solo
// entre dispositivos en tiempo real. Si no hay internet o Firebase no carga,
// todo sigue funcionando en local (localStorage) sin molestar.
let cloudDoc = null, cloudUnsub = null, cloudSaveTimer = null, cloudAplicando = false;
function cloudReady() { return typeof firebase !== "undefined" && !!window._db; }
function cloudKey(nombre) { return (nombre || "").trim().toLowerCase().replace(/[^\w-]+/g, "_"); }

function aplicarNube(jsonStr, ts) {
  let data; try { data = JSON.parse(jsonStr); } catch (_) { return; }
  if (!data || !data.perfil) return;
  cloudAplicando = true;
  S = data; S.cloudTs = ts;
  S.unitExam = S.unitExam || {}; S.generalExam = S.generalExam || {};
  S.nodes = S.nodes || {}; S.srs = S.srs || {}; S.nivelDif = S.nivelDif || 1;
  S.perfil = S.perfil || { nombre: "", pin: "" };
  localStorage.setItem(KEY, JSON.stringify(S)); // sin re-disparar la subida
  renderState(); renderNivelSelector(); renderTree(); renderPerfil(); loadStats();
  cloudAplicando = false;
  toast("Progreso sincronizado ☁️");
}
function cloudGuardarYa() {
  if (!cloudReady() || !cloudDoc) return;
  S.cloudTs = Date.now();
  cloudDoc.set({ pin: (S.perfil && S.perfil.pin) || "", data: JSON.stringify(S), updatedAt: S.cloudTs })
    .catch((e) => console.warn("No se pudo guardar en la nube:", e));
}
function cloudGuardar() {
  if (!cloudReady() || !cloudDoc || cloudAplicando) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(cloudGuardarYa, 800); // agrupa cambios seguidos
}
async function cloudLogin(nombre, pin) {
  if (!cloudReady()) return false;
  const key = cloudKey(nombre);
  if (!key || !/^\d{4}$/.test(pin || "")) return false;
  try {
    if (cloudUnsub) { cloudUnsub(); cloudUnsub = null; }
    cloudDoc = window._db.collection("progresos").doc(key);
    const snap = await cloudDoc.get();
    if (snap.exists) {
      const d = snap.data() || {};
      if ((d.pin || "") !== pin) { toast("Ese usuario ya existe con otro PIN."); cloudDoc = null; return false; }
      const remoteTs = d.updatedAt || 0, localTs = S.cloudTs || 0;
      if (remoteTs > localTs && d.data) aplicarNube(d.data, remoteTs);
      else cloudGuardarYa(); // lo de este dispositivo es más nuevo: súbelo
    } else {
      cloudGuardarYa(); // primer uso: crea el documento con lo actual
    }
    // Escucha en tiempo real: si cambias en otro dispositivo, se refleja aquí.
    cloudUnsub = cloudDoc.onSnapshot((s) => {
      if (!s.exists) return;
      const d = s.data() || {};
      if ((d.updatedAt || 0) > (S.cloudTs || 0) && d.data) aplicarNube(d.data, d.updatedAt);
    });
    return true;
  } catch (e) { console.warn("cloudLogin:", e); return false; }
}

function init() {
  loadState(); regenVidas(); saveState(); renderState(); renderNivelSelector(); renderTree(); renderInicio();
  if (S.perfil && S.perfil.nombre && /^\d{4}$/.test(S.perfil.pin || "")) cloudLogin(S.perfil.nombre, S.perfil.pin);
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => switchView(t.dataset.view)));
  document.getElementById("quiz-check").addEventListener("click", checkAnswer);
  document.getElementById("quiz-close").addEventListener("click", () => { if (quiz) clearTimeout(quiz.advTimer); closeModal("quiz-modal"); });
  document.getElementById("feedback-continue").addEventListener("click", advanceQuiz);
  document.getElementById("quiz-study-btn").addEventListener("click", startTestPhase);
  document.getElementById("result-close").addEventListener("click", () => closeModal("result-modal"));
  document.getElementById("btn-start-review").addEventListener("click", startReview);
  document.getElementById("btn-start-exam").addEventListener("click", startExam);
  document.getElementById("btn-practice-mistakes").addEventListener("click", startReview);
  document.getElementById("btn-reset").addEventListener("click", () => {
    if (confirm("¿Reiniciar todo tu progreso? Esto no borra las preguntas.")) {
      S = nuevoEstado();
      saveState(); renderState(); renderNivelSelector(); renderTree(); loadStats(); toast("Progreso reiniciado");
    }
  });
  document.getElementById("exam-prev").addEventListener("click", () => { if (exam.index > 0) { exam.index--; renderExamQuestion(); } });
  document.getElementById("exam-next").addEventListener("click", () => { if (exam.index < exam.questions.length - 1) { exam.index++; renderExamQuestion(); } });
  document.getElementById("exam-finish").addEventListener("click", submitExam);
  document.getElementById("exam-close").addEventListener("click", () => { if (exam && exam.timer) clearInterval(exam.timer); closeModal("exam-modal"); });
  document.getElementById("exam-result-close").addEventListener("click", () => closeModal("exam-result-modal"));

  // Recarga manual de vidas (tocar el corazón o el botón de Progreso).
  document.getElementById("stat-vidas").addEventListener("click", () => openModal("vidas-modal"));
  document.getElementById("btn-recargar-vidas").addEventListener("click", () => openModal("vidas-modal"));
  document.getElementById("vidas-facil").addEventListener("click", () => recargarVidas("facil"));
  document.getElementById("vidas-restringido").addEventListener("click", () => recargarVidas("restringido"));
  document.getElementById("vidas-cancelar").addEventListener("click", () => closeModal("vidas-modal"));

  // Elección de modo del examen de unidad.
  document.getElementById("examen-modo-facil").addEventListener("click", () => lanzarExamenPendiente("facil"));
  document.getElementById("examen-modo-restringido").addEventListener("click", () => lanzarExamenPendiente("restringido"));
  document.getElementById("examen-modo-cancelar").addEventListener("click", () => closeModal("examen-modo-modal"));

  // Perfil y código de progreso.
  document.getElementById("stat-user").addEventListener("click", editarPerfil);
  document.getElementById("btn-perfil-editar").addEventListener("click", editarPerfil);
  document.getElementById("btn-perfil-exportar").addEventListener("click", abrirExportar);
  document.getElementById("btn-perfil-importar").addEventListener("click", abrirImportar);
  document.getElementById("codigo-accion").addEventListener("click", accionCodigo);
  document.getElementById("codigo-cerrar").addEventListener("click", () => closeModal("codigo-modal"));
  document.getElementById("codigo-descargar").addEventListener("click", descargarProgreso);
  document.getElementById("codigo-elegir-archivo").addEventListener("click", elegirArchivo);
  document.getElementById("codigo-file").addEventListener("change", archivoElegido);

  // Práctica de señales (modo A / B).
  document.getElementById("senales-A").addEventListener("click", () => { closeModal("senales-modo-modal"); startSenales("A"); });
  document.getElementById("senales-B").addEventListener("click", () => { closeModal("senales-modo-modal"); startSenales("B"); });
  document.getElementById("senales-cancelar").addEventListener("click", () => closeModal("senales-modo-modal"));

  renderPerfil();
}
window.addEventListener("DOMContentLoaded", init);
