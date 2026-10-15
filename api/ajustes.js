// Leer y cambiar ajustes (ubicación, modalidad, cuántas vacantes).
import { autorizado, pedirClave } from '../lib/acceso.js';
import { leerAjustes, guardarAjustes } from '../lib/almacen.js';
import { UBICACIONES } from '../lib/ubicaciones.js';
import { hayTelegram } from '../lib/telegram.js';

const PERMITIDOS = ['ubicacion', 'ubicacionLibre', 'modalidades', 'minimo', 'puntajeMinimo'];

export default async function handler(req, res) {
  if (!autorizado(req)) return pedirClave(res);
  if (req.method === 'POST') {
    const cambios = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => PERMITIDOS.includes(k)));
    await guardarAjustes(cambios);
  }
  const ajustes = await leerAjustes();
  res.json({
    ajustes,
    ubicaciones: UBICACIONES.map(({ id, nombre }) => ({ id, nombre })),
    estado: { telegram: hayTelegram(), telegramConectado: Boolean(ajustes.telegramChatId), correoRevisado: ajustes.correoRevisado || null },
  });
}
