// Junta las vacantes de hoy y elige las mejores.
// - candidatasDeHoy(): lo que encontró en las bolsas, ya filtrado. Lo usa /radar (Claude Code) y la web.
// - buscarProyectos(): versión gratis de la web, con puntaje por palabras clave.
import { leerPerfil, criteriosDe } from './perfiles.js';
import { resolverUbicacion, fechaEn, puedeTomarla } from './ubicaciones.js';
import { buscarEnBolsas } from './fuentes.js';
import { normalizarUrl } from './almacen.js';
import { perfilActual } from './contexto.js';

export async function candidatasDeHoy(ajustes, historial = [], criterios) {
  criterios ||= criteriosDe(await leerPerfil());
  const ubicacion = resolverUbicacion(ajustes);
  const hoy = fechaEn(ubicacion.zona);
  const modalidades = ajustes.modalidades?.length ? ajustes.modalidades : ['remoto'];
  const bolsas = await buscarEnBolsas({ hoy, zona: ubicacion.zona, incluirRemotas: modalidades.includes('remoto'), criterios });

  // Sacamos duplicados, lo que no podés tomar y lo que ya viste otros días.
  const vistas = new Set(historial.map((v) => normalizarUrl(v.url)));
  const unicas = new Map();
  for (const v of bolsas.vacantes) {
    const clave = normalizarUrl(v.url);
    const claveTitulo = `${v.titulo}|${v.empresa}`.toLowerCase();
    if (!puedeTomarla(v, ubicacion) || vistas.has(clave) || unicas.has(clave)) continue;
    if ([...unicas.values()].some((x) => `${x.titulo}|${x.empresa}`.toLowerCase() === claveTitulo)) continue;
    unicas.set(clave, v);
  }
  return {
    hoy, ubicacion, modalidades,
    candidatas: [...unicas.values()].slice(0, 40),
    informe: { hoy, ubicacion: ubicacion.nombre, encontradasHoy: bolsas.vacantes.length, revisadas: unicas.size, avisos: bolsas.avisos },
  };
}

function puntajePorPalabras(v, { claves, extra }) {
  const t = ` ${v.titulo} ${v.resumen} `.toLowerCase();
  const fuertes = claves.filter((c) => ` ${v.titulo.toLowerCase()} `.includes(c)).length;
  const coincidencias = extra.filter((c) => t.includes(c));
  const ingles = /\b(fluent|advanced) english\b|inglés (avanzado|fluido)/i.test(t);
  return {
    puntaje: Math.min(95, 45 + fuertes * 15 + coincidencias.length * 5 - (ingles ? 15 : 0)),
    porQue: coincidencias.length ? `Coincide en: ${coincidencias.slice(0, 5).map((s) => s.trim()).join(', ')}.` : 'El puesto coincide con los roles que buscás.',
    comoDestacar: perfilActual().admin
      ? 'Búsqueda rápida por palabras clave. Para un análisis contra tu CV, pedile /radar a Claude.'
      : 'Búsqueda rápida por palabras clave. Para que Claude la compare con tu CV, pedí una búsqueda a fondo.',
    idioma: /[áéíóñ]| de | para /i.test(t) ? 'es' : 'en',
    modo: 'rapido',
  };
}

export async function buscarProyectos(ajustes, historial = []) {
  const criterios = criteriosDe(await leerPerfil());
  const { candidatas, informe } = await candidatasDeHoy(ajustes, historial, criterios);
  const vacantes = candidatas
    .map((v) => ({ ...v, ...puntajePorPalabras(v, criterios), encontrada: new Date().toISOString() }))
    .filter((v) => v.puntaje >= (ajustes.puntajeMinimo ?? 55))
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, Math.max(ajustes.minimo ?? 3, 6));
  return { vacantes, informe };
}
