// El perfil de quien usa el radar: CV en PDF, links, puestos que busca, inglés y contexto.
//   GET               → los datos del perfil
//   GET  ?cv=1        → descarga el CV en PDF
//   POST {…, cv: {nombre, base64}}  → guarda cambios (y el CV si viene)
// Solo /radar (la dueña actuando como esa persona) puede guardar el perfil que arma Claude:
//   perfilTexto, busquedas y claves.
import { conPerfil } from '../lib/acceso.js';
import { guardarCv, leerCv } from '../lib/almacen.js';
import { leerPerfil, guardarPerfil, perfilCompleto, NIVELES_INGLES } from '../lib/perfiles.js';

const MAX_CV = 3 * 1024 * 1024; // 3 MB
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
const link = (v) => {
  const t = texto(v, 300);
  if (t === undefined || t === '') return t;
  return t.replace(/^(?!https?:\/\/)/, 'https://');
};
const lista = (v, max, largo) => (Array.isArray(v) ? [...new Set(v.map((x) => texto(String(x), largo)).filter(Boolean))].slice(0, max) : undefined);

export const config = { maxDuration: 30 };

export default (req, res) => conPerfil(req, res, async (quien) => {
  if (req.method === 'GET') {
    if (req.query?.cv || new URL(req.url, 'http://x').searchParams.get('cv')) {
      const pdf = await leerCv();
      if (!pdf) return res.status(404).json({ error: 'Todavía no hay CV' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="cv.pdf"');
      return res.end(pdf);
    }
    const p = await leerPerfil();
    return res.json({ perfil: p, completo: perfilCompleto(p) });
  }
  if (req.method !== 'POST') return res.status(405).end();

  const b = req.body || {};
  const cambios = {
    nombre: texto(b.nombre, 80),
    puestos: lista(b.puestos, 10, 60),
    linkedin: link(b.linkedin),
    portfolio: link(b.portfolio),
    web: link(b.web),
    ingles: NIVELES_INGLES.includes(b.ingles) ? b.ingles : undefined,
    contexto: texto(b.contexto, 2000),
  };
  if (quien.actuaLaDuena || quien.admin) {
    // Lo que arma Claude en /radar después de leer el CV y la web.
    Object.assign(cambios, {
      perfilTexto: texto(b.perfilTexto, 6000),
      busquedas: lista(b.busquedas, 10, 60),
      claves: lista(b.claves?.map?.((c) => String(c).toLowerCase()), 40, 60),
      extra: lista(b.extra?.map?.((c) => String(c).toLowerCase()), 40, 40),
    });
  }

  if (b.cv?.base64) {
    const pdf = Buffer.from(String(b.cv.base64), 'base64');
    if (pdf.length > MAX_CV) return res.status(413).json({ error: 'El CV pesa más de 3 MB. Probá exportarlo más liviano.' });
    if (pdf.subarray(0, 5).toString() !== '%PDF-') return res.status(400).json({ error: 'El CV tiene que ser un PDF.' });
    await guardarCv(pdf);
    cambios.cv = { nombre: texto(b.cv.nombre, 120) || 'cv.pdf', tamano: pdf.length, subido: new Date().toISOString() };
    // CV nuevo: que Claude vuelva a leerlo la próxima vez.
    if (!quien.actuaLaDuena && !quien.admin) cambios.perfilTexto = '';
  }

  const limpios = Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== undefined));
  const p = await guardarPerfil(limpios);
  res.json({ perfil: p, completo: perfilCompleto(p) });
});
