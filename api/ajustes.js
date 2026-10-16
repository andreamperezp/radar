// Leer y cambiar ajustes (ubicación, modalidad, cuántas vacantes).
import { conPerfil } from '../lib/acceso.js';
import { leerPerfil, perfilCompleto } from '../lib/perfiles.js';
import { leerAjustes, guardarAjustes } from '../lib/almacen.js';
import { UBICACIONES } from '../lib/ubicaciones.js';
import { hayTelegram } from '../lib/telegram.js';

const MODALIDADES = ['remoto', 'hibrido', 'presencial'];
const entre = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;

// Solo guarda valores válidos: un dato vacío o raro se ignora y queda el que tenías.
function limpiar(cuerpo = {}) {
  const c = {};
  if (UBICACIONES.some((u) => u.id === cuerpo.ubicacion)) c.ubicacion = cuerpo.ubicacion;
  if (typeof cuerpo.ubicacionLibre === 'string') c.ubicacionLibre = cuerpo.ubicacionLibre.trim().slice(0, 120);
  if (Array.isArray(cuerpo.modalidades)) {
    const m = cuerpo.modalidades.filter((x) => MODALIDADES.includes(x));
    if (m.length) c.modalidades = m;
  }
  if (entre(cuerpo.minimo, 3, 6)) c.minimo = cuerpo.minimo;
  if (entre(cuerpo.puntajeMinimo, 40, 85)) c.puntajeMinimo = cuerpo.puntajeMinimo;
  // Marcas del recorrido de bienvenida (solo se prenden).
  if (cuerpo.ubicacionElegida === true) c.ubicacionElegida = true;
  if (cuerpo.bienvenidaTerminada === true) c.bienvenidaTerminada = true;
  return c;
}

export default (req, res) => conPerfil(req, res, async (quien) => {
  if (req.method === 'POST') {
    const cambios = limpiar(req.body);
    if (!Object.keys(cambios).length) return res.status(400).json({ error: 'No había nada válido para guardar' });
    await guardarAjustes(cambios);
  }
  const [ajustes, perfil] = await Promise.all([leerAjustes(), leerPerfil()]);
  res.json({
    quien: { id: quien.id, nombre: perfil.nombre || quien.nombre, admin: quien.admin },
    perfilCompleto: perfilCompleto(perfil),
    pedido: ajustes.pedido || null,
    ajustes,
    ubicaciones: UBICACIONES.map(({ id, nombre }) => ({ id, nombre })),
    estado: { telegram: hayTelegram(), telegramConectado: Boolean(ajustes.telegramChatId), correoRevisado: ajustes.correoRevisado || null },
  });
});
