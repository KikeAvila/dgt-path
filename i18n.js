/* =============================================================================
   i18n.js — Capa de idioma (Español / English) para DGT Path.
   - El idioma se guarda en localStorage["dgtpath_lang"] ("es" | "en").
   - Los textos de contenido (preguntas, señales, teoría) llevan campos "_en"
     que genera build_pwa.py. Si falta la traducción, se cae a español.
   - Los textos de interfaz están en el diccionario I18N de abajo.
   ============================================================================= */
"use strict";

function LANG() {
  try { return localStorage.getItem("dgtpath_lang") === "en" ? "en" : "es"; }
  catch (_) { return "es"; }
}
function setLang(l) {
  try { localStorage.setItem("dgtpath_lang", l === "en" ? "en" : "es"); } catch (_) {}
}

// Devuelve el campo en el idioma actual: obj[field+"_en"] si existe (y hay EN), o el original.
function L(obj, field) {
  if (!obj) return "";
  if (LANG() === "en") {
    const v = obj[field + "_en"];
    if (v != null && v !== "") return v;
  }
  return obj[field] != null ? obj[field] : "";
}
// Opciones de una pregunta en el idioma actual (alineadas por índice con "opciones").
function LOPC(q) {
  if (!q) return [];
  if (LANG() === "en" && Array.isArray(q.opciones_en) && q.opciones_en.length === (q.opciones || []).length) {
    return q.opciones_en;
  }
  return q.opciones || [];
}

// Nombres de tema y nivel en inglés (los ES viven en app.js).
window.TEMAS_EN = {
  1: "Definitions", 2: "Documents & roadworthiness test", 3: "Alcohol, drugs & medication",
  4: "Speed limits", 5: "Road signs", 6: "Priority & manoeuvres", 7: "Safety & mechanics",
};
window.NIVELES_EN = {
  1: "Level 1 · Learn", 2: "Level 2 · Hard", 3: "Level 3 · Expert",
  4: "Level 4 · Hard (real DGT)", 5: "Level 5 · Real DGT exam",
};

// Traducción de las 15 categorías del catálogo oficial de señales.
window.CAT_EN = {
  "Señales De Advertencia De Peligro": "Danger warning signs",
  "Señales De Carriles": "Lane signs",
  "Señales De Confirmación": "Confirmation signs",
  "Señales De Dirección": "Direction signs",
  "Señales De Fin De Prohibición, Restricción U Obligación": "End of prohibition, restriction or obligation",
  "Señales De Identificación De Carreteras": "Road identification signs",
  "Señales De Indicaciones Generales": "General information signs",
  "Señales De Localización": "Location signs",
  "Señales De Obligación": "Mandatory signs",
  "Señales De Preseñalización": "Advance direction signs",
  "Señales De Prioridad": "Priority signs",
  "Señales De Prohibición De Entrada": "No-entry signs",
  "Señales De Restricción De Paso": "Passage restriction signs",
  "Señales De Servicio": "Service signs",
  "Señales De Uso Específico En Poblado": "Signs for specific use in built-up areas",
};
function catNombre(cat) {
  if (LANG() === "en" && window.CAT_EN[cat]) return window.CAT_EN[cat];
  return cat || "";
}

// -------- Diccionario de interfaz --------
const I18N = {
  es: {
    // Pestañas
    "tab.inicio": "🧭 Inicio", "tab.path": "🗺️ Camino", "tab.oficiales": "🏛️ Oficiales",
    "tab.teoria": "📖 Teoría", "tab.review": "🧠 Repaso", "tab.exam": "📝 Examen", "tab.stats": "📊 Progreso",
    // Barra superior
    "top.streak": "Racha", "top.xp": "Experiencia", "top.level": "Nivel",
    "top.account": "Cuenta y sincronización", "top.enter": "Entrar",
    "top.lang": "Idioma / Language", "top.themeDark": "Cambiar a tema oscuro", "top.themeLight": "Cambiar a tema claro",
    // Oficiales
    "of.h": "🏛️ Exámenes DGT reales",
    "of.p": "Preguntas <b>reales</b> de los tests oficiales de la revista de Tráfico de la DGT (2016–2026, 10 años). Haz un <b>simulacro</b> o repite un examen concreto por año y trimestre. <b>APTO con ≤ 3 fallos</b>; las vidas no cuentan.",
    // Teoría
    "teo.h": "📖 Teoría — lectura rápida", "teo.p": "Repasos cortos por tema. Elige un tema y lee las ideas clave.",
    // Repaso
    "rev.h": "🧠 Repaso Inteligente",
    "rev.p": "Primero <b>lees</b> la respuesta correcta y su explicación, y luego te <b>pones a prueba</b> con esa misma pregunta. Ideal para tus fallos.",
    "rev.pending": "Pendientes:", "rev.start": "Empezar repaso",
    // Examen
    "ex.h": "📝 Examen de tu nivel",
    "ex.p": "30 preguntas de <b id=\"exam-nivel-actual\">tu nivel actual</b>, repartidas por los 7 temas · 30 minutos · <b>APTO con ≤ 3 fallos</b>.",
    "ex.p2": "Coge preguntas del <b>nivel de dificultad seleccionado</b> (cámbialo en Inicio o Camino). Las vidas no cuentan.",
    "ex.start": "Comenzar examen",
    "ex.p3": "¿Buscas <b>exámenes reales de la DGT</b> (por año y trimestre) o simulacros con preguntas reales? → pestaña <b>🏛️ Oficiales</b>.",
    // Progreso
    "st.h": "📊 Tu progreso", "st.profile": "👤 Perfil", "st.user": "Usuario:",
    "st.setUser": "Poner usuario y PIN", "st.export": "Exportar progreso", "st.import": "Importar progreso",
    "st.help": "Para continuar en otro dispositivo: <b>Exportar</b> aquí, copia el código y pégalo en el otro con <b>Importar</b>.",
    "st.lives": "❤️ Vidas", "st.livesNow": "Ahora tienes:", "st.reload": "Recargar vidas",
    "st.mastery": "Dominio por tema", "st.mistakes": "❌ Fallos frecuentes",
    "st.mistakesP": "Las preguntas que más veces has fallado y aún no dominas.",
    "st.practiceMistakes": "Practicar mis fallos", "st.reset": "Reiniciar progreso",
    // Quiz
    "q.prev": "◀ Anterior", "q.test": "Ponerme a prueba ▸", "q.check": "Comprobar", "q.next": "Siguiente ▶",
    "q.continue": "Continuar", "q.explain": "💡 Explicación", "q.correct": "¡Correcto!", "q.wrong": "Respuesta incorrecta",
    // Resultado nodo
    "res.done": "¡Nodo completado!", "res.go": "Seguir",
    // Examen result
    "exr.reviewFails": "Repaso de fallos", "exr.close": "Cerrar", "exr.finish": "Finalizar",
    // Vidas modal
    "vm.h": "Recargar vidas ❤️", "vm.p": "Elige cómo quieres recuperar las vidas:",
    "vm.free": "Modo fácil · recargar gratis", "vm.restr": "Modo restringido · baja una lección de la unidad actual", "vm.cancel": "Cancelar",
    // Examen modo modal
    "em.h": "Examen de la unidad 📝", "em.easy": "Modo fácil · hasta 3 fallos",
    "em.restr": "Modo restringido · 0 fallos (acertar las 30)", "em.cancel": "Cancelar",
    // Señales modo modal
    "sm.h": "Practicar señales 🚦", "sm.p": "Elige cómo quieres practicar (cada sesión son 20 preguntas al azar):",
    "sm.a": "Opción A · ¿Qué significa esta señal?", "sm.b": "Opción B · Variantes (significado + a qué grupo pertenece)", "sm.cancel": "Cancelar",
    // Código modal
    "cm.h": "Código de progreso", "cm.close": "Cerrar", "cm.accept": "Aceptar",
    "cm.chooseFile": "📂 Elegir archivo…", "cm.download": "⬇️ Descargar archivo", "cm.pin": "PIN (4 cifras):",
    // Dinámicos (app.js)
    "d.hi": "¡Hola{name}! 👋", "d.levelLine": "Nivel {lvl} · ⚡ {xp} XP · 🔥 {racha} · {hearts}",
    "d.difficulty": "Dificultad:",
    "d.secModes": "Modos de examen", "d.secReview": "Revisar", "d.secCats": "Categorías",
    "m.practice": "Práctica (Camino)", "m.examPractice": "Examen de práctica",
    "m.hard": "Test difícil", "m.hardSub": "las más falladas",
    "m.reform": "Reglamento 2026", "m.reformSub": "1 oct 2026",
    "m.official": "Exámenes oficiales DGT", "m.readTheory": "Leer teoría", "m.practiceSigns": "Practicar señales",
    "m.myErrors": "Mis errores", "m.leastSeen": "Menos vistas",
    "of.simTitle": "🎯 Simulacros de práctica (preguntas reales DGT)",
    "of.simRandom": "Simulacro aleatorio", "of.simRandomSub": "30 preguntas reales",
    "of.simHard": "Solo difíciles", "of.simHardSub": "{n} preg · las que más se fallan",
    "of.hardH": "🔥 Test difícil",
    "of.hardP": "Las <b>{n}</b> preguntas más enrevesadas: matices de velocidad, tasas de alcohol, masas, prioridad, maniobras, ITV... Mezcla preguntas reales marcadas como difíciles y preguntas \"trampa\" de repaso (IA). Pensadas para las que más se suspenden.",
    "of.hardBtn": "Test difícil (30)", "of.hardBtnSub": "las que más se fallan",
    "of.reformH": "⚖️ Reglamento nuevo · 1 de octubre de 2026",
    "of.reformP": "Las <b>{n}</b> preguntas sobre los cambios del Reglamento General de Circulación (baliza V-16, adelantamiento a ciclistas, VMP, motos, pasillo de emergencia, cinturón...). Repásalas juntas para no fallar las novedades que entran en vigor el 1 de octubre de 2026.",
    "of.reformSec": "⚖️ Reglamento nuevo (1 oct 2026)", "of.reformBtn": "Reglamento 2026", "of.reformBtnSub": "{n} preg · novedades",
    "of.info": "📊 <b>{n}</b> exámenes oficiales reales ({a1}–{a2}), <b>{q}</b> preguntas. 🔥 = preguntas de los temas donde más se suspende (velocidad, alcohol, prioridad).",
    "of.iaH": "🤖 Simulacros IA <span class=\"muted\">(no oficiales)</span>",
    "of.iaP": "Estas <b>{n}</b> preguntas de tipo \"trampa\" las <b>redactó la IA</b> (Claude) a partir del reglamento público. <b>NO son oficiales de la DGT</b> — úsalas solo como repaso extra. Están separadas del resto a propósito.",
    "of.iaSec": "🤖 Preguntas de IA (no oficial)", "of.iaBtn": "Simulacro IA (aleatorio)", "of.iaBtnSub": "30 preguntas · no oficial",
    "of.none": "No hay exámenes disponibles.",
    // Señales pseudo-preguntas
    "sig.what": "¿Qué significa esta señal?", "sig.group": "¿A qué grupo de señales pertenece esta?",
    "sig.groupExp": "{cod} · {nom} — grupo: {cat}.",
    // Teoría
    "teo.themeN": "Tema {n} · {t}", "teo.none": "Todavía no hay teoría para este tema.",
    "teo.allSigns": "🚦 Todas las señales ({n})",
    "cat.h": "🚦 Catálogo completo de señales ({n})",
    "cat.p": "Todas las señales oficiales (catálogo DGT 2025). Estúdialas por tipo o ponte a prueba.",
    "cat.practice": "📝 Practicar estas señales (test)", "cat.noImg": "sin imagen",
    "cat.new": "🆕 NUEVA 2025", "cat.redesign": "🔄 Diseño 2025",
    // Estudio / revisión
    "sn.readFirst": "📖 Lee primero", "sn.correctAns": "Respuesta correcta:",
    "rv.tag": "🔎 Revisión · pregunta {n}", "rv.got": "✅ La acertaste.", "rv.missed": "❌ La fallaste.",
    "rv.seeExp": "💡 Ver explicación",
    // Resultados / quiz
    "r.blockDone": "¡Bloque completado!", "r.blockFail": "Bloque no superado",
    "r.hits": "Aciertos: {a}/{t} · +{xp} XP", "r.reviewDone": "Repaso terminado", "r.hitsOf": "Aciertos: {a}/{t}",
    "r.noLives": "Sin vidas ❤️", "r.noLivesTxt": "Aciertos: {a}. Espera a recuperar vidas (1 cada {min} min).",
    "r.practice": "Práctica",
    // Examen
    "e.gtitle": "Examen general · {niv}", "e.utitle": "Examen U{t} · {mode}",
    "e.modeRestr": "restringido 0 fallos", "e.modeEasy": "fácil ≤3",
    "e.apto": "✅ APTO", "e.noApto": "❌ NO APTO",
    "e.unlocked": " · 🎉 ¡Nivel {n} desbloqueado!",
    "e.score": "Aciertos: {a} · Fallos: {f} · En blanco: {b} (máx. {m} para APTO) · +{xp} XP{extra}",
    "e.yourAns": "Tu respuesta:", "e.correctAns": "Correcta:", "e.blank": "— (sin responder)",
    "e.perfect": "¡Perfecto! Sin fallos. 🎉",
    "e.simRandom": "Simulacro aleatorio", "e.simHard": "Simulacro difícil", "e.dgt": "DGT · {f}",
    // Stats
    "s.mastered": "Dominadas", "s.precision": "Precisión", "s.xpLvl": "XP · Nv {n}", "s.streak": "Racha",
    "s.masteredOf": "{d}/{t} dominadas · precisión {p}", "s.noMistakes": "Aún no tienes fallos registrados. ¡Sigue practicando! 💪",
    "s.profileUndef": "— (sin definir)",
    // Toasts / prompts
    "t.noSim": "No hay preguntas para el simulacro.",
    "t.noExam": "Este examen no tiene preguntas disponibles.",
    "t.noCat": "No hay preguntas de \"{t}\" en este nivel.",
    "t.noQ": "No hay preguntas.",
    "t.noReview": "🎉 ¡No tienes preguntas pendientes de repaso!",
    "t.noSigns": "No hay señales con imagen para practicar.",
    "t.noExamLevel": "No hay preguntas para el examen en este nivel.",
    "t.noExamEnough": "No hay preguntas suficientes para el examen.",
    "t.livesFree": "❤️ Vidas recargadas (modo fácil).",
    "t.noUnit": "No hay unidad en curso de la que bajar una lección.",
    "t.noLesson": "En la unidad actual no tienes lecciones hechas que bajar; no se recarga.",
    "t.livesDown": "❤️ Vidas recargadas. Bajó la lección {l} de la Unidad {t}: tendrás que repetirla.",
    "t.needUser": "Primero pon tu usuario y PIN (botón 'Poner usuario y PIN').",
    "t.pin4": "El PIN debe ser exactamente 4 números.",
    "t.profileSaved": "Perfil guardado ✔",
    "t.fileDown": "Archivo descargado ⬇️ Pásalo al otro móvil y usa «Importar».",
    "t.fileLoaded": "Archivo cargado. Escribe el PIN y pulsa «Importar».",
    "t.fileErr": "No se pudo leer el archivo.",
    "t.copied": "Código copiado ✔", "t.copyManual": "Selecciónalo y cópialo a mano.",
    "t.badCode": "El código/archivo no es válido.", "t.badProfile": "El código no contiene un perfil válido.",
    "t.badPin": "PIN incorrecto para ese código.", "t.imported": "Progreso de {n} importado ✔",
    "t.cloudSync": "Progreso sincronizado ☁️", "t.userOtherPin": "Ese usuario ya existe con otro PIN.",
    "p.userName": "Tu nombre de usuario:", "p.pin": "PIN de 4 números (protege tu código de progreso):",
    "p.reset": "¿Reiniciar todo tu progreso? Esto no borra las preguntas.", "t.resetDone": "Progreso reiniciado",
    "exp.title": "Exportar progreso",
    "exp.help": "Pulsa «Descargar archivo» y guárdalo o pásalo al otro móvil (WhatsApp/AirDrop/Archivos). Incluye tu PIN. Si prefieres, también puedes copiar el texto.",
    "exp.copy": "Copiar texto",
    "imp.title": "Importar progreso",
    "imp.help": "Pulsa «Elegir archivo» y selecciona el archivo de progreso (o pega el texto). Después escribe el PIN de 4 cifras.",
    "imp.do": "Importar",
    "u.unit": "Unidad {t} · {titulo}", "u.blocks": "{n} preguntas · {s} bloques{lock}",
    "u.exam": "📝 Examen", "u.examCap": "Examen", "u.noContent": "Aún no hay preguntas para este nivel.",
    "u.noTheoryLevel": "Aún no hay preguntas para este nivel.",
    "cat.categoria": "Categoría · {t}", "cat.leastSeen": "Menos vistas",
    "gen.reviewInt": "Repaso inteligente",
  },
  en: {
    "tab.inicio": "🧭 Home", "tab.path": "🗺️ Path", "tab.oficiales": "🏛️ Official",
    "tab.teoria": "📖 Theory", "tab.review": "🧠 Review", "tab.exam": "📝 Exam", "tab.stats": "📊 Progress",
    "top.streak": "Streak", "top.xp": "Experience", "top.level": "Level",
    "top.account": "Account & sync", "top.enter": "Sign in",
    "top.lang": "Idioma / Language", "top.themeDark": "Switch to dark theme", "top.themeLight": "Switch to light theme",
    "of.h": "🏛️ Real DGT exams",
    "of.p": "<b>Real</b> questions from the official tests in the DGT Traffic magazine (2016–2026, 10 years). Take a <b>mock exam</b> or retake a specific test by year and quarter. <b>PASS with ≤ 3 wrong</b>; lives don't count.",
    "teo.h": "📖 Theory — quick read", "teo.p": "Short refreshers by topic. Pick a topic and read the key ideas.",
    "rev.h": "🧠 Smart Review",
    "rev.p": "First you <b>read</b> the correct answer and its explanation, then you <b>test yourself</b> on that same question. Ideal for your mistakes.",
    "rev.pending": "Pending:", "rev.start": "Start review",
    "ex.h": "📝 Exam for your level",
    "ex.p": "30 questions from <b id=\"exam-nivel-actual\">your current level</b>, spread across the 7 topics · 30 minutes · <b>PASS with ≤ 3 wrong</b>.",
    "ex.p2": "Takes questions from the <b>selected difficulty level</b> (change it in Home or Path). Lives don't count.",
    "ex.start": "Start exam",
    "ex.p3": "Looking for <b>real DGT exams</b> (by year and quarter) or mock exams with real questions? → <b>🏛️ Official</b> tab.",
    "st.h": "📊 Your progress", "st.profile": "👤 Profile", "st.user": "User:",
    "st.setUser": "Set username and PIN", "st.export": "Export progress", "st.import": "Import progress",
    "st.help": "To continue on another device: <b>Export</b> here, copy the code and paste it on the other one with <b>Import</b>.",
    "st.lives": "❤️ Lives", "st.livesNow": "You now have:", "st.reload": "Refill lives",
    "st.mastery": "Mastery by topic", "st.mistakes": "❌ Frequent mistakes",
    "st.mistakesP": "The questions you've got wrong most often and haven't mastered yet.",
    "st.practiceMistakes": "Practise my mistakes", "st.reset": "Reset progress",
    "q.prev": "◀ Previous", "q.test": "Test me ▸", "q.check": "Check", "q.next": "Next ▶",
    "q.continue": "Continue", "q.explain": "💡 Explanation", "q.correct": "Correct!", "q.wrong": "Wrong answer",
    "res.done": "Node completed!", "res.go": "Continue",
    "exr.reviewFails": "Review of mistakes", "exr.close": "Close", "exr.finish": "Finish",
    "vm.h": "Refill lives ❤️", "vm.p": "Choose how you want to get your lives back:",
    "vm.free": "Easy mode · refill for free", "vm.restr": "Restricted mode · drop a lesson from the current unit", "vm.cancel": "Cancel",
    "em.h": "Unit exam 📝", "em.easy": "Easy mode · up to 3 wrong",
    "em.restr": "Restricted mode · 0 wrong (get all 30 right)", "em.cancel": "Cancel",
    "sm.h": "Practise signs 🚦", "sm.p": "Choose how you want to practise (each session is 20 random questions):",
    "sm.a": "Option A · What does this sign mean?", "sm.b": "Option B · Variants (meaning + which group it belongs to)", "sm.cancel": "Cancel",
    "cm.h": "Progress code", "cm.close": "Close", "cm.accept": "OK",
    "cm.chooseFile": "📂 Choose file…", "cm.download": "⬇️ Download file", "cm.pin": "PIN (4 digits):",
    "d.hi": "Hi{name}! 👋", "d.levelLine": "Level {lvl} · ⚡ {xp} XP · 🔥 {racha} · {hearts}",
    "d.difficulty": "Difficulty:",
    "d.secModes": "Exam modes", "d.secReview": "Review", "d.secCats": "Categories",
    "m.practice": "Practice (Path)", "m.examPractice": "Practice exam",
    "m.hard": "Hard test", "m.hardSub": "the most-failed ones",
    "m.reform": "2026 regulations", "m.reformSub": "1 Oct 2026",
    "m.official": "Official DGT exams", "m.readTheory": "Read theory", "m.practiceSigns": "Practise signs",
    "m.myErrors": "My mistakes", "m.leastSeen": "Least seen",
    "of.simTitle": "🎯 Practice mock exams (real DGT questions)",
    "of.simRandom": "Random mock exam", "of.simRandomSub": "30 real questions",
    "of.simHard": "Hard only", "of.simHardSub": "{n} q · the most-failed ones",
    "of.hardH": "🔥 Hard test",
    "of.hardP": "The <b>{n}</b> trickiest questions: fine points of speed, alcohol limits, masses, priority, manoeuvres, roadworthiness test... A mix of real questions marked as hard and \"trap\" review questions (AI). Aimed at the ones people fail most.",
    "of.hardBtn": "Hard test (30)", "of.hardBtnSub": "the most-failed ones",
    "of.reformH": "⚖️ New regulations · 1 October 2026",
    "of.reformP": "The <b>{n}</b> questions on the changes to the General Traffic Regulations (V-16 beacon, overtaking cyclists, PMDs, motorbikes, emergency corridor, seatbelt...). Review them together so you don't miss the changes that take effect on 1 October 2026.",
    "of.reformSec": "⚖️ New regulations (1 Oct 2026)", "of.reformBtn": "2026 regulations", "of.reformBtnSub": "{n} q · what's new",
    "of.info": "📊 <b>{n}</b> real official exams ({a1}–{a2}), <b>{q}</b> questions. 🔥 = questions from the topics people fail most (speed, alcohol, priority).",
    "of.iaH": "🤖 AI mock exams <span class=\"muted\">(unofficial)</span>",
    "of.iaP": "These <b>{n}</b> \"trap\" questions were <b>written by the AI</b> (Claude) from the public regulations. <b>They are NOT official DGT questions</b> — use them only as extra practice. They're deliberately kept apart from the rest.",
    "of.iaSec": "🤖 AI questions (unofficial)", "of.iaBtn": "AI mock exam (random)", "of.iaBtnSub": "30 questions · unofficial",
    "of.none": "No exams available.",
    "sig.what": "What does this sign mean?", "sig.group": "Which group of signs does this belong to?",
    "sig.groupExp": "{cod} · {nom} — group: {cat}.",
    "teo.themeN": "Topic {n} · {t}", "teo.none": "There's no theory for this topic yet.",
    "teo.allSigns": "🚦 All signs ({n})",
    "cat.h": "🚦 Full sign catalogue ({n})",
    "cat.p": "All official signs (DGT 2025 catalogue). Study them by type or test yourself.",
    "cat.practice": "📝 Practise these signs (test)", "cat.noImg": "no image",
    "cat.new": "🆕 NEW 2025", "cat.redesign": "🔄 2025 redesign",
    "sn.readFirst": "📖 Read first", "sn.correctAns": "Correct answer:",
    "rv.tag": "🔎 Review · question {n}", "rv.got": "✅ You got it right.", "rv.missed": "❌ You got it wrong.",
    "rv.seeExp": "💡 See explanation",
    "r.blockDone": "Block completed!", "r.blockFail": "Block not passed",
    "r.hits": "Correct: {a}/{t} · +{xp} XP", "r.reviewDone": "Review finished", "r.hitsOf": "Correct: {a}/{t}",
    "r.noLives": "Out of lives ❤️", "r.noLivesTxt": "Correct: {a}. Wait to recover lives (1 every {min} min).",
    "r.practice": "Practice",
    "e.gtitle": "General exam · {niv}", "e.utitle": "Unit U{t} exam · {mode}",
    "e.modeRestr": "restricted 0 wrong", "e.modeEasy": "easy ≤3",
    "e.apto": "✅ PASS", "e.noApto": "❌ FAIL",
    "e.unlocked": " · 🎉 Level {n} unlocked!",
    "e.score": "Correct: {a} · Wrong: {f} · Blank: {b} (max {m} to PASS) · +{xp} XP{extra}",
    "e.yourAns": "Your answer:", "e.correctAns": "Correct:", "e.blank": "— (not answered)",
    "e.perfect": "Perfect! No mistakes. 🎉",
    "e.simRandom": "Random mock exam", "e.simHard": "Hard mock exam", "e.dgt": "DGT · {f}",
    "s.mastered": "Mastered", "s.precision": "Accuracy", "s.xpLvl": "XP · Lv {n}", "s.streak": "Streak",
    "s.masteredOf": "{d}/{t} mastered · accuracy {p}", "s.noMistakes": "No mistakes recorded yet. Keep practising! 💪",
    "s.profileUndef": "— (not set)",
    "t.noSim": "There are no questions for the mock exam.",
    "t.noExam": "This exam has no available questions.",
    "t.noCat": "There are no \"{t}\" questions at this level.",
    "t.noQ": "There are no questions.",
    "t.noReview": "🎉 You have no questions pending review!",
    "t.noSigns": "There are no signs with an image to practise.",
    "t.noExamLevel": "There are no questions for the exam at this level.",
    "t.noExamEnough": "Not enough questions for the exam.",
    "t.livesFree": "❤️ Lives refilled (easy mode).",
    "t.noUnit": "There's no unit in progress to drop a lesson from.",
    "t.noLesson": "You have no completed lessons to drop in the current unit; nothing refilled.",
    "t.livesDown": "❤️ Lives refilled. Dropped lesson {l} of Unit {t}: you'll have to repeat it.",
    "t.needUser": "First set your username and PIN ('Set username and PIN' button).",
    "t.pin4": "The PIN must be exactly 4 digits.",
    "t.profileSaved": "Profile saved ✔",
    "t.fileDown": "File downloaded ⬇️ Send it to the other phone and use «Import».",
    "t.fileLoaded": "File loaded. Type the PIN and press «Import».",
    "t.fileErr": "Couldn't read the file.",
    "t.copied": "Code copied ✔", "t.copyManual": "Select it and copy it by hand.",
    "t.badCode": "The code/file isn't valid.", "t.badProfile": "The code doesn't contain a valid profile.",
    "t.badPin": "Wrong PIN for that code.", "t.imported": "Progress for {n} imported ✔",
    "t.cloudSync": "Progress synced ☁️", "t.userOtherPin": "That username already exists with a different PIN.",
    "p.userName": "Your username:", "p.pin": "4-digit PIN (protects your progress code):",
    "p.reset": "Reset all your progress? This doesn't delete the questions.", "t.resetDone": "Progress reset",
    "exp.title": "Export progress",
    "exp.help": "Press «Download file» and save it or send it to the other phone (WhatsApp/AirDrop/Files). It includes your PIN. If you prefer, you can also copy the text.",
    "exp.copy": "Copy text",
    "imp.title": "Import progress",
    "imp.help": "Press «Choose file» and select the progress file (or paste the text). Then type the 4-digit PIN.",
    "imp.do": "Import",
    "u.unit": "Unit {t} · {titulo}", "u.blocks": "{n} questions · {s} blocks{lock}",
    "u.exam": "📝 Exam", "u.examCap": "Exam", "u.noContent": "There are no questions for this level yet.",
    "u.noTheoryLevel": "There are no questions for this level yet.",
    "cat.categoria": "Category · {t}", "cat.leastSeen": "Least seen",
    "gen.reviewInt": "Smart review",
  },
};

function t(key, vars) {
  const lang = LANG();
  let s = (I18N[lang] && I18N[lang][key]);
  if (s == null) s = (I18N.es[key] != null ? I18N.es[key] : key);
  if (vars) for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
  return s;
}

// Aplica las cadenas estáticas marcadas con data-i18n / data-i18n-html en el HTML.
function applyStaticI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    el.innerHTML = t(el.getAttribute("data-i18n-html"));
  });
  document.documentElement.setAttribute("lang", LANG());
}
