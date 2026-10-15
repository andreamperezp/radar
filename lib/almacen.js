// Guarda ajustes e historial. En Vercel usa Blob privado; en tu compu, un archivo en .datos/.
import { put, get } from '@vercel/blob';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const EN_VERCEL = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

async function leer(nombre, porDefecto) {
  try {
    if (EN_VERCEL) {
      const r = await get(`radar/${nombre}.json`, { access: 'private', useCache: false });
      if (!r) return porDefecto;
      return JSON.parse(await new Response(r.stream).text());
    }
    return JSON.parse(await readFile(`.datos/${nombre}.json`, 'utf8'));
  } catch {
    return porDefecto;
  }
}

async function guardar(nombre, datos) {
  const texto = JSON.stringify(datos, null, 2);
  if (EN_VERCEL) {
    await put(`radar/${nombre}.json`, texto, {
      access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json',
    });
    return;
  }
  await mkdir('.datos', { recursive: true });
  await writeFile(`.datos/${nombre}.json`, texto);
}

// Para datos sueltos (por ejemplo, qué mails ya se procesaron).
export const leerDato = leer;
export const guardarDato = guardar;

export const AJUSTES_INICIALES = {
  ubicacion: 'remoto-ar',
  ubicacionLibre: '',
  modalidades: ['remoto', 'hibrido'],
  minimo: 3,
  puntajeMinimo: 55,
  telegramChatId: null,
};

export async function leerAjustes() {
  return { ...AJUSTES_INICIALES, ...(await leer('ajustes', {})) };
}

export async function guardarAjustes(cambios) {
  const ajustes = { ...(await leerAjustes()), ...cambios };
  await guardar('ajustes', ajustes);
  return ajustes;
}

// Historial: todas las vacantes que el radar ya te mostró, para no repetirlas.
export async function leerHistorial() {
  return leer('historial', []);
}

// Etapas: "nueva" y "descartada" son vacantes que viste; el resto es tu seguimiento de postulaciones.
export const ESTADOS = ['nueva', 'descartada', 'aplicada', 'entrevista', 'oferta', 'rechazada'];
export const EN_SEGUIMIENTO = ['aplicada', 'entrevista', 'oferta', 'rechazada'];

export function normalizarUrl(url = '') {
  return url.split('?')[0].split('#')[0].replace(/\/$/, '').toLowerCase();
}

// "Acme Inc." y "ACME S.A." cuentan como la misma empresa.
export function normalizarEmpresa(nombre = '') {
  return nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(inc|llc|ltd|s\.?a\.?|s\.?r\.?l\.?|sas|corp|co|gmbh)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// Le agrega a cada vacante si ya aplicaste a esa misma empresa (por otra búsqueda).
export function marcarEmpresasAplicadas(vacantes, historial) {
  const aplicadas = new Map();
  for (const v of historial) {
    if (!EN_SEGUIMIENTO.includes(v.estado)) continue;
    const clave = normalizarEmpresa(v.empresa);
    if (clave && !aplicadas.has(clave)) aplicadas.set(clave, { titulo: v.titulo, fecha: v.aplicadaEl || v.encontrada, estado: v.estado });
  }
  return vacantes.map((v) => {
    const previa = aplicadas.get(normalizarEmpresa(v.empresa));
    return previa ? { ...v, yaAplicasteEnEmpresa: previa } : v;
  });
}

export async function sumarAlHistorial(vacantes) {
  const historial = await leerHistorial();
  const vistas = new Set(historial.map((v) => normalizarUrl(v.url)));
  const nuevas = vacantes.filter((v) => !vistas.has(normalizarUrl(v.url))).map((v) => ({ ...v, estado: 'nueva' }));
  // Para que no crezca para siempre: guardamos todo tu seguimiento y las últimas 400 vistas.
  const todo = [...nuevas, ...historial];
  const seguimiento = todo.filter((v) => EN_SEGUIMIENTO.includes(v.estado));
  const vistasNomas = todo.filter((v) => !EN_SEGUIMIENTO.includes(v.estado)).slice(0, 400);
  const final = todo.filter((v) => seguimiento.includes(v) || vistasNomas.includes(v));
  await guardar('historial', final);
  return { historial: final, nuevas };
}

export async function cambiarEstado(url, estado) {
  const historial = await leerHistorial();
  const v = historial.find((x) => normalizarUrl(x.url) === normalizarUrl(url));
  if (v) {
    v.estado = estado;
    const ahora = new Date().toISOString();
    if (estado === 'aplicada' && !v.aplicadaEl) v.aplicadaEl = ahora;
    if (estado === 'nueva' || estado === 'descartada') delete v.aplicadaEl;
    v.etapas = { ...(v.etapas || {}), [estado]: ahora };
  }
  await guardar('historial', historial);
  return historial;
}

export async function guardarHistorial(historial) {
  await guardar('historial', historial);
}

export async function guardarNota(url, nota) {
  const historial = await leerHistorial();
  const v = historial.find((x) => normalizarUrl(x.url) === normalizarUrl(url));
  if (v) v.nota = String(nota).slice(0, 1000);
  await guardar('historial', historial);
  return historial;
}
