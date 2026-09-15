# eWorker360 Dominicana

Repositorio de producción de `eworker360dominicana.com`.

La web es un frontend estático publicado con Cloudflare Workers y usa Supabase para autenticación, base de datos y Edge Functions. La rama de producción es `main`.

## Estructura actual

El contenido público se mantiene directamente en GitHub; el antiguo editor/CMS de landing ya no forma parte del flujo de publicación.

Archivos principales:

- `index.html`: landing principal.
- `styles.css` / `app.js`: estilos y comportamiento de la landing.
- `application.html` / `application.js`: formulario de empleo.
- `admin.html`, `admin.js`, `admin.css`: panel administrativo.
- `recruiter.html`, `recruiter.js`, `staff.css`: panel operativo.
- `staff-login.html`, `reset-password.html`, `reset-password.js`: acceso y recuperación.
- `es/` y `en/`: páginas SEO bilingües.
- `seo-pages.css`: estilos de las páginas SEO.
- `assets/`: imágenes, logotipo y recursos públicos.
- `supabase/`: migraciones históricas, configuración y Edge Functions.

No mover estos archivos únicamente para reorganizar carpetas: varias rutas forman parte del sitio publicado, redirects, Auth y pruebas.

## Contenido y assets

Los textos, imágenes y secciones de la web se editan en los archivos versionados del repositorio y se publican mediante una rama/PR.

`assets/` contiene los recursos visuales. Al agregar una página, script, hoja de estilos o imagen pública, también debe añadirse a `.assetsignore`.

`.assetsignore` funciona como una **allowlist**: el build excluye todo por defecto y copia a `dist/` únicamente los archivos autorizados. Esto evita publicar tests, documentación interna, configuración, `supabase/`, `.github/`, dependencias u otros archivos del repositorio.

## Cloudflare Workers

`wrangler.jsonc` publica el contenido generado en `dist/`.

Flujo esperado:

```bash
npm ci
npm test
npm run check:deploy
npm run test:assets
```

Comandos disponibles:

```bash
npm run build        # prepara dist/
npm run deploy       # publica con Wrangler
npm run preview      # servidor de desarrollo
npm run check:deploy # dry-run de Wrangler
npm run test:assets  # valida los assets servidos por el runtime
```

GitHub Actions ejecuta la suite, el dry-run y las pruebas HTTP de assets en pull requests y en pushes a `main`.

## Supabase

Supabase se usa para:

- Auth de administradores/reclutadores;
- `profiles`;
- solicitudes de empleo;
- mensajes de contacto;
- leads/propuestas de empresas;
- ajustes compartidos del sitio;
- Edge Functions de administración y notificación.

Las tablas de aplicación están protegidas con RLS. Los formularios públicos pueden insertar los registros permitidos, pero no leer información administrativa.

### Migraciones

Las migraciones dentro de `supabase/migrations/` son historial de base de datos y se conservan incluso cuando una función antigua ya no se usa en la interfaz.

No borrar ni reescribir migraciones históricas para "limpiar" el repositorio. Los cambios nuevos de esquema deben añadirse como nuevas migraciones.

### Edge Functions

Funciones versionadas actualmente:

- `manage-staff`: invita y administra usuarios autorizados después de validar la sesión y el rol.
- `manage-records`: ejecuta acciones administrativas protegidas sobre registros.
- `notify-submission`: recibe una referencia `{ type, id }`, recupera los datos del lado del servidor y envía la notificación al correo configurado.

El despliegue del frontend de Cloudflare **no despliega automáticamente** las Edge Functions de Supabase.

## Correo y secretos

Las credenciales privadas se configuran fuera de GitHub, dentro del entorno correspondiente de Supabase/servicios externos.

Nunca guardar en el repositorio:

- `service_role` o Secret keys de Supabase;
- contraseñas de base de datos;
- contraseñas SMTP;
- API keys de proveedores de correo;
- tokens CLI o credenciales de Cloudflare.

`supabase-config.js` contiene únicamente valores públicos necesarios para el navegador.

La función de notificación actual usa las credenciales de correo configuradas en el entorno de Supabase y obtiene el destinatario desde `site_settings`.

## Auth, CORS y dominio

El dominio público actual es `https://eworker360dominicana.com/`.

Cuando se cambie un dominio, subdominio o URL de panel, hay que revisar conjuntamente:

- Supabase Auth Site URL y Redirect URLs;
- orígenes permitidos en `supabase/functions/_shared/cors.ts`;
- redirect de invitación/recuperación;
- URLs canónicas, `sitemap.xml` y `robots.txt`;
- enlaces administrativos usados por las notificaciones.

No ampliar CORS con comodines globales para `*.workers.dev`.

## Pruebas

La suite principal se ejecuta con:

```bash
npm test
```

Además:

```bash
npm run check:deploy
npm run test:assets
```

Las pruebas cubren estructura de formularios/paneles, Auth, CORS, dominio, seguridad de producción, esquema activo, SEO y publicación de assets.

`supabase/tests/rls-smoke.sql` contiene verificaciones manuales de RLS para SQL Editor y termina con `rollback`.

## Seguridad de producción

Antes de fusionar cambios a `main`:

1. trabajar en una rama;
2. comprobar que no se hayan añadido secretos;
3. ejecutar la suite completa;
4. ejecutar el dry-run de Cloudflare;
5. validar los assets publicados;
6. revisar formularios, login, paneles y rutas afectadas;
7. fusionar únicamente con CI en verde.

No modificar DNS, MX/TXT/SPF/DKIM/DMARC, datos de Supabase ni configuración externa como parte de cambios puramente de código o limpieza del repositorio.
