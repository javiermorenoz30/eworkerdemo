# Diseño: Editor sencillo de la landing para Boss/Admin

## Objetivo

Convertir la sección **Contenido** del panel de eWorker360 en un editor sencillo de la página principal. El dueño de la web (**Boss**) y el desarrollador (**Admin**) tendrán exactamente los mismos permisos. El editor debe permitir cambiar textos e imágenes, agregar o eliminar fotos, crear secciones a partir de plantillas, ocultarlas y reordenarlas sin tocar código.

La experiencia debe usar lenguaje normal para un usuario no técnico. Se eliminarán avisos internos como “Datos centralizados”, “Backend conectado”, “Supabase Auth”, “RLS” y textos similares del panel visible.

## Alcance

Incluido:

- Nuevo rol `boss` con los mismos permisos efectivos que `admin`.
- Editor únicamente para la **landing principal**.
- Edición de títulos, subtítulos, párrafos, etiquetas, textos de botones y destinos de botones.
- Edición, subida, sustitución y eliminación de imágenes desde computadora o teléfono.
- Gestión de secciones: agregar desde plantillas, duplicar, ocultar/mostrar, eliminar y reordenar.
- Flujo editorial **Borrador → Vista previa → Publicar**.
- La web pública solo consume la versión publicada.
- Almacenamiento de imágenes en Supabase Storage.
- Protección de escritura mediante Supabase/RLS para `admin` y `boss`.
- Conservación del funcionamiento bilingüe Español/Inglés de la landing actual.

Fuera de alcance:

- Editor de las páginas internas como formulario de aplicación, login o páginas legales.
- Constructor libre tipo Wix.
- Edición de CSS, JavaScript o HTML desde el panel.
- Rediseño visual completo de la landing.
- Sistema avanzado de permisos por sección.

## Experiencia del editor

La sección actual **Contenido** pasa a llamarse **Editar página principal**.

En la cabecera habrá tres acciones principales:

1. **Guardar borrador**
2. **Vista previa**
3. **Publicar**

Debajo se mostrará una lista de tarjetas, una por sección de la landing. Cada tarjeta tendrá:

- Nombre de la sección.
- Miniatura o resumen corto.
- Botón **Editar**.
- Control simple de arrastre para cambiar el orden.
- Menú `•••` con **Duplicar**, **Ocultar/Mostrar** y **Eliminar**.

Al final habrá **+ Agregar sección**. Al pulsarlo se abre una lista corta de plantillas.

## Plantillas iniciales

Se implementarán solo las plantillas necesarias para cubrir el sitio actual y futuras ampliaciones razonables:

- Hero / Portada
- Métricas
- Tarjetas / Servicios
- Texto + imagen
- Dos rutas / Dos opciones
- Vacantes / Llamado a aplicar
- Galería de imágenes
- Testimonios / Logos
- CTA / Llamado a la acción
- Contacto

Cada plantilla conserva el estilo visual del sitio. El usuario edita contenido, no estructura técnica.

## Edición de una sección

Al abrir una tarjeta, el panel mostrará únicamente los campos correspondientes a esa plantilla.

Ejemplo para Hero:

- Etiqueta superior
- Título
- Descripción
- Texto del botón principal
- Destino del botón principal
- Texto del enlace secundario
- Destino del enlace secundario
- Imagen principal

Los campos de texto tendrán dos pestañas simples: **Español** e **Inglés**. Español será el contenido principal. El campo inglés será editable y, cuando esté vacío, la landing podrá mostrar el texto español como respaldo en lugar de dejar contenido en blanco.

Las imágenes mostrarán una miniatura y acciones claras:

- **Cambiar foto**
- **Agregar foto** cuando la plantilla admita varias
- **Eliminar foto**

No se mostrarán URLs de Supabase al usuario.

## Modelo de contenido

Se separará el contenido editorial de la estructura HTML actual.

### `landing_versions`

Guarda versiones de la landing:

- `id`
- `status`: `draft` o `published`
- `created_at`
- `updated_at`
- `created_by`
- `published_at`

Solo existirá una versión publicada activa. El borrador editable parte de la última versión publicada o del último borrador guardado.

### `landing_sections`

Cada registro representa una sección perteneciente a una versión:

- `id`
- `version_id`
- `type`
- `position`
- `visible`
- `content` (`jsonb`)
- `created_at`
- `updated_at`

`content` contiene los campos específicos de la plantilla, incluyendo las variantes `es` y `en` cuando un campo sea traducible, evitando crear una tabla distinta por cada tipo de sección.

### Imágenes

Las imágenes se guardarán en un bucket de Supabase Storage llamado `landing-media`.

El bucket se usará únicamente para medios de la landing y podrá servir imágenes públicamente para que la web cargue rápido. La seguridad editorial se aplica a las operaciones de subir, reemplazar y eliminar: solo `admin` y `boss` podrán escribir en ese bucket. Los borradores no serán públicos aunque sus archivos de imagen individuales no sean información sensible.

En `content` solo se guardarán referencias a los archivos necesarios. Al reemplazar o eliminar una imagen, el editor actualizará la referencia y realizará una limpieza controlada de archivos que ya no estén referenciados por ninguna versión necesaria.

## Borrador, vista previa y publicación

### Guardar borrador

Guarda todos los cambios sin afectar la web pública.

### Vista previa

Abre la landing usando el borrador actual. La vista previa requiere sesión con rol `admin` o `boss`, debe llevar `noindex` y no debe exponer el contenido del borrador a usuarios anónimos.

### Publicar

La publicación debe ejecutarse como una operación transaccional en Supabase:

- valida que la versión tenga una estructura válida;
- marca la nueva versión como publicada;
- deja de considerar publicada la versión anterior;
- la web pública empieza a leer la nueva versión.

Si la publicación falla, la versión pública anterior permanece intacta.

## Renderizado de la landing

La landing conservará el diseño actual, pero las secciones dejarán de depender de textos e imágenes escritos directamente en `index.html`.

La página cargará únicamente la versión publicada y renderizará cada sección visible según su `type` y `position`.

Para usuarios anónimos, RLS permitirá leer exclusivamente la versión publicada y sus secciones visibles. Los borradores solo serán legibles por `admin` y `boss` autenticados.

Se mantendrá un fallback seguro al contenido inicial durante la migración para evitar una página vacía si Supabase no responde.

## Migración del contenido actual

La primera migración creará una versión publicada a partir del contenido que ya existe hoy en la landing. Así, después del cambio, el sitio debe verse prácticamente igual antes de que Boss/Admin editen nada.

Los textos en Español e Inglés, imágenes y secciones actuales se convertirán en registros de `landing_sections` respetando su orden visual.

## Roles y autorización

Se añade `boss` a los roles válidos.

`admin` y `boss` tendrán exactamente el mismo nivel de acceso para:

- editar el contenido de la landing;
- guardar borradores;
- ver la vista previa;
- publicar;
- administrar imágenes;
- administrar usuarios y el resto de funciones del panel.

Las comprobaciones deben existir tanto en frontend como en Supabase/RLS. No se confiará solo en ocultar botones.

## Simplificación del panel

Se retirarán textos técnicos y advertencias innecesarias visibles al usuario, incluyendo referencias directas a infraestructura como:

- Datos centralizados
- Backend conectado
- Supabase Auth
- RLS
- Base de datos conectada

Los mensajes de error conservarán información útil, pero redactada para un usuario normal.

## Manejo de errores

- Si falla una subida de imagen, no se modifica el contenido guardado.
- Si falla Guardar borrador, se mantiene el borrador anterior.
- Si falla Publicar, la versión publicada anterior sigue activa.
- Si una imagen no carga, la landing usa un fallback visual de la plantilla.
- Los errores del panel indican qué operación falló sin exponer claves, stack traces ni detalles internos.

## Pruebas

La implementación debe cubrir como mínimo:

- `boss` entra a las mismas rutas que `admin`.
- `boss` y `admin` pueden leer/escribir/publicar contenido.
- otros roles no pueden modificar ni publicar contenido mediante RLS.
- usuarios anónimos pueden leer la versión publicada, pero no borradores.
- Guardar borrador no altera la versión pública.
- Vista previa usa el borrador.
- Publicar cambia la versión pública solo después de una operación exitosa.
- Reordenar secciones conserva posiciones válidas.
- Ocultar una sección evita que se renderice públicamente.
- Subir/reemplazar/eliminar imágenes actualiza correctamente las referencias.
- el selector Español/Inglés conserva el contenido bilingüe y aplica fallback a Español cuando corresponda.
- El contenido migrado reproduce la estructura actual de la landing.
- El panel ya no muestra las advertencias técnicas indicadas.

## Criterios de aceptación

La tarea se considera terminada cuando:

1. Boss y Admin tienen los mismos permisos.
2. El dueño puede cambiar el contenido de la landing sin tocar código.
3. Puede subir, reemplazar, agregar y eliminar imágenes desde móvil o computadora.
4. Puede agregar secciones desde plantillas y reordenarlas.
5. Puede ocultar, duplicar y eliminar secciones.
6. Puede guardar cambios como borrador, verlos en vista previa y publicarlos después.
7. La landing pública no cambia hasta pulsar Publicar.
8. Si una publicación falla, la web pública anterior continúa funcionando.
9. Las advertencias técnicas del panel dejan de mostrarse.
10. El diseño visual actual se conserva como base.
11. El cambio de idioma Español/Inglés continúa funcionando después de la migración al editor.
