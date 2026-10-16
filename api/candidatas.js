// Para /radar (Claude Code): las vacantes de hoy de las bolsas + lo que ya viste o aplicaste.
import { conPerfil } from '../lib/acceso.js';
import { leerAjustes, leerHistorial, EN_SEGUIMIENTO } from '../lib/almacen.js';
import { candidatasDeHoy } from '../lib/match.js';
import { leerPerfil, textoParaClaude, criteriosDe } from '../lib/perfiles.js';

export const config = { maxDuration: 120 };

export default (req, res) => conPerfil(req, res, async (quien) => {
  try {
    const [ajustes, historial, perfil] = await Promise.all([leerAjustes(), leerHistorial(), leerPerfil()]);
    const { hoy, ubicacion, modalidades, candidatas, informe } = await candidatasDeHoy(ajustes, historial, criteriosDe(perfil));
    res.json({
      hoy,
      zonaHoraria: ubicacion.zona,
      ubicacion: ubicacion.busqueda,
      modalidades,
      minimo: ajustes.minimo,
      puntajeMinimo: ajustes.puntajeMinimo,
      persona: { id: quien.id, nombre: perfil.nombre || quien.nombre },
      puestos: perfil.puestos,
      perfil: textoParaClaude(perfil),
      perfilArmadoPorClaude: Boolean(perfil.perfilTexto),
      ingles: perfil.ingles,
      links: { linkedin: perfil.linkedin, portfolio: perfil.portfolio, web: perfil.web },
      contexto: perfil.contexto,
      cv: perfil.cv || null,
      candidatas,
      informe,
      yaVistas: historial.map((v) => v.url),
      empresasDondeAplicaste: [...new Set(historial.filter((v) => EN_SEGUIMIENTO.includes(v.estado)).map((v) => v.empresa))],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
