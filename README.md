# eWorker360 Dominicana

Sitio estático de eWorker360 Dominicana preparado para Cloudflare Workers y GitHub Pages con backend de producción en Supabase.

## Cloudflare Workers: publicación reproducible

`wrangler.jsonc` configura el Worker `eworkerdemo` sin código de servidor. Los archivos mantienen sus rutas `.html` y los recursos inexistentes devuelven 404.

Wrangler publica únicamente `dist/`. Su build copia los archivos enumerados en `.assetsignore` y recrea la carpeta generada para eliminar recursos obsoletos. `.assetsignore` se copia también a `dist/` y **excluye todo por defecto**. No se publican `node_modules`, `.git`, `.github`, `tests`, `docs`, `supabase`, configuración, dependencias ni archivos nuevos sin autorizar. Al añadir una página, módulo o imagen, actualizar la lista y ejecutar las pruebas. No sustituirla por un comodín para todos los archivos JS. `_redirects` sirve `index.html` en `/` manteniendo las rutas `.html` existentes.

Configuración de Workers Builds:

- Rama de producción: `main`.
- Directorio raíz: repositorio (`/`).
- Instalación: `npm ci`, con `package-lock.json` versionado.
- Build: `npm test`; Wrangler ejecuta automáticamente `npm run build` antes de publicar, incluso con el comando de deploy existente.
- Deploy: `npm run deploy`; el comando existente `npx wrangler deploy` también utiliza la versión local fijada.
- Wrangler está fijado en `devDependencies`; no omitir las dependencias de desarrollo durante la instalación.

Verificación local/CI:

```bash
npm ci
npm test
npm run check:deploy
npm run test:assets
```

La última prueba sirve los archivos con Wrangler, compara su contenido original y confirma respuestas 404 para rutas internas. El dry-run no publica ni certifica por sí solo el despliegue remoto. Para previsualizar: `npm run preview`.

Referencia: [configuración oficial de assets y .assetsignore](https://developers.cloudflare.com/workers/static-assets/binding/).

### Dominio y correo finales

El origen `https://eworkerdemo.zencontroller.workers.dev` está autorizado en el código CORS. Para aplicarlo al backend existente, volver a desplegar `notify-submission` y `manage-staff`. En Supabase Auth, añadir `https://eworkerdemo.zencontroller.workers.dev/reset-password.html` a Redirect URLs; conservar GitHub Pages durante la transición. El despliegue de Workers no publica automáticamente las funciones de Supabase.

Antes de usar un dominio nuevo (incluido `workers.dev`), añadir **su origen exacto** a `supabase/functions/_shared/cors.ts` y volver a desplegar ambas Edge Functions. Añadir también su URL de recuperación en Supabase Auth. No permitir globalmente `*.workers.dev`. GitHub Pages y los dominios corporativos ya enumerados se conservan.

Al recibir los datos finales del cliente, actualizar el dominio/DNS, las URLs de Auth, `ADMIN_PORTAL_URL`, las URLs canónicas/sitemap/robots y los datos públicos de contacto. Configurar el destinatario en `site_settings.notification_email` y verificar el remitente corporativo en Resend. Las credenciales se mantienen en Supabase, nunca en Wrangler ni en el frontend. La entrega real del correo y el login requieren una prueba en el dominio publicado; las pruebas de código no sustituyen esa comprobación.

## Arquitectura

- GitHub Pages: frontend público, login y paneles.
- Supabase Postgres: solicitudes, mensajes, propuestas, perfiles y ajustes compartidos.
- Supabase Auth: acceso por correo y contraseña para administradores y reclutadores.
- Supabase RLS: controla quién puede leer o modificar los datos.
- Supabase Edge Functions: invitaciones de reclutadores y notificaciones por correo.
- Cloudflare: DNS del dominio cuando finalicen las pruebas de producción.

## Configuración pública del navegador

`supabase-config.js` contiene únicamente el Project URL y la Publishable key. Esos valores son públicos por diseño. Nunca se debe añadir al repositorio una Secret key, `service_role`, contraseña de base de datos, contraseña SMTP ni API key de Resend.

## Base de datos

La migración inicial está en:

`supabase/migrations/20260904_initial_production_schema.sql`

Crea:

- `profiles`
- `applications`
- `contact_messages`
- `business_leads`
- `site_settings`

Todas las tablas de aplicación tienen RLS. El público puede enviar formularios, pero no puede leer los registros. Los perfiles activos `admin` y `recruiter` pueden leer las solicitudes completas y actualizar seguimiento. Solo `admin` administra perfiles y ajustes.

El primer administrador debe existir primero en Supabase Auth y luego tener una fila en `public.profiles` con el mismo UUID, `role = 'admin'` y `active = true`.

## Edge Functions

Funciones incluidas:

- `manage-staff`: requiere una sesión autenticada y vuelve a comprobar que el perfil sea un administrador activo antes de invitar reclutadores.
- `notify-submission`: recibe únicamente `{ type, id }`, busca el registro del lado del servidor y envía el aviso al correo configurado. No devuelve datos de la solicitud al visitante.

`supabase/config.toml` mantiene `manage-staff` con verificación JWT y configura `notify-submission` como endpoint público. La notificación utiliza una clave de idempotencia por tipo/registro para evitar duplicados durante reintentos.

### Secretos de funciones

Las credenciales internas de Supabase se suministran automáticamente al runtime de Edge Functions. Para notificaciones hay que configurar directamente en Supabase, nunca en GitHub:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` — remitente autorizado/verificado en Resend, por ejemplo `eWorker360 <notificaciones@dominio-verificado>`
- `ADMIN_PORTAL_URL` — opcional; durante la migración puede apuntar al panel de GitHub Pages y después al dominio final.

El dominio/remitente debe estar verificado en el proveedor de correo antes de considerar las notificaciones terminadas.

## Despliegue de funciones

Proyecto Supabase actual: `zyghqdnjfiulkfyhtztc`.

Con Supabase CLI, después de autenticar la máquina del operador:

```bash
supabase link --project-ref zyghqdnjfiulkfyhtztc
supabase functions deploy manage-staff
supabase functions deploy notify-submission
```

También pueden administrarse desde la sección Edge Functions del proyecto. No se deben guardar tokens de Supabase CLI ni secretos del proyecto en el repositorio.

## Auth URLs durante la migración

Mientras el dominio final no esté activo, los redirects autorizados deben incluir:

`https://javiermorenoz30.github.io/eworkerdemo/**`

El flujo de recuperación/invitación termina en `reset-password.html`. Después del corte de dominio se añadirá `https://eworker360dominicana.com/**` y se actualizará el Site URL.

## Pruebas

Las pruebas estructurales y de dominio se ejecutan con:

```bash
npm test
```

GitHub Actions ejecuta la suite, el dry-run y las pruebas HTTP de assets en pull requests y en las ramas `main` y `supabase-production`.

El archivo `supabase/tests/rls-smoke.sql` contiene verificaciones manuales de seguridad para SQL Editor y termina con `rollback`.

## Orden de salida a producción

1. Verificar migración y primer administrador.
2. Desplegar Edge Functions.
3. Probar login, recuperación de contraseña y RLS.
4. Enviar una solicitud real de prueba y verificarla desde otro dispositivo.
5. Probar mensajes y propuestas.
6. Probar un usuario recruiter y confirmar que no puede modificar perfiles ni ajustes.
7. Configurar y verificar correo transaccional.
8. Ejecutar la suite completa y pruebas manuales.
9. Solo entonces fusionar/publicar la rama aprobada y apuntar el dominio mediante Cloudflare.
10. Conservar los registros MX/TXT/SPF/DKIM/DMARC durante el cambio de DNS.

No se debe cambiar el dominio a esta versión antes de completar las pruebas anteriores.
