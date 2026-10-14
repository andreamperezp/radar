// Botón "BUSCAR NUEVO PROYECTO" de la web: búsqueda rápida y gratis (bolsas de empleo + palabras clave).
// La búsqueda inteligente la hace Claude Code con /radar y llega por /api/importar.
import { autorizado, pedirClave } from '../lib/acceso.js';
import { leerAjustes, leerHistorial, sumarAlHistorial, marcarEmpresasAplicadas } from '../lib/almacen.js';
import { buscarProyectos } from '../lib/match.js';

export const config = { maxDuration: 120 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!autorizado(req)) return pedirClave(res);
  try {
    const ajustes = await leerAjustes();
    const historial = await leerHistorial();
    const resultado = await buscarProyectos(ajustes, historial);
    const vacantes = marcarEmpresasAplicadas(resultado.vacantes, historial);
    await sumarAlHistorial(vacantes);
    res.json({ vacantes, informe: resultado.informe });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
