// Puente entre Claude Code (/radar) y la web.
//   node scripts/radar.mjs candidatas <archivo.json>        → vacantes de hoy + perfil de la persona
//   node scripts/radar.mjs cv <archivo.pdf>                 → baja el CV en PDF de la persona
//   node scripts/radar.mjs perfil <archivo.json>            → guarda el perfil que armó Claude (perfilTexto, puestos, búsquedas, claves)
//   node scripts/radar.mjs publicar <archivo.json>          → manda las elegidas a la web y a Telegram de la persona
//   node scripts/radar.mjs personas                         → lista quién tiene acceso y quién pidió búsqueda
// Agregá --perfil <id> para trabajar para otra persona (por ejemplo --perfil benjamin). Sin eso, es para Andrea.
// Lee la dirección y la clave de radar/.env.radar (RADAR_URL y APP_PASSWORD). Ese archivo no se sube a GitHub.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(join(raiz, '.env.radar')); } catch { /* sin archivo: usamos variables del entorno */ }

const SITIO = (process.env.RADAR_URL || 'https://radar-eight-topaz.vercel.app').replace(/\/$/, '');
const CLAVE = process.env.APP_PASSWORD;

const args = process.argv.slice(2);
const i = args.indexOf('--perfil');
const PERFIL = i >= 0 ? args.splice(i, 2)[1] : '';
const [accion, archivo] = args;

if (!CLAVE) {
  console.error(`Falta APP_PASSWORD. Creá el archivo ${join(raiz, '.env.radar')} con:\nAPP_PASSWORD=tu-clave`);
  process.exit(1);
}
const ACCIONES = ['candidatas', 'cv', 'perfil', 'publicar', 'personas'];
if (!ACCIONES.includes(accion) || (accion !== 'personas' && !archivo)) {
  console.error('Uso: node scripts/radar.mjs candidatas|cv|perfil|publicar <archivo> [--perfil <id>]  ·  node scripts/radar.mjs personas');
  process.exit(1);
}

const encabezados = { 'Content-Type': 'application/json', 'x-clave': CLAVE, ...(PERFIL ? { 'x-perfil': PERFIL } : {}) };

async function pedir(ruta, cuerpo) {
  const r = await fetch(`${SITIO}/api/${ruta}`, {
    method: cuerpo ? 'POST' : 'GET', headers: encabezados,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined, signal: AbortSignal.timeout(150000),
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.error || `La web respondió ${r.status}`);
  return datos;
}

try {
  const para = PERFIL ? ` (para ${PERFIL})` : '';
  if (accion === 'candidatas') {
    const d = await pedir('candidatas');
    await writeFile(archivo, JSON.stringify(d, null, 2));
    console.log(`Persona: ${d.persona.nombre} · hoy ${d.hoy} · ${d.ubicacion}`);
    console.log(`Puestos: ${(d.puestos || []).join(', ') || '(sin cargar)'} · inglés: ${d.ingles || '?'}`);
    console.log(`Perfil armado por Claude: ${d.perfilArmadoPorClaude ? 'sí' : 'NO, hay que armarlo (leé el CV y los links)'} · CV: ${d.cv ? `${d.cv.nombre}, subido ${d.cv.subido.slice(0, 10)}` : 'no subió'}`);
    console.log(`Bolsas: ${d.informe.encontradasHoy} publicadas hoy, ${d.candidatas.length} que puede tomar y no vio.`);
    console.log(`Ya vio ${d.yaVistas.length} vacantes; aplicó en ${d.empresasDondeAplicaste.length} empresas.`);
    if (d.informe.avisos.length) console.log(`Avisos: ${d.informe.avisos.join(' | ')}`);
    console.log(`Detalle completo en ${archivo}`);
  } else if (accion === 'cv') {
    const r = await fetch(`${SITIO}/api/perfil?cv=1`, { headers: encabezados, signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `La web respondió ${r.status}`);
    const pdf = Buffer.from(await r.arrayBuffer());
    await writeFile(archivo, pdf);
    console.log(`CV guardado en ${archivo} (${Math.round(pdf.length / 1024)} KB)${para}`);
  } else if (accion === 'perfil') {
    const cuerpo = JSON.parse(await readFile(archivo, 'utf8'));
    const r = await pedir('perfil', cuerpo);
    console.log(`Perfil guardado${para}: ${r.perfil.puestos.length} puestos, ${r.perfil.busquedas?.length || 0} búsquedas, ${r.perfil.claves?.length || 0} palabras clave.`);
  } else if (accion === 'publicar') {
    const cuerpo = JSON.parse(await readFile(archivo, 'utf8'));
    const r = await pedir('importar', cuerpo);
    console.log(`Guardadas${para}: ${r.guardadas} · ya estaban: ${r.repetidas} · Telegram: ${r.telegram}`);
    for (const v of r.vacantes) console.log(`- ${v.puntaje}% ${v.titulo} · ${v.empresa}${v.yaAplicasteEnEmpresa ? ' (ya aplicó en esta empresa)' : ''}`);
  } else {
    const { personas } = await pedir('personas');
    if (!personas.length) console.log('Todavía no invitaste a nadie.');
    for (const p of personas) {
      console.log(`- ${p.nombre} (/radar ${p.id}) · ${p.activo ? 'con acceso' : 'sin acceso'} · perfil: ${p.perfil.puestos.length ? p.perfil.puestos.join(', ') : 'sin completar'}${p.perfil.cv ? ' · CV ✓' : ''} · Telegram ${p.telegram ? '✓' : '✗'}${p.pedido ? ` · 🙋 PIDIÓ BÚSQUEDA el ${p.pedido.fecha.slice(0, 10)}` : ''}`);
    }
  }
} catch (e) {
  console.error(`No pude hablar con la web (${SITIO}): ${e.message}`);
  process.exit(1);
}
