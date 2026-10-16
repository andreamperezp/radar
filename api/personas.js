// Panel de la dueña: quién tiene acceso al radar.
//   GET                                   → lista de personas con su estado
//   POST {accion:'invitar', nombre}       → crea la persona y devuelve su clave (se muestra una sola vez)
//   POST {accion:'nueva-clave', id}       → reemplaza la clave (la anterior deja de servir)
//   POST {accion:'quitar', id}            → le saca el acceso (sus datos quedan guardados)
//   POST {accion:'devolver', id}          → le devuelve el acceso con su clave de antes
import { conPerfil, leerPersonas, guardarPersonas, nuevaClave, cifrarClave } from '../lib/acceso.js';
import { leerDe } from '../lib/almacen.js';

const idDe = (nombre) => nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);

async function conEstado(p) {
  const [ajustes, perfil, historial] = await Promise.all([leerDe(p.id, 'ajustes', {}), leerDe(p.id, 'perfil', {}), leerDe(p.id, 'historial', [])]);
  return {
    id: p.id, nombre: p.nombre, activo: p.activo !== false, creado: p.creado,
    perfil: { puestos: perfil.puestos || [], cv: Boolean(perfil.cv), linkedin: perfil.linkedin || '', armadoPorClaude: Boolean(perfil.perfilTexto) },
    telegram: Boolean(ajustes.telegramChatId),
    pedido: ajustes.pedido || null,
    ultimaBusquedaAFondo: ajustes.ultimaBusquedaAFondo || null,
    vacantes: historial.length,
    aplicadas: historial.filter((v) => ['aplicada', 'entrevista', 'oferta', 'rechazada'].includes(v.estado)).length,
  };
}

export default (req, res) => conPerfil(req, res, async (quien) => {
  if (!quien.admin) return res.status(403).json({ error: 'Solo la dueña del radar puede ver esto.' });
  const personas = await leerPersonas();

  if (req.method === 'POST') {
    const { accion, id, nombre } = req.body || {};
    if (accion === 'invitar') {
      const limpio = String(nombre || '').trim().slice(0, 60);
      if (!limpio) return res.status(400).json({ error: 'Poné el nombre de la persona.' });
      let nuevoId = idDe(limpio) || 'persona';
      if (nuevoId === 'andrea' || personas.some((p) => p.id === nuevoId)) nuevoId = `${nuevoId}-${personas.length + 2}`;
      const clave = nuevaClave();
      personas.push({ id: nuevoId, nombre: limpio, claveHash: cifrarClave(clave), activo: true, creado: new Date().toISOString() });
      await guardarPersonas(personas);
      return res.json({ id: nuevoId, nombre: limpio, clave });
    }
    const p = personas.find((x) => x.id === id);
    if (!p) return res.status(404).json({ error: 'No encontré a esa persona.' });
    if (accion === 'nueva-clave') {
      const clave = nuevaClave();
      p.claveHash = cifrarClave(clave);
      p.activo = true;
      await guardarPersonas(personas);
      return res.json({ id: p.id, nombre: p.nombre, clave });
    }
    if (accion === 'quitar' || accion === 'devolver') {
      p.activo = accion === 'devolver';
      await guardarPersonas(personas);
      return res.json({ ok: true });
    }
    return res.status(400).json({ error: 'Acción desconocida' });
  }

  res.json({ personas: await Promise.all(personas.map(conEstado)) });
});
