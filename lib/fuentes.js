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

async function traerJson(url) {
  const r = await fetch(url, { headers: AGENTE, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${r.status} en ${new URL(url).host}`);
  return r.json();
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

// Junta todas las fuentes. Si una falla, seguimos con las demás y lo anotamos.
export async function buscarEnBolsas({ hoy, zona, incluirRemotas, criterios }) {
  const fuentes = incluirRemotas ? { 'Get on Board': getOnBoard, Himalayas: himalayas, 'Remote OK': remoteOk } : { 'Get on Board': getOnBoard };
  const avisos = [];
  const resultados = await Promise.all(Object.entries(fuentes).map(async ([nombre, fn]) => {
    try {
      return await fn(hoy, zona, criterios);
    } catch (e) {
      avisos.push(`${nombre} no respondió (${e.message})`);
      return [];
    }
  }));
  return { vacantes: resultados.flat(), avisos };
}
