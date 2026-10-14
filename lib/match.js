// El corazón del radar: junta vacantes de hoy, Claude las compara con tu CV y devuelve las mejores.
import Anthropic from '@anthropic-ai/sdk';
import { PERFIL, PUESTOS, CLAVES_FUERTES, CLAVES_EXTRA } from './perfil.js';
import { resolverUbicacion, fechaEn, puedeTomarla } from './ubicaciones.js';
import { buscarEnBolsas } from './fuentes.js';
import { leerHistorial } from './almacen.js';

const MODELO = 'claude-opus-5-5';
// Si Claude rechaza un pedido por precaución, la API lo reintenta sola con otro modelo.
const BETAS = ['server-side-fallback-2026-07-01'];

const hayClaude = () => Boolean(process.env.ANTHROPIC_API_KEY);

function textoDe(respuesta) {
  return respuesta.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

// 1) Claude busca en internet vacantes publicadas hoy en la ubicación elegida.
async function buscarEnInternet(client, { ubicacion, hoy, modalidades }) {
  const pedido = `Hoy es ${hoy} (zona horaria ${ubicacion.zona}). Buscá en internet ofertas de trabajo PUBLICADAS HOY (${hoy}) para este perfil:

Puestos: ${PUESTOS.join(', ')}.
Ubicación: ${ubicacion.busqueda}. Modalidades aceptadas: ${modalidades.join(', ')}.
Idiomas: ofertas en español o en inglés.

Buscá en LinkedIn Jobs, Computrabajo, Bumeran, ZonaJobs, Indeed, Glassdoor, InfoJobs, Get on Board, Workana y páginas
de empleo de empresas. Probá varias búsquedas (por ejemplo "product manager ${ubicacion.busqueda}", "product owner",
"ux lead", "project manager", "head of product").

Regla estricta: incluí una oferta SOLO si en la página se ve que fue publicada hoy (${hoy}), por ejemplo "hace 3 horas",
"publicado hoy", "today", "1 hour ago" o la fecha ${hoy}. Si dice "ayer", "hace 1 día" o una fecha anterior, o si no podés
confirmar la fecha, NO la incluyas. Preferí el link directo a la oferta, no a un listado.

Al final respondé SOLO con un bloque <vacantes>[...]</vacantes> que contenga un array JSON. Cada elemento:
{"titulo": "", "empresa": "", "ubicacion": "", "url": "", "evidenciaFecha": "texto exacto que muestra que es de hoy", "resumen": "2-4 frases con requisitos y tareas"}
Si no encontrás ninguna de hoy, devolvé <vacantes>[]</vacantes>.`;

  const mensajes = [{ role: 'user', content: pedido }];
  let respuesta;
  // La búsqueda puede pausarse a mitad de camino (pause_turn): la retomamos hasta 4 veces.
  for (let vuelta = 0; vuelta < 4; vuelta++) {
    respuesta = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 16000,
      betas: BETAS,
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 10 }],
      messages: mensajes,
    });
    if (respuesta.stop_reason !== 'pause_turn') break;
    mensajes.push({ role: 'assistant', content: respuesta.content });
  }
  if (respuesta.stop_reason === 'refusal') return [];

  const m = textoDe(respuesta).match(/<vacantes>([\s\S]*?)<\/vacantes>/);
  if (!m) return [];
  try {
    const lista = JSON.parse(m[1]);
    return lista
      .filter((v) => v && v.url && v.titulo)
      .map((v) => ({
        titulo: v.titulo,
        empresa: v.empresa || 'Sin nombre',
        ubicacion: v.ubicacion || ubicacion.nombre,
        url: v.url,
        fuente: fuenteDeUrl(v.url),
        publicada: hoy,
        evidenciaFecha: v.evidenciaFecha || '',
        resumen: (v.resumen || '').slice(0, 1200),
        salario: null,
      }));
  } catch {
    return [];
  }
}

function fuenteDeUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const conocidas = { 'linkedin.com': 'LinkedIn', 'computrabajo.com': 'Computrabajo', 'bumeran.com.ar': 'Bumeran', 'zonajobs.com.ar': 'ZonaJobs', 'indeed.com': 'Indeed', 'glassdoor.com': 'Glassdoor', 'infojobs.net': 'InfoJobs', 'getonbrd.com': 'Get on Board' };
    const clave = Object.keys(conocidas).find((k) => host.endsWith(k) || host.includes(k.split('.')[0]));
    return clave ? conocidas[clave] : host;
  } catch {
    return 'Web';
  }
}

const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['evaluaciones'],
  properties: {
    evaluaciones: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'puntaje', 'puedePostular', 'porQue', 'comoDestacar', 'idioma'],
        properties: {
          id: { type: 'integer' },
          puntaje: { type: 'integer', description: '0 a 100: qué tan bien encaja con el perfil' },
          puedePostular: { type: 'boolean', description: 'false si la ubicación, el idioma exigido o el seniority lo impiden' },
          porQue: { type: 'string', description: 'Una o dos frases cálidas y concretas: por qué encaja (o por qué no)' },
          comoDestacar: { type: 'string', description: 'Un consejo corto: qué experiencia o proyecto del CV mencionar al postular' },
          idioma: { type: 'string', enum: ['es', 'en'] },
        },
      },
    },
  },
};

// 2) Claude lee cada vacante y la compara con tu CV.
async function evaluarConClaude(client, vacantes, ubicacion, modalidades) {
  const lista = vacantes.map((v, i) => `#${i}\nPuesto: ${v.titulo}\nEmpresa: ${v.empresa}\nUbicación: ${v.ubicacion}\nFuente: ${v.fuente}\nDetalle: ${v.resumen}`).join('\n\n');
  const respuesta = await client.beta.messages.create({
    model: MODELO,
    max_tokens: 16000,
    betas: BETAS,
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMA } },
    system: `Sos una headhunter que trabaja para la candidata (no para la empresa). Tu trabajo es decirle con honestidad qué vacantes valen su tiempo.
Perfil de la candidata:
${PERFIL}

Ella busca trabajo en: ${ubicacion.busqueda}. Modalidades que acepta: ${modalidades.join(', ')}.
Su inglés es básico: una vacante en inglés puede encajar, pero si exige inglés fluido/avanzado, bajá el puntaje y decilo en "porQue".
Si la vacante es presencial fuera de su zona, o remota solo para países donde ella no puede trabajar, marcá puedePostular=false.
Puntaje: 85+ encaja muy bien; 70-84 buena; 55-69 posible con reparos; menos de 55 no vale la pena.
Escribí en español rioplatense, cercano y sin jerga corporativa.`,
    messages: [{ role: 'user', content: `Evaluá estas ${vacantes.length} vacantes (devolvé una evaluación por cada id):\n\n${lista}` }],
  });
  if (respuesta.stop_reason === 'refusal') return null;
  try {
    return JSON.parse(textoDe(respuesta)).evaluaciones;
  } catch {
    return null;
  }
}

// Plan B sin Claude: puntaje por palabras clave.
function evaluarPorPalabras(vacantes) {
  return vacantes.map((v, i) => {
    const t = ` ${v.titulo} ${v.resumen} `.toLowerCase();
    const fuertes = CLAVES_FUERTES.filter((c) => ` ${v.titulo.toLowerCase()} `.includes(c)).length;
    const extra = CLAVES_EXTRA.filter((c) => t.includes(c));
    const ingles = /\b(fluent|advanced) english\b|inglés (avanzado|fluido)/i.test(t);
    const puntaje = Math.min(95, 45 + fuertes * 15 + extra.length * 5 - (ingles ? 15 : 0));
    return {
      id: i,
      puntaje,
      puedePostular: true,
      porQue: extra.length ? `Coincide en: ${extra.slice(0, 5).map((s) => s.trim()).join(', ')}.` : 'El puesto coincide con los roles que buscás.',
      comoDestacar: 'Revisala vos: este puntaje es por palabras clave (falta conectar Claude).',
      idioma: /[áéíóñ]| de | para /i.test(t) ? 'es' : 'en',
    };
  });
}

function normalizar(url) {
  return url.split('?')[0].replace(/\/$/, '').toLowerCase();
}

// Búsqueda completa. Devuelve las vacantes elegidas + un pequeño informe de lo que pasó.
export async function buscarProyectos(ajustes, { excluirVistas = true } = {}) {
  const ubicacion = resolverUbicacion(ajustes);
  const hoy = fechaEn(ubicacion.zona);
  const modalidades = ajustes.modalidades?.length ? ajustes.modalidades : ['remoto'];
  const incluirRemotas = modalidades.includes('remoto');
  const informe = { hoy, ubicacion: ubicacion.nombre, conClaude: hayClaude(), avisos: [], revisadas: 0 };

  const client = hayClaude() ? new Anthropic() : null;
  const [bolsas, web] = await Promise.all([
    buscarEnBolsas({ hoy, zona: ubicacion.zona, incluirRemotas }),
    client ? buscarEnInternet(client, { ubicacion, hoy, modalidades }).catch((e) => { informe.avisos.push(`La búsqueda web falló: ${e.message}`); return []; }) : [],
  ]);
  informe.avisos.push(...bolsas.avisos);
  if (!client) informe.avisos.push('Sin ANTHROPIC_API_KEY: solo bolsas de empleo y puntaje por palabras clave.');

  // Sacamos duplicados y lo que ya viste otros días.
  const vistas = excluirVistas ? new Set((await leerHistorial()).map((v) => normalizar(v.url))) : new Set();
  const unicas = new Map();
  for (const v of [...web, ...bolsas.vacantes]) {
    const clave = normalizar(v.url);
    const claveTitulo = `${v.titulo}|${v.empresa}`.toLowerCase();
    if (!puedeTomarla(v, ubicacion)) continue;
    if (vistas.has(clave) || unicas.has(clave) || [...unicas.values()].some((x) => `${x.titulo}|${x.empresa}`.toLowerCase() === claveTitulo)) continue;
    unicas.set(clave, v);
  }
  const candidatas = [...unicas.values()].slice(0, 40);
  informe.revisadas = candidatas.length;
  informe.encontradasHoy = web.length + bolsas.vacantes.length;
  if (!candidatas.length) return { vacantes: [], informe };

  let evaluaciones = client ? await evaluarConClaude(client, candidatas, ubicacion, modalidades).catch((e) => { informe.avisos.push(`Claude no pudo evaluar: ${e.message}`); return null; }) : null;
  if (!evaluaciones) evaluaciones = evaluarPorPalabras(candidatas);

  const elegidas = evaluaciones
    .filter((e) => candidatas[e.id] && e.puedePostular && e.puntaje >= (ajustes.puntajeMinimo ?? 55))
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, Math.max(ajustes.minimo ?? 3, 6))
    .map((e) => ({ ...candidatas[e.id], puntaje: e.puntaje, porQue: e.porQue, comoDestacar: e.comoDestacar, idioma: e.idioma, encontrada: new Date().toISOString() }));

  return { vacantes: elegidas, informe };
}
