// Vacantes ya encontradas y tu seguimiento: cambiar etapa o guardar una nota.
import { autorizado, pedirClave } from '../lib/acceso.js';
import { leerHistorial, cambiarEstado, guardarNota, ESTADOS } from '../lib/almacen.js';

export default async function handler(req, res) {
  if (!autorizado(req)) return pedirClave(res);
  if (req.method === 'POST') {
    const { url, estado, nota } = req.body || {};
    if (!url) return res.status(400).json({ error: 'Falta la url' });
    if (typeof nota === 'string') return res.json({ historial: await guardarNota(url, nota) });
    if (!ESTADOS.includes(estado)) return res.status(400).json({ error: 'Etapa desconocida' });
    return res.json({ historial: await cambiarEstado(url, estado) });
  }
  res.json({ historial: await leerHistorial() });
}
