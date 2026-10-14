// Ubicaciones que podés elegir. "zona" define qué es "hoy" (la fecha según la hora local de ese lugar).
export const UBICACIONES = [
  { id: 'remoto-ar', nombre: 'Remoto desde Argentina', busqueda: 'remoto, aceptando postulantes desde Argentina o LATAM', zona: 'America/Argentina/Buenos_Aires', remoto: true },
  { id: 'la-plata', nombre: 'La Plata', busqueda: 'La Plata, Buenos Aires, Argentina', zona: 'America/Argentina/Buenos_Aires', remoto: false },
  { id: 'amba', nombre: 'CABA y AMBA', busqueda: 'Ciudad de Buenos Aires y Gran Buenos Aires, Argentina', zona: 'America/Argentina/Buenos_Aires', remoto: false },
  { id: 'argentina', nombre: 'Toda Argentina', busqueda: 'Argentina (cualquier ciudad)', zona: 'America/Argentina/Buenos_Aires', remoto: false },
  { id: 'latam', nombre: 'Remoto LATAM', busqueda: 'remoto para Latinoamérica', zona: 'America/Argentina/Buenos_Aires', remoto: true },
  { id: 'espana', nombre: 'España', busqueda: 'España (Madrid, Barcelona, Valencia o remoto en España)', zona: 'Europe/Madrid', remoto: false },
  { id: 'mundo', nombre: 'Remoto global', busqueda: 'remoto en cualquier país (worldwide / anywhere)', zona: 'America/Argentina/Buenos_Aires', remoto: true },
  { id: 'otra', nombre: 'Otra (escribila)', busqueda: '', zona: 'America/Argentina/Buenos_Aires', remoto: false },
];

// Para descartar rápido lo que no podés tomar: qué palabras de país "te incluyen".
const DESDE_ARGENTINA = /argentin|latam|latin|south america|americas|sudam|worldwide|anywhere|global|^remote$/i;
const DESDE_ESPANA = /spain|españa|europe|europa|emea|worldwide|anywhere|global|^remote$/i;

export function puedeTomarla(vacante, ubicacion) {
  const paises = vacante.paises;
  if (!paises || ubicacion.id === 'otra') return true; // sin datos: que decida Claude
  const patron = ubicacion.id === 'espana' ? DESDE_ESPANA : DESDE_ARGENTINA;
  if (vacante.remota) return paises.length === 0 || paises.some((p) => patron.test(p.trim()));
  // Presencial o híbrida: tiene que ser en tu país.
  return paises.some((p) => (ubicacion.id === 'espana' ? /spain|españa/i : /argentin/i).test(p));
}

export function resolverUbicacion(ajustes) {
  const u = UBICACIONES.find((x) => x.id === ajustes.ubicacion) || UBICACIONES[0];
  if (u.id === 'otra') {
    const libre = (ajustes.ubicacionLibre || '').trim() || 'Argentina';
    return { ...u, nombre: libre, busqueda: libre, remoto: /remot/i.test(libre) };
  }
  return u;
}

// Fecha "AAAA-MM-DD" de un instante, según la zona horaria.
export function fechaEn(zona, fecha = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha);
}
