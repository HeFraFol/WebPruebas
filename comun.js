// Funciones compartidas por la web pública y el panel de admin.
// No hace falta tocar este archivo: todo se configura en config.js

const C = window.CONFIG;
const API = `https://api.github.com/repos/${C.OWNER}/${C.REPO_DATOS}`;
const ETIQUETA_PENDIENTE = "pendiente";
const ETIQUETA_APROBADO = "aprobado";

function configSinRellenar() {
  return !C.OWNER || C.OWNER === "tu-usuario";
}

function normalizar(texto) {
  return String(texto || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Los formularios de GitHub guardan el texto así:
//   ### Nombre
//
//   Mercado de artesanía
//
//   ### Descripción
//   ...
// Esta función lo convierte en { nombre: "Mercado de artesanía", descripcion: "..." }
function parsearCuerpo(body) {
  const porEtiqueta = {};
  const bloques = String(body || "").replace(/\r\n/g, "\n").split(/^### /m).slice(1);
  for (const bloque of bloques) {
    const salto = bloque.indexOf("\n");
    const titulo = salto === -1 ? bloque : bloque.slice(0, salto);
    let valor = salto === -1 ? "" : bloque.slice(salto + 1).trim();
    if (valor === "_No response_") valor = "";
    porEtiqueta[normalizar(titulo)] = valor;
  }
  const datos = {};
  for (const campo of C.CAMPOS) datos[campo.clave] = porEtiqueta[normalizar(campo.label)] || "";
  return datos;
}

// Lo contrario: de { nombre: "..." } al texto con el formato de GitHub
function construirCuerpo(datos) {
  return C.CAMPOS
    .map(c => `### ${c.label}\n\n${String(datos[c.clave] || "").trim() || "_No response_"}`)
    .join("\n\n");
}

function aRegistro(issue) {
  return {
    id: issue.number,
    autor: issue.user ? issue.user.login : "",
    fecha: issue.created_at,
    url: issue.html_url,
    datos: parsearCuerpo(issue.body),
  };
}

function urlNuevoRegistro() {
  return `https://github.com/${C.OWNER}/${C.REPO_DATOS}/issues/new?template=${encodeURIComponent(C.PLANTILLA)}`;
}

function fechaCorta(iso) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

// Hace una petición a la API de GitHub y convierte los errores en mensajes claros
async function peticion(ruta, { metodo = "GET", cuerpo, token } = {}) {
  const url = ruta.startsWith("https://") ? ruta : API + ruta;
  const headers = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cuerpo !== undefined) headers["Content-Type"] = "application/json";

  const r = await fetch(url, {
    method: metodo,
    headers,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    cache: "no-store",
  });

  if ((r.status === 403 || r.status === 429) && r.headers.get("x-ratelimit-remaining") === "0") {
    const reset = Number(r.headers.get("x-ratelimit-reset")) * 1000;
    const minutos = Math.max(1, Math.ceil((reset - Date.now()) / 60000));
    const e = new Error(`GitHub ha limitado las consultas desde tu conexión. Prueba otra vez en unos ${minutos} minutos.`);
    e.status = r.status;
    throw e;
  }
  if (!r.ok) {
    let mensaje = "";
    try { mensaje = (await r.json()).message; } catch {}
    const e = new Error(mensaje ? `GitHub dice: ${mensaje}` : `Error ${r.status}`);
    e.status = r.status;
    throw e;
  }
  if (r.status === 204) return null;
  const texto = await r.text();
  return texto ? JSON.parse(texto) : null;
}

// Pide todas las páginas de una lista (100 por página, máximo 1000 elementos)
async function pedirTodos(ruta, opciones) {
  const todos = [];
  const sep = ruta.includes("?") ? "&" : "?";
  for (let pagina = 1; pagina <= 10; pagina++) {
    const lote = await peticion(`${ruta}${sep}per_page=100&page=${pagina}`, opciones);
    todos.push(...lote.filter(i => !i.pull_request));
    if (lote.length < 100) break;
  }
  return todos;
}

// Crea elementos HTML de forma segura (el texto de los usuarios nunca se interpreta como HTML)
function el(tag, props = {}, ...hijos) {
  const nodo = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") nodo.className = v;
    else if (k === "text") nodo.textContent = v;
    else if (k.startsWith("on")) nodo.addEventListener(k.slice(2), v);
    else nodo.setAttribute(k, v === true ? "" : v);
  }
  for (const h of hijos.flat(Infinity)) if (h != null && h !== false) nodo.append(h);
  return nodo;
}

// Exporta para poder probarlo fuera del navegador
if (typeof module !== "undefined") module.exports = { parsearCuerpo, construirCuerpo, normalizar };
