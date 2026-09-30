// ─────────────────────────────────────────────────────────────
//  ESTE ES EL ÚNICO ARCHIVO QUE TIENES QUE EDITAR
// ─────────────────────────────────────────────────────────────
window.CONFIG = {
  // Tu nombre de usuario de GitHub (el que sale en github.com/TU-USUARIO)
  OWNER: "HeFraFol",

  // El repositorio donde se guardan los registros (los issues)
  REPO_DATOS: "WebPruebasDatos",

  // Nombre del archivo de la plantilla del formulario (en el repo de datos)
  PLANTILLA: "registro.yml",

  // Título que aparece arriba en la web
  TITULO_WEB: "Mi web",

  // Los campos de cada registro.
  // IMPORTANTE: "label" tiene que ser EXACTAMENTE igual que el "label" de registro.yml
  //   principal: true  → se usa como título de la tarjeta
  //   filtro: true     → aparece como desplegable para filtrar en la web
  //   tipo: "largo"    → en el panel de admin se edita con un cuadro grande
  //   opciones: [...]  → en el panel de admin se edita con un desplegable
  CAMPOS: [
    { clave: "nombre", label: "Nombre", principal: true },
    { clave: "descripcion", label: "Descripción", tipo: "largo" },
    { clave: "categoria", label: "Categoría", filtro: true, opciones: ["General", "Evento", "Otro"] },
  ],
};
