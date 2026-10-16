// Quién puede usar el radar.
// - Andrea (dueña) entra con APP_PASSWORD.
// - Cada invitado entra con su propia clave, que crea Andrea desde "Personas con acceso".
//   Las claves de invitados se guardan cifradas (sha-256): nadie puede leerlas después de crearlas.
import { timingSafeEqual, createHash, randomBytes } from 'node:crypto';
import { DUENA, conContexto } from './contexto.js';
import { leerGlobal, guardarGlobal } from './almacen.js';

const resumen = (texto) => createHash('sha256').update(String(texto)).digest();
const iguales = (a, b) => a.length === b.length && timingSafeEqual(a, b);

export const leerPersonas = () => leerGlobal('personas', []);
export const guardarPersonas = (lista) => guardarGlobal('personas', lista);

export function nuevaClave() {
  // 18 bytes al azar → 24 caracteres fáciles de copiar (sin + / =)
  return randomBytes(18).toString('base64url');
}
export const cifrarClave = (clave) => resumen(clave).toString('hex');

// Devuelve el perfil de quien hace el pedido, o null si la clave no sirve.
export async function identificar(req) {
  const dada = String(req.headers['x-clave'] || '');
  const maestra = process.env.APP_PASSWORD;
  const esDuena = maestra ? iguales(Buffer.from(dada), Buffer.from(maestra)) : process.env.VERCEL_ENV !== 'production';

  if (esDuena) {
    // La dueña puede actuar como otra persona (lo usa /radar benjamin): header x-perfil.
    const como = String(req.headers['x-perfil'] || '').trim();
    if (como && como !== DUENA.id) {
      const otra = (await leerPersonas()).find((p) => p.id === como && p.activo !== false);
      if (!otra) return { error: `No existe la persona "${como}"` };
      return { id: otra.id, nombre: otra.nombre, admin: false, actuaLaDuena: true };
    }
    return { ...DUENA };
  }
  if (!dada) return null;
  const huella = resumen(dada);
  const persona = (await leerPersonas()).find((p) => p.activo !== false && iguales(huella, Buffer.from(p.claveHash, 'hex')));
  return persona ? { id: persona.id, nombre: persona.nombre, admin: false } : null;
}

export function pedirClave(res, detalle) {
  const falta = !process.env.APP_PASSWORD && process.env.VERCEL_ENV === 'production';
  res.status(401).json({
    error: detalle || (falta ? 'Todavía no cargaste APP_PASSWORD en Vercel. Cargala, volvé a publicar y entrá con esa clave.' : 'Esa no es la clave. Probá de nuevo.'),
    falta,
  });
}

// Envuelve cada ruta: identifica a la persona y corre todo "dentro" de su radar.
export async function conPerfil(req, res, fn) {
  const perfil = await identificar(req);
  if (!perfil) return pedirClave(res);
  if (perfil.error) return res.status(404).json({ error: perfil.error });
  return conContexto(perfil, () => fn(perfil));
}

// Para scripts viejos que solo preguntan "¿está autorizado?" (siempre se usa junto con conPerfil).
export async function autorizado(req) {
  const p = await identificar(req);
  return Boolean(p && !p.error);
}

export function urlDelSitio(req) {
  if (process.env.SITIO_URL) return process.env.SITIO_URL;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return host ? `https://${host}` : '';
}
