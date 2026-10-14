// Para /radar (Claude Code): las vacantes de hoy de las bolsas + lo que ya viste o aplicaste.
import { autorizado, pedirClave } from '../lib/acceso.js';
import { leerAjustes, leerHistorial, EN_SEGUIMIENTO } from '../lib/almacen.js';
import { candidatasDeHoy } from '../lib/match.js';
import { PERFIL, PUESTOS } from '../lib/perfil.js';

export const config = { maxDuration: 120 };

export default async function handler(req, res) {
  if (!autorizado(req)) return pedirClave(res);
  try {
    const [ajustes, historial] = await Promise.all([leerAjustes(), leerHistorial()]);
    const { hoy, ubicacion, modalidades, candidatas, informe } = await candidatasDeHoy(ajustes, historial);
    res.json({
      hoy,
      zonaHoraria: ubicacion.zona,
      ubicacion: ubicacion.busqueda,
      modalidades,
      minimo: ajustes.minimo,
      puntajeMinimo: ajustes.puntajeMinimo,
      puestos: PUESTOS,
      perfil: PERFIL,
      candidatas,
      informe,
      yaVistas: historial.map((v) => v.url),
      empresasDondeAplicaste: [...new Set(historial.filter((v) => EN_SEGUIMIENTO.includes(v.estado)).map((v) => v.empresa))],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
