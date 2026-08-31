/* =============================================================================
   app.js (PWA) — Lógica 100% en el navegador. No necesita servidor.
   Los datos están en window.DGT_QUESTIONS (data.js). El progreso se guarda en
   localStorage. Replica las mecánicas del backend: SRS (SM-2), examen 30/30/<=3,
   vidas, racha, XP, árbol de niveles, stats y sonidos con Web Audio API.
   ============================================================================= */
"use strict";

// -------- Configuración (igual que el backend) --------
const CFG = {
  QUIZ_SIZE: 5, NODES_PER_TEMA: 2, MAX_VIDAS: 5, VIDA_REGEN_MIN: 30,
  XP_ACIERTO: 10, XP_NODO: 20, XP_EXAMEN: 50,
  EXAM_SIZE: 30, EXAM_MIN: 30, EXAM_MAX_FAILS: 3,
};
const TEMAS = {
  1: "Definiciones", 2: "Documentación e ITV", 3: "Alcohol, drogas y fármacos",
  4: "Velocidades", 5: "Señales", 6: "Prioridad y maniobras", 7: "Seguridad y mecánica",
};
const QUESTIONS = window.DGT_QUESTIONS || [];
const BY_ID = {};
QUESTIONS.forEach((q) => (BY_ID[q.id] = q));

// -------- Estado persistente --------
const KEY = "dgtpath_state_v1";
let S = null;

function loadState() {
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (_) { S = null; }
  if (!S) {
    S = { xp: 0, vidas: CFG.MAX_VIDAS, vidasTs: Date.now(), racha: 0, ultima: null, srs: {}, nodes: {} };
    saveState();
  }
  return S;
}
function saveState() { localStorage.setItem(KEY, JSON.stringify(S)); }

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

// -------- Utilidades --------
function questionsByTema(t) { return QUESTIONS.filter((q) => q.tema_id === t); }
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

// -------- Árbol --------
function buildTree() {
  const conteos = {};
  QUESTIONS.forEach((q) => (conteos[q.tema_id] = (conteos[q.tema_id] || 0) + 1));
  const unidades = [];
  let anteriorCompleto = true;
  for (let t = 1; t <= 7; t++) {
    const n = conteos[t] || 0, nodos = [];
    let completos = 0;
    for (let i = 0; i < CFG.NODES_PER_TEMA; i++) {
      const np = S.nodes[`${t}_${i}`] || { completado: false, estrellas: 0 };
      if (np.completado) completos++;
      let desbloqueado;
      if (i === 0) desbloqueado = anteriorCompleto;
      else desbloqueado = anteriorCompleto && !!(S.nodes[`${t}_${i - 1}`] && S.nodes[`${t}_${i - 1}`].completado);
      nodos.push({ i, completado: !!np.completado, estrellas: np.estrellas || 0, desbloqueado: desbloqueado && n > 0 });
    }
    const completa = completos === CFG.NODES_PER_TEMA && n > 0;
    unidades.push({ t, titulo: TEMAS[t], n, desbloqueada: anteriorCompleto, completa, nodos });
    anteriorCompleto = anteriorCompleto && completa;
  }
  return unidades;
}
function renderTree() {
  const path = document.getElementById("path"); path.innerHTML = "";
  buildTree().forEach((u) => {
    const h = document.createElement("div");
    h.className = "unit-header" + (u.desbloqueada ? "" : " locked");
    h.innerHTML = `<div><h3>Unidad ${u.t} · ${u.titulo}</h3><small>${u.n} preguntas ${u.desbloqueada ? "" : "· 🔒"}</small></div><div>${u.completa ? "🏆" : ""}</div>`;
    path.appendChild(h);
    const nodes = document.createElement("div"); nodes.className = "nodes";
    u.nodos.forEach((n) => {
      const row = document.createElement("div"); row.className = "node-row";
      const btn = document.createElement("button");
      const locked = !n.desbloqueado;
      btn.className = "node" + (n.completado ? " completed" : "") + (locked ? " locked" : "");
      btn.innerHTML = locked ? "🔒" : n.completado ? "⭐" : "▶";
      if (n.estrellas > 0) { const s = document.createElement("span"); s.className = "node-stars"; s.textContent = "⭐".repeat(n.estrellas); btn.appendChild(s); }
      if (!locked) btn.addEventListener("click", () => startPractice(u.t, n.i, u.titulo));
      row.appendChild(btn); nodes.appendChild(row);
    });
    path.appendChild(nodes);
  });
}

// -------- Sesión de quiz (práctica / repaso) --------
let quiz = null;

function startPractice(tema, nodeIndex, titulo) {
  Audio.ensure();
  const pool = questionsByTema(tema);
  if (!pool.length) return;
  quiz = { mode: "practice", tema, nodeIndex, titulo, questions: sample(pool, CFG.QUIZ_SIZE), index: 0, aciertos: 0, fallos: 0, answered: false, shuffle: null, selected: null };
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
  quiz = { mode: "review", titulo: "Repaso inteligente", questions: pend, index: 0, aciertos: 0, fallos: 0, answered: false, shuffle: null, selected: null };
  openModal("quiz-modal"); renderQuizQuestion();
}

function setImagen(imgEl, question) {
  if (question.imagen) { imgEl.src = "images/" + question.imagen.replace(/^.*[\\/]/, ""); imgEl.classList.remove("hidden"); imgEl.onerror = () => imgEl.classList.add("hidden"); }
  else imgEl.classList.add("hidden");
}

function renderQuizQuestion() {
  const q = quiz, question = q.questions[q.index];
  q.answered = false; q.selected = null; q.shuffle = shuffleOptions(question);
  document.getElementById("quiz-tema").textContent = q.titulo + " · " + (TEMAS[question.tema_id] || "");
  document.getElementById("quiz-enunciado").textContent = question.enunciado;
  setImagen(document.getElementById("quiz-imagen"), question);
  const cont = document.getElementById("quiz-opciones"); cont.innerHTML = "";
  const letras = ["A", "B", "C"];
  q.shuffle.forEach((opt, i) => {
    const b = document.createElement("button"); b.className = "opcion";
    b.innerHTML = `<span class="letra">${letras[i]}</span>${opt.text}`;
    b.addEventListener("click", () => {
      if (q.answered) return;
      cont.querySelectorAll(".opcion").forEach((o) => o.classList.remove("selected"));
      b.classList.add("selected"); q.selected = { canonical: opt.canonical, el: b };
      document.getElementById("quiz-check").disabled = false;
    });
    cont.appendChild(b);
  });
  document.getElementById("quiz-check").disabled = true;
  document.getElementById("quiz-progress").style.width = (q.index / q.questions.length) * 100 + "%";
  document.getElementById("quiz-hearts").textContent = "❤️".repeat(S.vidas) + "🤍".repeat(Math.max(0, CFG.MAX_VIDAS - S.vidas));
}

function checkAnswer() {
  const q = quiz; if (!q.selected || q.answered) return;
  q.answered = true;
  const question = q.questions[q.index];
  const correcto = q.selected.canonical === question.correcta_idx;

  regenVidas(); actualizarSrs(question.id, correcto); actualizarRacha();
  const nivelPrev = nivel();
  let subioNivel = false, sinVidas = false;
  if (correcto) { S.xp += CFG.XP_ACIERTO; subioNivel = nivel() > nivelPrev; q.aciertos++; }
  else { S.vidas = Math.max(0, S.vidas - 1); sinVidas = S.vidas === 0; q.fallos++; }
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
  fb._sinVidas = sinVidas; fb.classList.remove("hidden");
}
function continueQuiz() {
  const fb = document.getElementById("feedback"); fb.classList.add("hidden");
  if (fb._sinVidas) { finishQuiz(false); return; }
  quiz.index++;
  if (quiz.index >= quiz.questions.length) finishQuiz(true); else renderQuizQuestion();
}
function finishQuiz(completo) {
  closeModal("quiz-modal");
  const q = quiz;
  if (q.mode === "practice" && completo) {
    const total = q.questions.length;
    const aprobado = q.aciertos >= Math.max(1, Math.floor(total * 0.6));
    const ratio = q.aciertos / total;
    const estrellas = ratio === 1 ? 3 : ratio >= 0.8 ? 2 : aprobado ? 1 : 0;
    const key = `${q.tema}_${q.nodeIndex}`;
    const prev = S.nodes[key] || { completado: false, estrellas: 0 };
    let xpGanado = 0;
    if (aprobado) { if (!prev.completado) { xpGanado = CFG.XP_NODO; S.xp += xpGanado; } S.nodes[key] = { completado: true, estrellas: Math.max(prev.estrellas, estrellas) }; }
    saveState(); renderState(); renderTree();
    showResult(aprobado ? "¡Nodo completado!" : "Nodo no superado", aprobado ? estrellas : 0, `Aciertos: ${q.aciertos}/${total} · +${xpGanado} XP`);
  } else if (q.mode === "review") {
    loadReviewCount();
    showResult("Repaso terminado", q.fallos === 0 ? 3 : q.fallos <= 2 ? 2 : 1, `Aciertos: ${q.aciertos}/${q.index}`);
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

// -------- Examen --------
let exam = null;
function startExam() {
  Audio.ensure();
  const porTema = {};
  QUESTIONS.forEach((q) => { (porTema[q.tema_id] = porTema[q.tema_id] || []).push(q); });
  const temas = Object.keys(porTema);
  let sel = [];
  if (temas.length) {
    const base = Math.floor(CFG.EXAM_SIZE / temas.length);
    temas.forEach((t) => { sel = sel.concat(sample(porTema[t], base)); });
  }
  if (sel.length < CFG.EXAM_SIZE) {
    const ids = new Set(sel.map((q) => q.id));
    const resto = sample(QUESTIONS.filter((q) => !ids.has(q.id)), CFG.EXAM_SIZE - sel.length);
    sel = sel.concat(resto);
  }
  sel = sample(sel, CFG.EXAM_SIZE);
  exam = { questions: sel, shuffles: sel.map(shuffleOptions), selected: new Array(sel.length).fill(null), index: 0, secs: CFG.EXAM_MIN * 60, timer: null };
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
  document.getElementById("exam-counter").textContent = `Pregunta ${exam.index + 1} / ${exam.questions.length}`;
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
  const apto = fallos <= CFG.EXAM_MAX_FAILS;
  let xpGanado = 0; if (apto) { xpGanado = CFG.XP_EXAMEN; S.xp += xpGanado; }
  saveState(); renderState();
  closeModal("exam-modal");
  renderExamResult({ apto, aciertos, fallos, enBlanco, xpGanado, resumen: Object.values(resumen).sort((a, b) => a.tema.localeCompare(b.tema)), detalle });
  if (apto) Audio.levelup(); else Audio.wrong();
}
function renderExamResult(r) {
  const v = document.getElementById("exam-verdict");
  v.textContent = r.apto ? "✅ APTO" : "❌ NO APTO"; v.className = r.apto ? "apto" : "no-apto";
  document.getElementById("exam-score").textContent =
    `Aciertos: ${r.aciertos} · Fallos: ${r.fallos} · En blanco: ${r.enBlanco} (máx. ${CFG.EXAM_MAX_FAILS} para APTO) · +${r.xpGanado} XP`;
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
    item.innerHTML = `<div class="rev-q">[${TEMAS[d.q.tema_id]}] ${d.q.enunciado}</div>
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

// -------- Modales / vistas / toast --------
function openModal(id) { document.getElementById(id).classList.remove("hidden"); }
function closeModal(id) { document.getElementById(id).classList.add("hidden"); }
function switchView(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
  if (name === "review") loadReviewCount();
  if (name === "stats") loadStats();
}
function toast(text) {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast";
    el.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:12px 20px;border-radius:12px;z-index:99;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,.3)";
    document.body.appendChild(el); }
  el.textContent = text; el.style.opacity = "1"; clearTimeout(el._t); el._t = setTimeout(() => (el.style.opacity = "0"), 2600);
}

// -------- Init --------
function init() {
  loadState(); regenVidas(); saveState(); renderState(); renderTree();
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => switchView(t.dataset.view)));
  document.getElementById("quiz-check").addEventListener("click", checkAnswer);
  document.getElementById("quiz-close").addEventListener("click", () => closeModal("quiz-modal"));
  document.getElementById("feedback-continue").addEventListener("click", continueQuiz);
  document.getElementById("result-close").addEventListener("click", () => closeModal("result-modal"));
  document.getElementById("btn-start-review").addEventListener("click", startReview);
  document.getElementById("btn-start-exam").addEventListener("click", startExam);
  document.getElementById("btn-practice-mistakes").addEventListener("click", startReview);
  document.getElementById("btn-reset").addEventListener("click", () => {
    if (confirm("¿Reiniciar todo tu progreso? Esto no borra las preguntas.")) {
      S = { xp: 0, vidas: CFG.MAX_VIDAS, vidasTs: Date.now(), racha: 0, ultima: null, srs: {}, nodes: {} };
      saveState(); renderState(); renderTree(); loadStats(); toast("Progreso reiniciado");
    }
  });
  document.getElementById("exam-prev").addEventListener("click", () => { if (exam.index > 0) { exam.index--; renderExamQuestion(); } });
  document.getElementById("exam-next").addEventListener("click", () => { if (exam.index < exam.questions.length - 1) { exam.index++; renderExamQuestion(); } });
  document.getElementById("exam-finish").addEventListener("click", submitExam);
  document.getElementById("exam-close").addEventListener("click", () => { if (exam && exam.timer) clearInterval(exam.timer); closeModal("exam-modal"); });
  document.getElementById("exam-result-close").addEventListener("click", () => closeModal("exam-result-modal"));
}
window.addEventListener("DOMContentLoaded", init);
