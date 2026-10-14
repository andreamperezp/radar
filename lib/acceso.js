// Solo vos podés usar el radar: cada pedido trae la clave APP_PASSWORD.
import { timingSafeEqual } from 'node:crypto';

export function autorizado(req) {
  const clave = process.env.APP_PASSWORD;
  if (!clave) return process.env.VERCEL_ENV !== 'production'; // en tu compu, sin clave, pasa
  const dada = Buffer.from(String(req.headers['x-clave'] || ''));
  const esperada = Buffer.from(clave);
  return dada.length === esperada.length && timingSafeEqual(dada, esperada);
}

export function pedirClave(res) {
  res.status(401).json({ error: 'Clave incorrecta' });
}

export function urlDelSitio(req) {
  if (process.env.SITIO_URL) return process.env.SITIO_URL;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return host ? `https://${host}` : '';
}
