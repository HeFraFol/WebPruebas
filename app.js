// Web pública: muestra los registros aprobados. Solo lee, no necesita token.

const CLAVE_CACHE = "registros-cache-v1";
const SEGUNDOS_CACHE = 120; // evita gastar consultas si el visitante recarga mucho

const $ = id => document.getElementById(id);
const principal = C.CAMPOS.find(c => c.principal) || C.CAMPOS[0];
const campoFiltro = C.CAMPOS.find(c => c.filtro);
let registros = [];

document.title = C.TITULO_WEB;
$("titulo").textContent = C.TITULO_WEB;
$("btn-anadir").href = urlNuevoRegistro();

function leerCache() {
  try {
    const c = JSON.parse(sessionStorage.getItem(CLAVE_CACHE));
    if (c && Date.now() - c.t < SEGUNDOS_CACHE * 1000) return c.datos;
  } catch {}
  return null;
}
function guardarCache(datos) {
  try { sessionStorage.setItem(CLAVE_CACHE, JSON.stringify({ t: Date.now(), datos })); } catch {}
}
function borrarCache() {
  try { sessionStorage.removeItem(CLAVE_CACHE); } catch {}
}

function mostrarEstado(texto, esError = false) {
  $("estado").hidden = false;
  $("estado").textContent = texto;
  $("estado").classList.toggle("error", esError);
  $("rejilla").replaceChildren();
}

async function cargar() {
  if (configSinRellenar()) {
    mostrarEstado("Falta configurar la web: abre config.js y pon tu usuario de GitHub y el nombre del repositorio de datos.", true);
    return;
  }
  mostrarEstado("Cargando…");
  try {
    let datos = leerCache();
    if (!datos) {
      const issues = await pedirTodos(`/issues?labels=${ETIQUETA_APROBADO}&state=open`);
      datos = issues.map(aRegistro);
      guardarCache(datos);
    }
    registros = datos;
    prepararFiltro();
    pintar();
  } catch (e) {
    mostrarEstado(
      e.status === 404
        ? `No se encuentra el repositorio ${C.OWNER}/${C.REPO_DATOS}. Revisa config.js y que el repositorio sea público.`
        : e.message,
      true
    );
  }
}

function prepararFiltro() {
  const select = $("filtro");
  if (!campoFiltro) { select.hidden = true; return; }
  const actual = select.value;
  const valores = [...new Set(registros.map(r => r.datos[campoFiltro.clave]).filter(Boolean))].sort();
  select.replaceChildren(
    el("option", { value: "", text: `${campoFiltro.label}: todas` }),
    valores.map(v => el("option", { value: v, text: v }))
  );
  if (valores.includes(actual)) select.value = actual;
}

function pintar() {
  const q = normalizar($("buscador").value);
  const f = campoFiltro ? $("filtro").value : "";

  const lista = registros.filter(r => {
    if (f && r.datos[campoFiltro.clave] !== f) return false;
    if (!q) return true;
    const texto = normalizar([...Object.values(r.datos), r.autor].join(" "));
    return texto.includes(q);
  });

  $("contador").textContent = registros.length === 1 ? "1 registro" : `${registros.length} registros`;

  if (!lista.length) {
    mostrarEstado(registros.length ? "No hay resultados con esa búsqueda." : "Todavía no hay registros. ¡Sé el primero en añadir uno!");
    return;
  }
  $("estado").hidden = true;
  $("rejilla").replaceChildren(...lista.map(tarjeta));
}

function tarjeta(r) {
  const otros = C.CAMPOS.filter(c => c !== principal && c !== campoFiltro && r.datos[c.clave]);
  return el("article", { class: "tarjeta" },
    campoFiltro && r.datos[campoFiltro.clave] ? el("span", { class: "chip", text: r.datos[campoFiltro.clave] }) : null,
    el("h3", { text: r.datos[principal.clave] || "(sin título)" }),
    otros.map(c => el("div", {},
      el("div", { class: "campo-etiqueta", text: c.label }),
      el("div", { class: "campo-valor", text: r.datos[c.clave] })
    )),
    el("p", { class: "meta" },
      "por ",
      el("a", { href: `https://github.com/${r.autor}`, target: "_blank", rel: "noopener", text: "@" + r.autor }),
      ` · ${fechaCorta(r.fecha)} · `,
      el("a", { href: r.url, target: "_blank", rel: "noopener", text: "ver en GitHub" })
    )
  );
}

$("buscador").addEventListener("input", pintar);
$("filtro").addEventListener("change", pintar);
$("btn-recargar").addEventListener("click", () => { borrarCache(); cargar(); });

cargar();
