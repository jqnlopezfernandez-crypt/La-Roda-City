# Publicar La Roda City en internet

Para que cualquiera juegue desde su móvil (sin estar en tu Wi-Fi) hacen falta dos piezas:

| Pieza | Dónde | Coste | Qué está listo |
|---|---|---|---|
| **Juego** (la página) | GitHub Pages | gratis | `.github/workflows/pages.yml` compila y publica en cada subida |
| **Servidor multijugador** | un alojamiento Node.js con WebSocket (p. ej. Render) | plan gratuito | `Dockerfile`, `render.yaml`, ruta `GET /salud` |

**Nada de esto está publicado todavía.** Los pasos con cuentas los tienes que hacer tú; Claude no
crea cuentas, no acepta condiciones ni introduce contraseñas.

## Antes de empezar: una decisión
GitHub Pages es gratis con **repositorios públicos**. Eso significa que el código y las imágenes de
`public/referencias/` (tu trazado y la captura del mapa) quedarían visibles. Alternativas: pagar
GitHub Pro para Pages privado, o quitar las referencias del repositorio publicado.

## 1. Subir el proyecto a GitHub

**Camino más fácil (recomendado):** Claude sube el código por ti.
1. Crea una cuenta en https://github.com.
2. En claude.ai → Ajustes → Conectores, conecta **GitHub** con esa cuenta.
3. En GitHub crea un repositorio vacío llamado `la-roda-city` y dile a Claude tu usuario.
Claude lo añade a la sesión con permiso de escritura, sube el proyecto y activa el flujo de Pages.

**Camino manual (si prefieres no conectar GitHub):**
0. En tu PC, copia `docs\despliegue\pages.yml` a `.github\workflows\pages.yml` (crea las carpetas
   si no existen). Claude no puede escribir en esa carpeta de tu equipo; en su copia del proyecto ya está.
1. Crea una cuenta en https://github.com (si no tienes).
2. Crea un repositorio nuevo llamado `la-roda-city` (vacío, sin README).
3. Instala **GitHub Desktop** (https://desktop.github.com) → *File → Add local repository* →
   elige `Documentos\La-Roda-City`. Como la carpeta aún no es un repositorio, GitHub Desktop
   ofrecerá *create a repository*: acéptalo, haz el primer *commit* y pulsa *Publish repository*.
   (`.gitignore` ya excluye `node_modules`, compilaciones y registros.)

## 2. Publicar el servidor (ejemplo con Render)
1. Crea una cuenta en https://render.com con tu cuenta de GitHub.
2. *New → Blueprint* → elige el repositorio `la-roda-city`. Render lee `render.yaml` y construye el `Dockerfile`.
3. Cuando termine, abre `https://<nombre>.onrender.com/salud`. Debe responder `{"ok":true,"juego":"La Roda City"}`.
4. Apunta la dirección: el juego usará `wss://<nombre>.onrender.com` (con **wss**, no https).

Nota del plan gratuito: el servidor se duerme tras unos minutos sin uso y tarda ~1 minuto en
despertar con la primera conexión.

## 3. Publicar el juego en GitHub Pages
1. En GitHub, repositorio → *Settings → Pages* → *Source*: **GitHub Actions**.
2. *Settings → Secrets and variables → Actions → Variables* → *New repository variable*:
   - Nombre: `VITE_SERVER_URL`
   - Valor: `wss://<nombre>.onrender.com`
3. *Actions → Publicar juego en GitHub Pages → Run workflow*. Al terminar, el juego queda en
   `https://<tu-usuario>.github.io/la-roda-city/`.

## 4. Comprobar
- Abre el juego en dos móviles con datos (no Wi-Fi), crea una sala en uno y entra con el código en el otro.
- Si no conecta: revisa que `VITE_SERVER_URL` empieza por `wss://` y que `/salud` responde.

## Qué se ha comprobado sin internet
- Compilación de producción del cliente con `VITE_SERVER_URL` y del servidor (`npm run server:build`).
- Prueba con dos navegadores contra el servidor de producción **en otro origen**
  (`tests/e2e/multijugador.mjs`): sala, código, enlace, sincronización y desconexión.
- Cabeceras CORS del emparejamiento y ruta `/salud`.
- No se ha probado: el despliegue real en GitHub Pages y Render (requiere tus cuentas) ni HTTPS/WSS
  extremo a extremo (lo proporciona el alojamiento).
