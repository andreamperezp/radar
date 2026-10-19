// Bolsas de empleo con API pública y fecha de publicación exacta.
// Solo devolvemos lo publicado HOY (según la zona horaria elegida).
import { fechaEn } from './ubicaciones.js';

const AGENTE = { 'User-Agent': 'Mozilla/5.0 (radar de vacantes personal)' };

function limpiarHtml(html = '') {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

// ¿El título se parece a lo que busca esta persona?
function parecido(titulo = '', claves = []) {
  const t = ` ${titulo.toLowerCase()} `;
  return claves.some((c) => t.includes(c));
}

// Si una consulta falla por la red, se reintenta una vez. Si el portal bloquea o pide esperar (401, 403, 404, 429), no se insiste.
async function conReintento(fn) {
  try {
    return await fn();
  } catch (e) {
    if (/\b(401|403|404|429)\b/.test(e.message)) throw e;
    await new Promise((ok) => setTimeout(ok, 900));
    return fn();
  }
}

function traerJson(url) {
  return conReintento(async () => {
    const r = await fetch(url, { headers: AGENTE, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`${r.status} en ${new URL(url).host}`);
    return r.json();
  });
}

async function getOnBoard(hoy, zona, { busquedas, claves }) {
  const vacantes = [];
  for (const q of busquedas) {
    const url = `https://www.getonbrd.com/api/v0/search/jobs?query=${encodeURIComponent(q)}&per_page=30&expand=${encodeURIComponent('["company"]')}`;
    const j = await traerJson(url);
    for (const d of j.data || []) {
      const a = d.attributes;
      const publicada = new Date(a.published_at * 1000);
      if (fechaEn(zona, publicada) !== hoy || !parecido(a.title, claves)) continue;
      vacantes.push({
        titulo: a.title,
        empresa: a.company?.data?.attributes?.name || 'Empresa en Get on Board',
        ubicacion: a.remote ? `Remoto (${(a.countries || []).join(', ') || 'sin restricción'})` : (a.countries || []).join(', '),
        remota: Boolean(a.remote),
        paises: (a.countries || []).filter((c) => c !== 'Remote'),
        url: d.links.public_url,
        fuente: 'Get on Board',
        publicada: publicada.toISOString(),
        resumen: limpiarHtml(`${a.description || ''} ${a.functions || ''}`).slice(0, 1200),
        salario: a.min_salary ? `USD ${a.min_salary}–${a.max_salary}` : null,
      });
    }
  }
  return vacantes;
}

async function himalayas(hoy, zona, { busquedas, claves }) {
  const vacantes = [];
  for (const q of busquedas) {
    const j = await traerJson(`https://himalayas.app/jobs/api/search?q=${encodeURIComponent(q)}&sort=recent`);
    for (const a of j.jobs || []) {
      const publicada = new Date(a.pubDate * 1000);
      if (fechaEn(zona, publicada) !== hoy || !parecido(a.title, claves)) continue;
      const restr = a.locationRestrictions || [];
      vacantes.push({
        titulo: a.title,
        empresa: a.companyName,
        ubicacion: restr.length ? `Remoto (solo ${restr.join(', ')})` : 'Remoto (cualquier país)',
        remota: true,
        paises: restr,
        url: a.applicationLink || a.guid,
        fuente: 'Himalayas',
        publicada: publicada.toISOString(),
        resumen: limpiarHtml(a.excerpt || a.description || '').slice(0, 1200),
        salario: a.minSalary ? `${a.currency || 'USD'} ${a.minSalary}–${a.maxSalary}` : null,
      });
    }
  }
  return vacantes;
}

async function remoteOk(hoy, zona, { claves }) {
  const j = await traerJson('https://remoteok.com/api');
  return j.slice(1)
    .filter((a) => fechaEn(zona, new Date(a.epoch * 1000)) === hoy && parecido(a.position, claves))
    .map((a) => ({
      titulo: a.position,
      empresa: a.company,
      ubicacion: `Remoto (${a.location || 'sin restricción'})`,
      remota: true,
      paises: a.location ? [a.location] : [],
      url: a.url,
      fuente: 'Remote OK',
      publicada: new Date(a.epoch * 1000).toISOString(),
      resumen: limpiarHtml(a.description).slice(0, 1200),
      salario: a.salary_min ? `USD ${a.salary_min}–${a.salary_max}` : null,
    }));
}

// ── Ayudas para RSS y para "hace X horas" ────────────────────────────────────
function traerTexto(url) {
  return conReintento(async () => {
    const r = await fetch(url, { headers: { ...AGENTE, 'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8' }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`${r.status} en ${new URL(url).host}`);
    return r.text();
  });
}
const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));
const entidades = (s = '') => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const campo = (item, tag) => entidades((item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) || [])[1] || '').trim();
const items = (xml) => xml.match(/<item>[\s\S]*?<\/item>/g) || [];

// "3 hours ago", "hace 20 minutos", "Ayer" → instante aproximado (null si es de otro día o no se entiende)
function haceTanto(texto = '') {
  const t = texto.toLowerCase();
  if (/ayer|yesterday|day|día|dia|week|semana|month|mes/.test(t) && !/hoy|today/.test(t)) return null;
  const n = Number((t.match(/(\d+)/) || [])[1] || 0);
  if (/minut|min\b/.test(t)) return new Date(Date.now() - n * 60000);
  if (/hora|hour/.test(t)) return new Date(Date.now() - n * 3600000);
  if (/segund|second|ahora|just now|hoy|today/.test(t)) return new Date();
  return null;
}
const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// ── LinkedIn: listado público de las últimas 24 h, con tu lugar y tu modalidad ──
async function linkedin(hoy, zona, { busquedas, claves }, { ubicacion, modalidades }) {
  const tipos = [modalidades.includes('presencial') && 1, modalidades.includes('remoto') && 2, modalidades.includes('hibrido') && 3].filter(Boolean).join('%2C');
  const vacantes = [];
  // Pocas consultas y espaciadas: LinkedIn corta (429) si se le pregunta muy seguido.
  for (const [i, q] of busquedas.slice(0, 3).entries()) {
    if (i) await pausa(700);
    const html = await traerTexto(`https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(q)}&location=${encodeURIComponent(ubicacion.linkedin || 'Worldwide')}&f_TPR=r86400${tipos ? `&f_WT=${tipos}` : ''}`);
    for (const card of html.split('<li>').slice(1)) {
      const g = (re) => entidades((card.match(re) || [])[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const url = g(/href="(https:\/\/[a-z]+\.linkedin\.com\/jobs\/view\/[^"?]+)/);
      const publicada = haceTanto(g(/<time[^>]*>([\s\S]*?)<\/time>/));
      const titulo = g(/base-search-card__title[^>]*>([\s\S]*?)<\/h3>/);
      // El buscador de LinkedIn es amplio: además, el título tiene que parecerse a lo que buscás.
      if (!url || !publicada || fechaEn(zona, publicada) !== hoy || !parecido(titulo, claves)) continue;
      vacantes.push({
        titulo,
        empresa: g(/base-search-card__subtitle[^>]*>([\s\S]*?)<\/h4>/),
        ubicacion: g(/job-search-card__location[^>]*>([\s\S]*?)<\/span>/),
        remota: true, paises: [], // LinkedIn ya filtró por tu lugar y tu modalidad
        url, fuente: 'LinkedIn', publicada: publicada.toISOString(), resumen: '', salario: null,
      });
    }
  }
  return vacantes;
}

// ── Computrabajo: lo publicado hoy en tu país ──
async function computrabajo(hoy, zona, { busquedas, claves }, { ubicacion }) {
  const pais = ubicacion.computrabajo;
  if (!pais) return [];
  const nombrePais = { ar: 'Argentina', es: 'España', mx: 'México', co: 'Colombia', cl: 'Chile' }[pais] || pais;
  const vacantes = [];
  for (const q of busquedas.slice(0, 4)) {
    const slug = sinTildes(q.toLowerCase()).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const html = await traerTexto(`https://${pais}.computrabajo.com/trabajo-de-${slug}?pubdate=1`);
    for (const a of html.split('<article').slice(1)) {
      const g = (re) => entidades((a.match(re) || [])[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const ruta = g(/href="(\/ofertas-de-trabajo\/[^"#?]+)/);
      const publicada = haceTanto(g(/fs13 fc_aux[^>]*>([\s\S]*?)<\/p>/));
      const titulo = g(/class="js-o-link[^"]*"[^>]*>([\s\S]*?)<\/a>/);
      // El buscador de Computrabajo es muy amplio: además, el título tiene que parecerse a lo que buscás.
      if (!ruta || !publicada || fechaEn(zona, publicada) !== hoy || !parecido(titulo, claves)) continue;
      const lugar = g(/<p class="fs16 fc_base mt5">([\s\S]*?)<\/p>/);
      const remoto = /remoto/i.test(a);
      vacantes.push({
        titulo,
        empresa: g(/offer-grid-article-company-url>([\s\S]*?)<\/a>/) || 'Empresa confidencial',
        ubicacion: `${remoto ? 'Remoto · ' : ''}${lugar}, ${nombrePais}`,
        remota: false, paises: [nombrePais],
        url: `https://${pais}.computrabajo.com${ruta}`, fuente: 'Computrabajo', publicada: publicada.toISOString(), resumen: '', salario: null,
      });
    }
  }
  return vacantes;
}

// ── Bolsas remotas por RSS o API ──
async function weWorkRemotely(hoy, zona, { claves }) {
  const xml = await traerTexto('https://weworkremotely.com/remote-jobs.rss');
  return items(xml).map((it) => {
    const [empresa, ...resto] = campo(it, 'title').split(':');
    const region = campo(it, 'region') || 'Anywhere in the World';
    return { titulo: resto.join(':').trim(), empresa: empresa.trim(), ubicacion: `Remoto (${region})`, remota: true, paises: [region],
      url: campo(it, 'link'), fuente: 'We Work Remotely', publicada: new Date(campo(it, 'pubDate')).toISOString(), resumen: limpiarHtml(campo(it, 'description')).slice(0, 1200), salario: null };
  }).filter((v) => fechaEn(zona, new Date(v.publicada)) === hoy && parecido(v.titulo, claves));
}

async function jobicy(hoy, zona, { claves }) {
  const j = await traerJson('https://jobicy.com/api/v2/remote-jobs?count=100');
  return (j.jobs || []).map((a) => ({
    titulo: entidades(a.jobTitle), empresa: a.companyName, ubicacion: `Remoto (${a.jobGeo || 'sin restricción'})`, remota: true, paises: a.jobGeo ? [a.jobGeo] : [],
    url: a.url, fuente: 'Jobicy', publicada: new Date(a.pubDate).toISOString(), resumen: limpiarHtml(a.jobExcerpt || '').slice(0, 1200), salario: null,
  })).filter((v) => fechaEn(zona, new Date(v.publicada)) === hoy && parecido(v.titulo, claves));
}

async function remoteFirstJobs(hoy, zona, { claves }) {
  const xml = await traerTexto('https://remotefirstjobs.com/rss/jobs.rss');
  return items(xml).map((it) => {
    const titulo = campo(it, 'title');
    const corte = titulo.lastIndexOf(' at ');
    return { titulo: corte > 0 ? titulo.slice(0, corte) : titulo, empresa: corte > 0 ? titulo.slice(corte + 4) : 'Empresa remota', ubicacion: 'Remoto', remota: true, paises: [],
      url: campo(it, 'link'), fuente: 'Remote First Jobs', publicada: new Date(campo(it, 'pubDate')).toISOString(), resumen: limpiarHtml(campo(it, 'description')).slice(0, 1200), salario: null };
  }).filter((v) => fechaEn(zona, new Date(v.publicada)) === hoy && parecido(v.titulo, claves));
}

async function jobspresso(hoy, zona, { claves }) {
  const xml = await traerTexto('https://jobspresso.co/feed/?post_type=job_listing');
  return items(xml).map((it) => {
    const [empresa, lugar] = campo(it, 'dc:creator').split(/<br\s*\/?>/i).map((s) => s.replace(/⚲/g, '').trim());
    return { titulo: campo(it, 'title'), empresa: empresa || 'Empresa remota', ubicacion: `Remoto (${lugar || 'sin restricción'})`, remota: true, paises: lugar ? [lugar] : [],
      url: campo(it, 'link'), fuente: 'Jobspresso', publicada: new Date(campo(it, 'pubDate')).toISOString(), resumen: limpiarHtml(campo(it, 'description')).slice(0, 1200), salario: null };
  }).filter((v) => fechaEn(zona, new Date(v.publicada)) === hoy && parecido(v.titulo, claves));
}

async function nodesk(hoy, zona, { claves }) {
  const xml = await traerTexto('https://nodesk.co/remote-jobs/index.xml');
  return items(xml).map((it) => {
    const titulo = campo(it, 'title');
    const corte = titulo.lastIndexOf(' at ');
    return { titulo: corte > 0 ? titulo.slice(0, corte) : titulo, empresa: corte > 0 ? titulo.slice(corte + 4) : 'Empresa remota', ubicacion: 'Remoto', remota: true, paises: [],
      url: campo(it, 'link'), fuente: 'Nodesk', publicada: new Date(campo(it, 'pubDate')).toISOString(), resumen: limpiarHtml(campo(it, 'description')).slice(0, 1200), salario: null };
  }).filter((v) => fechaEn(zona, new Date(v.publicada)) === hoy && parecido(v.titulo, claves));
}

async function arbeitnow(hoy, zona, { claves }) {
  const j = await traerJson('https://www.arbeitnow.com/api/job-board-api');
  return (j.data || []).map((a) => ({
    titulo: a.title, empresa: a.company_name, ubicacion: a.remote ? `Remoto (Europa · ${a.location})` : a.location,
    remota: Boolean(a.remote), paises: a.remote ? ['Europe'] : [a.location, 'Germany'],
    url: a.url, fuente: 'Arbeitnow', publicada: new Date(a.created_at * 1000).toISOString(), resumen: limpiarHtml(a.description).slice(0, 1200), salario: null,
  })).filter((v) => fechaEn(zona, new Date(v.publicada)) === hoy && parecido(v.titulo, claves));
}

// Los portales que revisa el radar (en este orden se muestran).
export const PORTALES = ['LinkedIn', 'Computrabajo', 'Get on Board', 'We Work Remotely', 'Himalayas', 'Remote OK', 'Jobicy', 'Remote First Jobs', 'Jobspresso', 'Nodesk', 'Arbeitnow'];

// Junta todas las fuentes en paralelo. Si una falla, seguimos con las demás y lo anotamos.
export async function buscarEnBolsas({ hoy, zona, incluirRemotas, criterios, ubicacion, modalidades = ['remoto'] }) {
  const contexto = { ubicacion: ubicacion || { linkedin: 'Argentina', computrabajo: 'ar' }, modalidades };
  const fuentes = {
    LinkedIn: linkedin, Computrabajo: computrabajo, 'Get on Board': getOnBoard,
    ...(incluirRemotas ? { 'We Work Remotely': weWorkRemotely, Himalayas: himalayas, 'Remote OK': remoteOk, Jobicy: jobicy, 'Remote First Jobs': remoteFirstJobs, Jobspresso: jobspresso, Nodesk: nodesk } : {}),
    Arbeitnow: arbeitnow,
  };
  const avisos = [];
  const porPortal = {};
  const resultados = await Promise.all(Object.entries(fuentes).map(async ([nombre, fn]) => {
    try {
      const lista = await fn(hoy, zona, criterios, contexto);
      porPortal[nombre] = lista.length;
      return lista;
    } catch (e) {
      porPortal[nombre] = null;
      avisos.push(`${nombre} no respondió (${e.message})`);
      return [];
    }
  }));
  return { vacantes: resultados.flat(), avisos, porPortal };
}
