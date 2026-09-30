// Panel de administración: revisar, aprobar, editar y rechazar registros.
// Necesita un token de GitHub que solo tienes tú (se pega en la pantalla de entrada).

const CLAVE_TOKEN = "admin-token-github";
const $ = id => document.getElementById(id);
const principal = C.CAMPOS.find(c => c.principal) || C.CAMPOS[0];

let token = null;
let issues = [];
let pestana = "pendientes";
let editando = null; // número del issue que se está editando

// ── Token ────────────────────────────────────────────────────
function leerToken() { try { return localStorage.getItem(CLAVE_TOKEN); } catch { return null; } }
function guardarToken(t) { try { localStorage.setItem(CLAVE_TOKEN, t); } catch {} }
function borrarToken() { try { localStorage.removeItem(CLAVE_TOKEN); } catch {} }

const gh = (ruta, metodo, cuerpo) => peticion(ruta, { metodo, cuerpo, token });

// ── Mensajes ─────────────────────────────────────────────────
function aviso(texto, tipo = "") {
  const t = $("toast");
  t.textContent = texto;
  t.className = `toast ${tipo}`;
  t.hidden = false;
  clearTimeout(aviso.temporizador);
  aviso.temporizador = setTimeout(() => { t.hidden = true; }, 4500);
}

function mostrarLogin(mensaje = "", esError = true) {
  $("vista-login").hidden = false;
  $("vista-panel").hidden = true;
  $("input-token").value = "";
  $("mensaje-login").textContent = mensaje;
  $("mensaje-login").className = esError ? "error" : "meta";
}

// ── Entrada ──────────────────────────────────────────────────
async function entrar() {
  $("vista-login").hidden = false;
  $("mensaje-login").className = "meta";
  $("mensaje-login").textContent = "Comprobando…";
  try {
    const yo = await peticion("https://api.github.com/user", { token });
    await gh(""); // comprueba que el repositorio de datos existe y el token tiene acceso
    await asegurarEtiquetas();
    $("usuario").textContent = "@" + yo.login;
    $("vista-login").hidden = true;
    $("vista-panel").hidden = false;
    await cargar();
  } catch (e) {
    borrarToken();
    token = null;
    let msg = e.message;
    if (e.status === 401) msg = "El token no es válido o ha caducado.";
    if (e.status === 404) msg = `No se encuentra ${C.OWNER}/${C.REPO_DATOS}, o el token no tiene acceso a ese repositorio. Revisa config.js y los permisos del token.`;
    if (e.status === 403) msg = "El token no tiene permiso de escritura en Issues. Revisa sus permisos (Issues: Read and write).";
    mostrarLogin(msg);
  }
}

// Crea las etiquetas "pendiente" y "aprobado" si todavía no existen
async function asegurarEtiquetas() {
  const existentes = (await gh("/labels?per_page=100")).map(l => l.name.toLowerCase());
  const necesarias = [
    { name: ETIQUETA_PENDIENTE, color: "e4a11b", description: "Esperando revisión" },
    { name: ETIQUETA_APROBADO, color: "1e8449", description: "Visible en la web" },
  ];
  for (const e of necesarias) {
    if (!existentes.includes(e.name)) await gh("/labels", "POST", e);
  }
}

// ── Datos ────────────────────────────────────────────────────
async function cargar() {
  $("lista").replaceChildren();
  $("estado").hidden = false;
  $("estado").textContent = "Cargando…";
  try {
    const [abiertos, cerrados] = await Promise.all([
      pedirTodos("/issues?state=open", { token }),
      pedirTodos("/issues?state=closed", { token }),
    ]);
    issues = [...abiertos, ...cerrados];
    editando = null;
    pintar();
  } catch (e) {
    if (e.status === 401) { borrarToken(); token = null; mostrarLogin("El token ha caducado. Pega uno nuevo."); return; }
    $("estado").textContent = e.message;
  }
}

const tiene = (i, nombre) => i.labels.some(l => (l.name || l).toLowerCase() === nombre);

// Cada issue va a una pestaña: cerrado → rechazados; con "aprobado" → en la web; lo demás → pendientes
function seccion(i) {
  if (i.state === "closed") return "rechazados";
  if (tiene(i, ETIQUETA_APROBADO)) return "aprobados";
  return "pendientes";
}

// ── Pintar ───────────────────────────────────────────────────
function pintar() {
  const grupos = { pendientes: [], aprobados: [], rechazados: [] };
  for (const i of issues) grupos[seccion(i)].push(i);

  for (const b of document.querySelectorAll(".pestana")) {
    const k = b.dataset.pestana;
    b.classList.toggle("activa", k === pestana);
    b.querySelector(".cuenta").textContent = grupos[k].length;
  }

  const lista = grupos[pestana];
  $("estado").hidden = lista.length > 0;
  $("estado").textContent = {
    pendientes: "No hay nada pendiente de revisar.",
    aprobados: "Todavía no hay registros publicados en la web.",
    rechazados: "No hay registros rechazados.",
  }[pestana];
  $("lista").replaceChildren(...lista.map(i => (i.number === editando ? formularioEdicion(i) : tarjeta(i))));
}

function boton(texto, tipo, accion) {
  return el("button", {
    class: `boton ${tipo}`,
    type: "button",
    text: texto,
    onclick: async ev => {
      const botones = ev.currentTarget.closest(".tarjeta").querySelectorAll("button");
      botones.forEach(b => (b.disabled = true));
      try { await accion(); }
      catch (e) { aviso(e.message, "error"); botones.forEach(b => (b.disabled = false)); }
    },
  });
}

function tarjeta(i) {
  const d = parsearCuerpo(i.body);
  const s = seccion(i);
  const acciones = [];

  if (s === "pendientes") acciones.push(boton("Aprobar", "ok", () => aprobar(i)));
  if (s === "aprobados") acciones.push(boton("Quitar de la web", "secundario", () => retirar(i)));
  if (s !== "rechazados") {
    acciones.push(boton("Editar", "secundario", async () => { editando = i.number; pintar(); }));
    acciones.push(boton("Rechazar", "peligro", () => rechazar(i)));
  } else {
    acciones.push(boton("Recuperar", "secundario", () => reabrir(i)));
  }
  acciones.push(boton(i.locked ? "Permitir comentarios" : "Bloquear comentarios", "secundario", () => alternarBloqueo(i)));
  acciones.push(el("a", { class: "boton secundario", href: i.html_url, target: "_blank", rel: "noopener", text: "Ver en GitHub" }));

  return el("article", { class: "tarjeta" },
    el("p", { class: "meta" },
      `#${i.number} · por `,
      el("a", { href: `https://github.com/${i.user.login}`, target: "_blank", rel: "noopener", text: "@" + i.user.login }),
      ` · ${fechaCorta(i.created_at)}`,
      i.locked ? " · comentarios bloqueados" : ""
    ),
    el("h3", { text: d[principal.clave] || "(sin título)" }),
    C.CAMPOS.filter(c => c !== principal).map(c => el("div", {},
      el("div", { class: "campo-etiqueta", text: c.label }),
      el("div", { class: "campo-valor", text: d[c.clave] || "—" })
    )),
    el("div", { class: "acciones" }, acciones)
  );
}

function formularioEdicion(i) {
  const d = parsearCuerpo(i.body);
  const entradas = {};

  const campos = C.CAMPOS.map(c => {
    let control;
    if (c.opciones) {
      const opciones = d[c.clave] && !c.opciones.includes(d[c.clave]) ? [d[c.clave], ...c.opciones] : c.opciones;
      control = el("select", {}, opciones.map(o => el("option", { value: o, text: o })));
    } else if (c.tipo === "largo") {
      control = el("textarea", { rows: "5" });
    } else {
      control = el("input", { type: "text" });
    }
    control.value = d[c.clave] || "";
    entradas[c.clave] = control;
    return el("label", { class: "campo-form" }, el("span", { class: "campo-etiqueta", text: c.label }), control);
  });

  const form = el("form", {
    class: "tarjeta",
    onsubmit: async e => {
      e.preventDefault();
      const nuevos = {};
      for (const c of C.CAMPOS) nuevos[c.clave] = entradas[c.clave].value;
      const guardar = form.querySelector("button[type=submit]");
      guardar.disabled = true;
      try {
        Object.assign(i, await gh(`/issues/${i.number}`, "PATCH", { body: construirCuerpo(nuevos) }));
        editando = null;
        pintar();
        aviso("Cambios guardados.", "ok");
      } catch (err) {
        aviso(err.message, "error");
        guardar.disabled = false;
      }
    },
  },
    el("p", { class: "meta", text: `Editando #${i.number}` }),
    campos,
    el("div", { class: "acciones" },
      el("button", { class: "boton ok", type: "submit", text: "Guardar" }),
      el("button", { class: "boton secundario", type: "button", text: "Cancelar", onclick: () => { editando = null; pintar(); } })
    )
  );
  return form;
}

// ── Acciones ─────────────────────────────────────────────────
async function ponerEtiqueta(i, nombre) {
  i.labels = await gh(`/issues/${i.number}/labels`, "POST", { labels: [nombre] });
}
async function quitarEtiqueta(i, nombre) {
  try { await gh(`/issues/${i.number}/labels/${encodeURIComponent(nombre)}`, "DELETE"); }
  catch (e) { if (e.status !== 404) throw e; } // si no la tenía, no pasa nada
  i.labels = i.labels.filter(l => (l.name || l).toLowerCase() !== nombre);
}

async function aprobar(i) {
  await ponerEtiqueta(i, ETIQUETA_APROBADO);
  await quitarEtiqueta(i, ETIQUETA_PENDIENTE);
  pintar();
  aviso("Aprobado: ya aparece en la web.", "ok");
}

async function retirar(i) {
  await ponerEtiqueta(i, ETIQUETA_PENDIENTE);
  await quitarEtiqueta(i, ETIQUETA_APROBADO);
  pintar();
  aviso("Quitado de la web. Está otra vez en Pendientes.");
}

async function rechazar(i) {
  const d = parsearCuerpo(i.body);
  if (!confirm(`¿Rechazar "${d[principal.clave] || "#" + i.number}"? Dejará de verse en la web. Podrás recuperarlo después.`)) {
    pintar();
    return;
  }
  Object.assign(i, await gh(`/issues/${i.number}`, "PATCH", { state: "closed", state_reason: "not_planned" }));
  pintar();
  aviso("Rechazado.");
}

async function reabrir(i) {
  Object.assign(i, await gh(`/issues/${i.number}`, "PATCH", { state: "open" }));
  pintar();
  aviso("Recuperado.");
}

async function alternarBloqueo(i) {
  if (i.locked) await gh(`/issues/${i.number}/lock`, "DELETE");
  else await gh(`/issues/${i.number}/lock`, "PUT", { lock_reason: "resolved" });
  i.locked = !i.locked;
  pintar();
}

// ── Eventos ──────────────────────────────────────────────────
$("form-login").addEventListener("submit", e => {
  e.preventDefault();
  const t = $("input-token").value.trim();
  if (!t) return;
  token = t;
  guardarToken(t);
  entrar();
});
$("btn-salir").addEventListener("click", () => {
  borrarToken();
  token = null;
  issues = [];
  mostrarLogin("Has salido. El token se ha borrado de este navegador.", false);
});
$("btn-actualizar").addEventListener("click", cargar);
document.querySelectorAll(".pestana").forEach(b =>
  b.addEventListener("click", () => { pestana = b.dataset.pestana; editando = null; pintar(); })
);

// ── Arranque ─────────────────────────────────────────────────
if (configSinRellenar()) {
  mostrarLogin("Primero configura config.js con tu usuario de GitHub y el nombre del repositorio de datos.");
} else {
  token = leerToken();
  if (token) entrar();
  else mostrarLogin("", false);
}
