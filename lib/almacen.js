// Guarda los datos de cada persona. En Vercel usa Blob privado; en tu compu, archivos en .datos/.
// Andrea (la dueña) usa radar/*.json como siempre; cada invitado tiene su carpeta radar/personas/<id>/.
import { put, get } from '@vercel/blob';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { perfilActual } from './contexto.js';

const EN_VERCEL = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

const carpeta = (id = perfilActual().id) => (id === 'andrea' ? '' : `personas/${id}/`);

async function leerRuta(ruta, porDefecto) {
  try {
    if (EN_VERCEL) {
      const r = await get(`radar/${ruta}`, { access: 'private', useCache: false });
      if (!r) return porDefecto;
      return JSON.parse(await new Response(r.stream).text());
    }
    return JSON.parse(await readFile(`.datos/${ruta}`, 'utf8'));
  } catch {
    return porDefecto;
  }
}

async function guardarRuta(ruta, contenido, tipo = 'application/json') {
  if (EN_VERCEL) {
    await put(`radar/${ruta}`, contenido, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: tipo });
    return;
  }
  await mkdir(dirname(`.datos/${ruta}`), { recursive: true });
  await writeFile(`.datos/${ruta}`, contenido);
}

// Datos de la persona que está usando el radar ahora.
const leer = (nombre, porDefecto) => leerRuta(`${carpeta()}${nombre}.json`, porDefecto);
const guardar = (nombre, datos) => guardarRuta(`${carpeta()}${nombre}.json`, JSON.stringify(datos, null, 2));

// Para datos sueltos (por ejemplo, qué mails ya se procesaron).
export const leerDato = leer;
export const guardarDato = guardar;

// Datos de todo el radar (la lista de personas con acceso).
export const leerGlobal = (nombre, porDefecto) => leerRuta(`${nombre}.json`, porDefecto);
export const guardarGlobal = (nombre, datos) => guardarRuta(`${nombre}.json`, JSON.stringify(datos, null, 2));

// Datos de otra persona (lo usa la dueña desde el panel de personas).
export const leerDe = (id, nombre, porDefecto) => leerRuta(`${carpeta(id)}${nombre}.json`, porDefecto);
export const guardarDe = (id, nombre, datos) => guardarRuta(`${carpeta(id)}${nombre}.json`, JSON.stringify(datos, null, 2));

// El CV en PDF de la persona actual.
export async function guardarCv(buffer) {
  await guardarRuta(`${carpeta()}cv.pdf`, buffer, 'application/pdf');
}
export async function leerCv() {
  try {
    if (EN_VERCEL) {
      const r = await get(`radar/${carpeta()}cv.pdf`, { access: 'private', useCache: false });
      return r ? Buffer.from(await new Response(r.stream).arrayBuffer()) : null;
    }
    return await readFile(`.datos/${carpeta()}cv.pdf`);
  } catch {
    return null;
  }
}

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
