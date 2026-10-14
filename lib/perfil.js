// Tu perfil, sacado del CV (portfolio/cv/cv-es.html).
// Si actualizás el CV, actualizá también este texto: es lo que Claude compara con cada vacante.

export const PERFIL = `
Andrea Pérez — Product Design Lead · CRMs y SaaS · Product Management · UX/UI · Soluciones con IA
Base: La Plata, Buenos Aires, Argentina. Abierta a trabajo remoto y proyectos freelance.
Portfolio: andreaperez.dev

Resumen: 8 años liderando equipos multidisciplinarios de diseño, desarrollo, QA y producto. Combina Product Management,
Project Management y diseño UX/UI para llevar productos digitales y soluciones con IA desde el discovery hasta el
lanzamiento y la medición de impacto. Scrum, Kanban, roadmap de producto, gestión de stakeholders, automatización con
agentes de IA.

Experiencia:
- Directora de Producto y Tecnología, Delsud (may. 2025 – hoy). Equipo de 16 (desarrollo, UX/UI, QA, DevOps).
  Billeteras virtuales nativas de punta a punta hasta Google Play y App Store. Estrategia y roadmap de producto y
  tecnología, KPIs de productividad y calidad, agentes de IA para acelerar entregas.
- Project Manager, LIMBO (ene. 2022 – may. 2025). Equipo de 7. Proyectos end-to-end con Scrum y Design Thinking,
  clientes y stakeholders.
- UX/UI Designer Senior, iMCreate LLC, Nueva York, remoto (2020 – 2022). Proyectos internacionales, diseño centrado en
  el usuario, supervisión de equipos de diseño y desarrollo.
- Diseñadora web y frontend freelance (Albanghu, 2024).

Proyectos: Filo (SaaS de turnos para peluquerías), Ahorrandy (app de finanzas personales en producción), CRM para
brokers de seguros, gestión de tareas en cascada, red social industrial B2B, auditorías UX con heurísticas de Nielsen.

Competencias: Product Management, estrategia y roadmap, liderazgo de equipos, Project Management, Product Discovery,
Scrum, Kanban, Design Thinking, Lean UX, stakeholders, KPIs, UX/UI, UX Research, prototipado, Design Systems,
IA generativa, automatización con IA, frontend React, transformación digital.
Herramientas: Figma (avanzado), Adobe XD, Illustrator, Jira, Trello, Notion, Claude Code (avanzado), Vercel (avanzado),
GitHub, Supabase, React, Bootstrap.
Formación: Lic. en Diseño en Comunicación Visual (UNLP, en curso). Cursos Platzi de liderazgo, tecnología para
gerentes y UX/UI.
Idiomas: español nativo, inglés básico.
`.trim();

// Puestos que buscamos y palabras para las bolsas de empleo.
export const PUESTOS = [
  'Product Design Lead', 'UX Lead', 'Head of Design',
  'Product Manager', 'Product Owner',
  'Project Manager', 'Scrum Master',
  'Head of Product', 'Director de Producto',
];

export const BUSQUEDAS = [
  'product manager', 'product owner', 'product designer', 'design lead',
  'ux', 'project manager', 'scrum master', 'head of product',
];

// Palabras para el filtro rápido (y para el plan B sin Claude).
export const CLAVES_FUERTES = [
  'product manager', 'product owner', 'product design', 'design lead', 'ux lead', 'ux/ui', 'ui/ux', 'ux ',
  'head of product', 'head of design', 'director de producto', 'directora de producto', 'product lead',
  'project manager', 'scrum master', 'gerente de producto', 'líder de producto', 'lider de producto',
  'diseñador ux', 'diseñadora ux', 'product director', 'vp of product', 'program manager', 'delivery manager',
];

export const CLAVES_EXTRA = [
  'saas', 'crm', 'fintech', 'billetera', 'wallet', 'figma', 'roadmap', 'discovery', 'scrum', 'kanban', 'agile', 'ágil',
  ' ia ', ' ai ', 'inteligencia artificial', 'design system', 'stakeholder', 'b2b', 'mobile', 'liderazgo', 'leadership', 'research',
];
