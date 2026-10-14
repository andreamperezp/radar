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

export async function sumarAlHistorial(vacantes) {
  const historial = await leerHistorial();
  const vistas = new Set(historial.map((v) => v.url));
  const nuevas = vacantes.filter((v) => !vistas.has(v.url)).map((v) => ({ ...v, estado: 'nueva' }));
  // Nos quedamos con las últimas 500 para que no crezca para siempre.
  const todo = [...nuevas, ...historial].slice(0, 500);
  await guardar('historial', todo);
  return todo;
}

export async function cambiarEstado(url, estado) {
  const historial = await leerHistorial();
  const v = historial.find((x) => x.url === url);
  if (v) v.estado = estado;
  await guardar('historial', historial);
  return historial;
}
