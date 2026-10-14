// Vacantes ya encontradas, y marcar cada una como aplicada o descartada.
import { autorizado, pedirClave } from '../lib/acceso.js';
import { leerHistorial, cambiarEstado } from '../lib/almacen.js';

const ESTADOS = ['nueva', 'aplicada', 'descartada'];

export default async function handler(req, res) {
  if (!autorizado(req)) return pedirClave(res);
  if (req.method === 'POST') {
    const { url, estado } = req.body || {};
    if (!url || !ESTADOS.includes(estado)) return res.status(400).json({ error: 'Falta url o estado' });
    return res.json({ historial: await cambiarEstado(url, estado) });
  }
  res.json({ historial: await leerHistorial() });
}
