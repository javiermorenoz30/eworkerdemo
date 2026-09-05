create table if not exists public.landing_versions (
  id uuid primary key default gen_random_uuid(),
  status text not null unique check (status in ('draft', 'published')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.landing_sections (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.landing_versions(id) on delete cascade,
  type text not null check (btrim(type) <> ''),
  position integer not null check (position >= 0),
  visible boolean not null default true,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (version_id, position)
);

create index if not exists landing_sections_version_position_idx
  on public.landing_sections(version_id, position);

drop trigger if exists landing_versions_set_updated_at on public.landing_versions;
create trigger landing_versions_set_updated_at
before update on public.landing_versions
for each row execute function public.set_updated_at();

drop trigger if exists landing_sections_set_updated_at on public.landing_sections;
create trigger landing_sections_set_updated_at
before update on public.landing_sections
for each row execute function public.set_updated_at();

alter table public.landing_versions enable row level security;
alter table public.landing_sections enable row level security;

revoke all on public.landing_versions from anon, authenticated;
revoke all on public.landing_sections from anon, authenticated;
grant select on public.landing_versions, public.landing_sections to anon, authenticated;
grant insert, update, delete on public.landing_versions, public.landing_sections to authenticated;

drop policy if exists landing_versions_public_select on public.landing_versions;
create policy landing_versions_public_select
on public.landing_versions for select
to anon, authenticated
using (status = 'published');

drop policy if exists landing_versions_manager_all on public.landing_versions;
create policy landing_versions_manager_all
on public.landing_versions for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists landing_sections_public_select on public.landing_sections;
create policy landing_sections_public_select
on public.landing_sections for select
to anon, authenticated
using (
  visible = true
  and exists (
    select 1
    from public.landing_versions version
    where version.id = landing_sections.version_id
      and version.status = 'published'
  )
);

drop policy if exists landing_sections_manager_all on public.landing_sections;
create policy landing_sections_manager_all
on public.landing_sections for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.save_landing_draft(sections_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  draft_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Manager access required';
  end if;

  if jsonb_typeof(sections_payload) <> 'array' then
    raise exception 'Landing sections must be an array';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(sections_payload) item
    where btrim(coalesce(item->>'type', '')) = ''
  ) then
    raise exception 'Every landing section requires a type';
  end if;

  select id into draft_id
  from public.landing_versions
  where status = 'draft'
  for update;

  if draft_id is null then
    raise exception 'Draft landing version is missing';
  end if;

  delete from public.landing_sections where version_id = draft_id;

  insert into public.landing_sections (version_id, type, position, visible, content)
  select
    draft_id,
    btrim(item->>'type'),
    ordinality - 1,
    coalesce((item->>'visible')::boolean, true),
    coalesce(item->'content', '{}'::jsonb)
  from jsonb_array_elements(sections_payload) with ordinality as payload(item, ordinality);

  update public.landing_versions
  set created_by = auth.uid(), updated_at = now()
  where id = draft_id;

  return draft_id;
end;
$$;

create or replace function public.publish_landing()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  draft_id uuid;
  published_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Manager access required';
  end if;

  select id into draft_id
  from public.landing_versions
  where status = 'draft'
  for update;

  select id into published_id
  from public.landing_versions
  where status = 'published'
  for update;

  if draft_id is null or published_id is null then
    raise exception 'Landing versions are not initialized';
  end if;

  if not exists (
    select 1 from public.landing_sections
    where version_id = draft_id and visible = true
  ) then
    raise exception 'At least one visible landing section is required';
  end if;

  delete from public.landing_sections where version_id = published_id;

  insert into public.landing_sections (version_id, type, position, visible, content)
  select published_id, type, position, visible, content
  from public.landing_sections
  where version_id = draft_id
  order by position;

  update public.landing_versions
  set created_by = auth.uid(), published_at = now(), updated_at = now()
  where id = published_id;

  return published_id;
end;
$$;

create or replace function public.landing_media_is_referenced(media_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() and exists (
    select 1
    from public.landing_sections
    where jsonb_path_exists(
      content,
      '$.** ? (@ == $media)'::jsonpath,
      jsonb_build_object('media', to_jsonb(media_path))
    )
  );
$$;

revoke all on function public.save_landing_draft(jsonb) from public;
revoke all on function public.publish_landing() from public;
revoke all on function public.landing_media_is_referenced(text) from public;
grant execute on function public.save_landing_draft(jsonb) to authenticated;
grant execute on function public.publish_landing() to authenticated;
grant execute on function public.landing_media_is_referenced(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'landing-media',
  'landing-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists landing_media_manager_insert on storage.objects;
create policy landing_media_manager_insert
on storage.objects for insert
to authenticated
with check (bucket_id = 'landing-media' and public.is_admin());

drop policy if exists landing_media_manager_update on storage.objects;
create policy landing_media_manager_update
on storage.objects for update
to authenticated
using (bucket_id = 'landing-media' and public.is_admin())
with check (bucket_id = 'landing-media' and public.is_admin());

drop policy if exists landing_media_manager_delete on storage.objects;
create policy landing_media_manager_delete
on storage.objects for delete
to authenticated
using (bucket_id = 'landing-media' and public.is_admin());

insert into public.landing_versions (status, published_at)
values ('published', now())
on conflict (status) do nothing;

insert into public.landing_versions (status)
values ('draft')
on conflict (status) do nothing;

do $$
declare
  seed jsonb := $seed$[
    {
      "type":"hero",
      "visible":true,
      "content":{
        "id":"inicio",
        "eyebrow":{"es":"BPO · NEARSHORING · LA VEGA, RD","en":"BPO · NEARSHORING · LA VEGA, DR"},
        "title":{"es":"Conectamos talento dominicano con oportunidades globales.","en":"Connecting Dominican talent with global opportunities."},
        "highlight":{"es":"talento dominicano","en":"Dominican talent"},
        "description":{"es":"Operaciones de customer experience, televentas y soporte diseñadas para crecer con precisión, humanidad y velocidad.","en":"Customer experience, telesales and support operations designed to grow with precision, humanity and speed."},
        "primaryButton":{"label":{"es":"Escalar mi operación","en":"Scale my operation"},"href":"#empresas"},
        "secondaryButton":{"label":{"es":"Encuentra tu próxima oportunidad","en":"Find your next opportunity"},"href":"#vacantes"},
        "image":{"path":"assets/hero-professional.webp","fallback":"assets/hero-professional.png","alt":{"es":"Profesional dominicana conectada a una red global de oportunidades","en":"Dominican professional connected to a global opportunity network"}},
        "location":"LA VEGA",
        "locationSuffix":"↗ GLOBAL",
        "scrollHint":{"es":"EXPLORA LA EXPERIENCIA","en":"EXPLORE THE EXPERIENCE"}
      }
    },
    {
      "type":"metrics",
      "visible":true,
      "content":{"items":[
        {"value":"2018","label":{"es":"Operando desde La Vega","en":"Operating from La Vega"}},
        {"value":"100+","label":{"es":"Empleos directos en 2023","en":"Direct jobs in 2023"}},
        {"value":"25%","label":{"es":"Hito publicado de producción, 2023","en":"Published production milestone, 2023"}},
        {"value":"—","label":{"es":"Satisfacción · Por confirmar","en":"Satisfaction · To be confirmed"},"variant":"pending"}
      ]}
    },
    {
      "type":"routes",
      "visible":true,
      "content":{
        "eyebrow":{"es":"DOS RUTAS, UNA MISMA VISIÓN","en":"TWO PATHS, ONE VISION"},
        "title":{"es":"Tu siguiente paso empieza aquí.","en":"Your next step starts here."},
        "highlight":{"es":"aquí.","en":"here."},
        "items":[
          {"number":"01","variant":"business","title":{"es":"Soy una empresa","en":"I represent a business"},"description":{"es":"Conecta una operación ágil, capacitada y alineada a tu negocio.","en":"Connect an agile, trained operation aligned to your business."},"link":{"label":{"es":"Explorar soluciones →","en":"Explore solutions →"},"href":"#empresas"}},
          {"number":"02","variant":"talent","title":{"es":"Busco empleo","en":"I'm looking for a job"},"description":{"es":"Haz crecer tu carrera en un equipo local de mirada global.","en":"Grow your career on a locally rooted, globally minded team."},"link":{"label":{"es":"Ver vacantes →","en":"View jobs →"},"href":"#vacantes"}}
        ]
      }
    },
    {
      "type":"cards",
      "visible":true,
      "content":{
        "variant":"services","id":"servicios",
        "eyebrow":{"es":"CAPACIDADES","en":"CAPABILITIES"},
        "title":{"es":"Servicios que hacen que cada interacción cuente.","en":"Services that make every interaction count."},
        "highlight":{"es":"cada interacción cuente.","en":"every interaction count."},
        "description":{"es":"Soluciones diseñadas desde la experiencia real del equipo eWorker360.","en":"Solutions designed from the real eWorker360 team experience."},
        "items":[
          {"number":"01","title":{"es":"Atención al Cliente","en":"Customer Service"},"description":{"es":"Soporte cálido y profesional por teléfono y canales digitales.","en":"Warm, professional support by phone and digital channels."}},
          {"number":"02","title":{"es":"Televentas","en":"Telesales"},"description":{"es":"Campañas telefónicas efectivas con personal entrenado y persuasivo.","en":"Effective phone campaigns with trained, persuasive staff."}},
          {"number":"03","title":{"es":"Nearshoring","en":"Nearshoring"},"description":{"es":"Externaliza procesos a República Dominicana sin perder cercanía ni calidad.","en":"Outsource to the Dominican Republic without losing proximity or quality."}},
          {"number":"04","title":{"es":"Promoción de Servicios","en":"Service Promotion"},"description":{"es":"Promotores capacitados que conectan servicios con personas.","en":"Trained promoters connecting services with people."}},
          {"number":"05","title":{"es":"Campañas Telefónicas","en":"Telephone Campaigns"},"description":{"es":"Flujos entrantes o salientes, personalizados para cada operación.","en":"Inbound or outbound flows, tailored for each operation."}},
          {"number":"06","variant":"accent","title":{"es":"A tu medida","en":"Built for you"},"description":{"es":"Encuestas, soporte técnico, logística, mensajería y más.","en":"Surveys, technical support, logistics, messenger services and more."}}
        ],
        "details":[
          {"title":{"es":"ATENCIÓN AL CLIENTE","en":"CUSTOMER SERVICE"},"description":{"es":"Soporte multicanal con empatía, rapidez y profesionalismo para mejorar la experiencia, fidelidad y percepción de marca.","en":"Multichannel support with empathy, speed and professionalism to improve customer experience, loyalty and brand perception."}},
          {"title":{"es":"TELEVENTAS","en":"TELESALES"},"description":{"es":"Campañas personalizadas que convierten llamadas en ventas mediante comunicación persuasiva y análisis constante de resultados.","en":"Tailored campaigns that convert calls into sales through persuasive communication and continuous results analysis."}},
          {"title":{"es":"NEARSHORING","en":"NEARSHORING"},"description":{"es":"Una extensión eficiente de tu equipo desde República Dominicana para reducir costos y mantener la calidad.","en":"An efficient extension of your team from the Dominican Republic to reduce costs while maintaining quality."}},
          {"title":{"es":"PROMOCIÓN Y CAMPAÑAS","en":"PROMOTION & CAMPAIGNS"},"description":{"es":"Acciones de campo, llamadas entrantes o salientes, soporte y recopilación de datos orientadas a objetivos de negocio.","en":"Field activations, inbound or outbound calls, support and data collection aligned to business goals."}}
        ]
      }
    },
    {
      "type":"text_image",
      "visible":true,
      "content":{
        "variant":"business","id":"empresas",
        "eyebrow":{"es":"SOLUCIONES PARA EMPRESAS","en":"SOLUTIONS FOR BUSINESS"},
        "title":{"es":"La escala que necesitas. La cercanía que importa.","en":"The scale you need. The proximity that matters."},
        "highlight":{"es":"La cercanía que importa.","en":"The proximity that matters."},
        "description":{"es":"Brindamos soluciones efectivas en atención al cliente, televentas, promoción de productos y externalización de procesos empresariales. Cada proyecto se adapta a las necesidades específicas de cada cliente.","en":"We provide effective customer service, telesales, product-promotion and business-process outsourcing solutions. Each project is adapted to the client's specific needs."},
        "bullets":[{"es":"Cobertura adaptable a tu operación","en":"Coverage adaptable to your operation"},{"es":"Equipos para ventas, soporte y campañas","en":"Teams for sales, support and campaigns"},{"es":"Modelo de mejora continua","en":"Continuous-improvement model"}],
        "methodTitle":{"es":"NUESTRO MÉTODO","en":"OUR METHOD"},
        "steps":[{"es":"Descubrimos","en":"Discover"},{"es":"Diseñamos","en":"Design"},{"es":"Entrenamos","en":"Train"},{"es":"Operamos","en":"Operate"},{"es":"Optimizamos","en":"Optimize"}],
        "button":{"label":{"es":"Hablemos de tu operación","en":"Let's discuss your operation"},"href":"#contacto"}
      }
    },
    {
      "type":"text_image",
      "visible":true,
      "content":{
        "variant":"culture","id":"nosotros",
        "image":{"path":"https://eworker360dominicana.com/wp-content/uploads/2025/05/Equipo-eWorker-C.jpg","alt":{"es":"Equipo de eWorker360 Dominicana","en":"eWorker360 Dominicana team"}},
        "imageCaption":"eWorker360 / La Vega",
        "eyebrow":{"es":"TALENTO Y CULTURA","en":"TALENT & CULTURE"},
        "title":{"es":"Personas que hacen posible el futuro.","en":"People who make the future possible."},
        "highlight":{"es":"posible el futuro.","en":"the future possible."},
        "description":{"es":"Nuestra misión es ofrecer telemercadeo excepcional, eficiente y personalizado, con profesionalismo, empatía y entendimiento profundo de cada objetivo.","en":"Our mission is to deliver exceptional, efficient and tailored telemarketing with professionalism, empathy and a deep understanding of every goal."},
        "vision":{"label":{"es":"Visión.","en":"Vision."},"text":{"es":"Ser el socio estratégico líder en telemercadeo, reconocido por experiencias sobresalientes, innovación tecnológica y eficiencia operativa.","en":"To be the leading strategic telemarketing partner, recognized for outstanding experiences, technological innovation and operational efficiency."}},
        "values":["Compromiso","Empatía","Excelencia","Innovación","Trabajo en equipo","Integridad","Adaptabilidad"]
      }
    },
    {
      "type":"cards",
      "visible":true,
      "content":{
        "variant":"objectives","id":"objetivos",
        "eyebrow":{"es":"OBJETIVOS","en":"OBJECTIVES"},
        "title":{"es":"Guiados por un propósito, comprometidos con los resultados.","en":"Guided by purpose, committed to results."},
        "highlight":{"es":"comprometidos con los resultados.","en":"committed to results."},
        "items":[
          {"icon":"★","title":{"es":"Excelencia en la satisfacción del cliente","en":"Excellence in customer satisfaction"},"description":{"es":"Superar continuamente las expectativas de los clientes a través de un servicio de alta calidad, eficiente y empático en todos los puntos de contacto.","en":"Continuously exceed client expectations through high-quality, efficient and empathetic service at every touchpoint."}},
          {"icon":"↗","title":{"es":"Mejora continua","en":"Continuous improvement"},"description":{"es":"Evaluar y optimizar constantemente nuestros procesos, tecnologías y capacitación, para asegurar que cumplimos con las necesidades cambiantes de nuestros clientes.","en":"Continuously evaluate and optimize our processes, technology and training to meet our clients' changing needs."}},
          {"icon":"◔","title":{"es":"Eficiencia operativa","en":"Operational efficiency"},"description":{"es":"Optimizar las operaciones del call center, reduciendo tiempos de espera, aumentando la tasa de resolución de problemas y garantizando productividad y precisión sobresalientes.","en":"Optimize call-center operations by reducing wait times, increasing issue-resolution rates, and ensuring outstanding productivity and accuracy."}},
          {"icon":"♙","title":{"es":"Desarrollo del personal","en":"Staff development"},"description":{"es":"Invertir en la capacitación continua del equipo, asegurando los conocimientos y habilidades necesarias para brindar el mejor servicio posible.","en":"Invest in the team's continuous training, ensuring the knowledge and skills needed to provide the best possible service."}},
          {"icon":"◫","title":{"es":"Escalabilidad y flexibilidad","en":"Scalability and flexibility"},"description":{"es":"Ampliar y adaptar nuestros servicios para satisfacer las crecientes demandas de los clientes, garantizando soporte continuo y eficaz en todo momento.","en":"Expand and adapt our services to meet growing client demand, ensuring continuous and effective support at all times."}}
        ]
      }
    },
    {
      "type":"jobs",
      "visible":true,
      "content":{
        "id":"vacantes",
        "eyebrow":{"es":"VACANTES","en":"JOBS"},
        "title":{"es":"Tu carrera puede comenzar hoy.","en":"Your career can start today."},
        "highlight":{"es":"comenzar hoy.","en":"start today."},
        "description":{"es":"En eWorker360 ofrecemos más que un empleo: capacitación continua, crecimiento profesional y un excelente ambiente laboral.","en":"At eWorker360 we offer more than a job: ongoing training, professional growth and an excellent work environment."},
        "filters":[{"value":"all","label":{"es":"Todas","en":"All"}},{"value":"Ventas","label":{"es":"Ventas","en":"Sales"}},{"value":"Servicio","label":{"es":"Servicio","en":"Service"}},{"value":"Soporte","label":{"es":"Soporte","en":"Support"}}],
        "items":[
          {"area":"Ventas","badge":{"es":"Ventas · Ejemplo","en":"Sales · Example"},"title":{"es":"Agente de Televentas","en":"Telesales Agent"},"description":{"es":"La Vega · Presencial · Español / Inglés","en":"La Vega · On-site · Spanish / English"},"href":"application.html"},
          {"area":"Servicio","badge":{"es":"Servicio · Ejemplo","en":"Service · Example"},"title":{"es":"Representante de Atención al Cliente","en":"Customer Service Representative"},"description":{"es":"La Vega · Híbrido · Español","en":"La Vega · Hybrid · Spanish"},"href":"application.html"},
          {"area":"Soporte","badge":{"es":"Soporte · Ejemplo","en":"Support · Example"},"title":{"es":"Especialista de Soporte","en":"Support Specialist"},"description":{"es":"La Vega · Por confirmar · Inglés","en":"La Vega · To be confirmed · English"},"href":"application.html"}
        ],
        "note":{"es":"Para postular, completa el formulario o escríbenos por WhatsApp. Debes ser mayor de edad, comunicarte bien oralmente y por escrito en español e inglés, y tener disposición para aprender.","en":"To apply, complete the form or message us on WhatsApp. You must be of legal age, communicate well orally and in writing in Spanish and English, and be willing to learn."}
      }
    },
    {
      "type":"cta",
      "visible":true,
      "content":{
        "variant":"employment","id":"aplicar",
        "eyebrow":{"es":"TRABAJA CON NOSOTROS","en":"WORK WITH US"},
        "title":{"es":"Formulario de solicitud de empleo.","en":"Employment application form."},
        "highlight":{"es":"empleo.","en":"application form."},
        "description":{"es":"¿Quieres trabajar en el área de venta o servicio al cliente? Completa tu solicitud y el equipo de reclutamiento podrá conocer tu perfil.","en":"Would you like to work in sales or customer service? Complete your application so the recruitment team can learn about your profile."},
        "perks":[{"es":"Capacitación continua","en":"Continuous training"},{"es":"Crecimiento profesional","en":"Professional growth"},{"es":"Ambiente laboral dinámico","en":"Dynamic work environment"}],
        "button":{"label":{"es":"Abrir formulario de solicitud","en":"Open application form"},"href":"application.html"}
      }
    },
    {
      "type":"cards",
      "visible":true,
      "content":{
        "variant":"timeline","id":"recursos",
        "eyebrow":{"es":"UNA HISTORIA QUE SIGUE CRECIENDO","en":"A STORY STILL GROWING"},
        "items":[
          {"value":"2018","title":{"es":"Fundación en La Vega","en":"Founded in La Vega"},"description":{"es":"eWorker360 establece sus operaciones en República Dominicana.","en":"eWorker360 establishes operations in the Dominican Republic."}},
          {"value":"2019","title":{"es":"Alianza internacional","en":"International partnership"},"description":{"es":"Firma un contrato de exclusividad de diez años con un cliente internacional.","en":"Signs a ten-year exclusivity agreement with an international client."}},
          {"value":"2023","title":{"es":"Superación de metas","en":"Goals surpassed"},"description":{"es":"El sitio publicado registra una superación del 25% en metas de producción.","en":"The published site records a 25% production-goal milestone."}},
          {"value":"2025","title":{"es":"NextGen Academy","en":"NextGen Academy"},"description":{"es":"Lanzamiento de la academia de inglés para nuevos talentos.","en":"Launch of the English academy for emerging talent."}}
        ]
      }
    },
    {
      "type":"contact",
      "visible":true,
      "content":{
        "id":"contacto",
        "eyebrow":{"es":"CONVERSEMOS","en":"LET'S TALK"},
        "title":{"es":"Una conversación puede mover tu mundo.","en":"One conversation can move your world."},
        "highlight":{"es":"tu mundo.","en":"your world."},
        "address":{"es":"Calle Hostos, Plaza Quezada #1, La Vega, República Dominicana.","en":"Calle Hostos, Plaza Quezada #1, La Vega, Dominican Republic."},
        "details":[
          {"label":"info@eworker360dominicana.com","href":"mailto:info@eworker360dominicana.com"},
          {"label":"+1 809 824 2463","href":"tel:+18098242463"},
          {"label":"WhatsApp","href":"https://wa.me/18098242463"},
          {"label":"Instagram @eworker_rd","href":"https://www.instagram.com/eworker_rd/"}
        ]
      }
    },
    {
      "type":"faq",
      "visible":true,
      "content":{
        "eyebrow":{"es":"FAQ","en":"FAQ"},
        "title":{"es":"Preguntas frecuentes, respuestas claras.","en":"Frequently asked questions, clear answers."},
        "highlight":{"es":"respuestas claras.","en":"clear answers."},
        "items":[
          {"question":{"es":"¿Dónde están ubicados?","en":"Where are you located?"},"answer":{"es":"Calle Hostos Plaza Quezada #1, La Vega, República Dominicana.","en":"Calle Hostos Plaza Quezada #1, La Vega, Dominican Republic."}},
          {"question":{"es":"¿Qué tipo de empleos ofrecen?","en":"What roles do you offer?"},"answer":{"es":"Ventas, atención al cliente, soporte, mensajería, seguridad y más.","en":"Sales, customer service, support, messenger, security and more."}},
          {"question":{"es":"¿Cómo puedo aplicar a una vacante?","en":"How can I apply for a job?"},"answer":{"es":"Puedes completar el formulario en línea o escribirnos por WhatsApp.","en":"You can complete the online form or message us on WhatsApp."}},
          {"question":{"es":"¿Trabajan solo con empresas dominicanas?","en":"Do you only work with Dominican companies?"},"answer":{"es":"No. Sus clientes principales son internacionales bajo modalidad de nearshoring.","en":"No. Its principal clients are international under a nearshoring model."}},
          {"question":{"es":"¿Qué necesito para trabajar con ustedes?","en":"What do I need to work with you?"},"answer":{"es":"Ser mayor de edad, tener buena comunicación oral y escrita en español e inglés, y disposición para aprender.","en":"Be of legal age, communicate well orally and in writing in Spanish and English, and be willing to learn."}},
          {"question":{"es":"¿Qué servicios ofrecen a empresas?","en":"Which services do you offer companies?"},"answer":{"es":"Atención y servicio al cliente, promoción, soporte técnico y más.","en":"Customer service, promotion, technical support and more."}}
        ]
      }
    },
    {
      "type":"gallery",
      "visible":true,
      "content":{
        "variant":"resources","id":"noticias",
        "eyebrow":{"es":"NOTICIAS","en":"NEWS"},
        "title":{"es":"Lo que los medios dicen de nosotros.","en":"What the media says about us."},
        "highlight":{"es":"dicen de nosotros.","en":"says about us."},
        "description":{"es":"Historias de crecimiento, oportunidades y el talento que mueve a La Vega.","en":"Stories of growth, opportunity and the talent moving La Vega forward."},
        "items":[
          {"image":{"path":"https://eworker360dominicana.com/wp-content/uploads/2025/06/c-Empleadodelano-eworker360.jpg","alt":{"es":"Reconocimiento a colaboradora de eWorker360","en":"eWorker360 employee recognition"}},"meta":"LA VEGA INFORMA · 2022","title":{"es":"Reconocimiento a empleada del año","en":"Employee of the year recognition"},"description":{"es":"eWorker360 celebra su cena navideña y reconoce el desempeño de Milagros Baldera.","en":"eWorker360 celebrates its holiday gathering and recognizes Milagros Baldera's performance."},"link":{"label":{"es":"Leer noticia ↗","en":"Read story ↗"},"href":"https://lavegainforma.com/eworker360-celebra-cena-navidena-milagros-baldera-es-reconocida-como-empleada-del-ano/"}},
          {"image":{"path":"https://eworker360dominicana.com/wp-content/uploads/2025/05/Equipo-eWorker-C.jpg","alt":{"es":"Equipo de eWorker360 Dominicana","en":"eWorker360 Dominicana team"}},"meta":"CRONICARDS · 2023","title":{"es":"«eWorker» crea miles de empleos en La Vega y Jima Abajo","en":"eWorker creates thousands of jobs in La Vega and Jima Abajo"},"description":{"es":"Una mirada al nearshoring y su aporte a nuevas oportunidades de empleo local.","en":"A look at nearshoring and its contribution to new local employment opportunities."},"link":{"label":{"es":"Leer noticia ↗","en":"Read story ↗"},"href":"https://cronicards.com/2023/06/eworker-crea-miles-de-empleos-en-los-municipios-de-la-vega-y-jima-abajo/"}},
          {"image":{"path":"https://eworker360dominicana.com/wp-content/uploads/2025/06/c-Mas-de-eWorker.jpg","alt":{"es":"Agente de eWorker360 durante una llamada","en":"eWorker360 agent during a call"}},"meta":"eWORKER360 · 2023","title":{"es":"eWorker360 supera los 100 empleos generados en La Vega","en":"eWorker360 surpasses 100 jobs generated in La Vega"},"description":{"es":"Un hito que refuerza el impacto de la empresa en la comunidad y el empleo directo.","en":"A milestone reinforcing the company's impact on the community and direct employment."},"link":{"label":{"es":"Ver publicación ↗","en":"View post ↗"},"href":"https://www.instagram.com/eworker_rd?igsh=enp3ZnBsOHc5cHY4&utm_source=qr"}},
          {"image":{"path":"https://eworker360dominicana.com/wp-content/uploads/2025/05/Noticias-eworker360-c.jpg","alt":{"es":"Publicación de El Nacional sobre eWorker360","en":"El Nacional story about eWorker360"}},"meta":"EL NACIONAL · 2023","title":{"es":"Empleos · El Nacional","en":"Jobs · El Nacional"},"description":{"es":"El medio destaca el crecimiento de eWorker360 y el potencial del nearshoring dominicano.","en":"The publication highlights eWorker360's growth and the potential of Dominican nearshoring."},"link":{"label":{"es":"Leer noticia ↗","en":"Read story ↗"},"href":"https://elnacional.com.do/empresario-vegano-crea-cientos-de-empleos-con-el-nearshoring/"}}
        ]
      }
    }
  ]$seed$::jsonb;
  version_record record;
begin
  for version_record in
    select id from public.landing_versions where status in ('published', 'draft') order by status
  loop
    if not exists (
      select 1 from public.landing_sections where version_id = version_record.id
    ) then
      insert into public.landing_sections (version_id, type, position, visible, content)
      select
        version_record.id,
        item->>'type',
        ordinality - 1,
        coalesce((item->>'visible')::boolean, true),
        item->'content'
      from jsonb_array_elements(seed) with ordinality as payload(item, ordinality);
    end if;
  end loop;
end;
$$;
