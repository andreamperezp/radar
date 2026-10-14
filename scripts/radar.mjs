// Puente entre Claude Code (/radar) y tu web.
//   node scripts/radar.mjs candidatas <archivo.json>   → guarda las vacantes de hoy + tu perfil en el archivo
//   node scripts/radar.mjs publicar <archivo.json>     → manda las elegidas a la web y a Telegram
// Lee la dirección y la clave de radar/.env.radar (RADAR_URL y APP_PASSWORD). Ese archivo no se sube a GitHub.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(join(raiz, '.env.radar')); } catch { /* sin archivo: usamos variables del entorno */ }

const SITIO = (process.env.RADAR_URL || 'https://radar-eight-topaz.vercel.app').replace(/\/$/, '');
const CLAVE = process.env.APP_PASSWORD;
const [, , accion, archivo] = process.argv;

if (!CLAVE) {
  console.error(`Falta APP_PASSWORD. Creá el archivo ${join(raiz, '.env.radar')} con:\nAPP_PASSWORD=tu-clave`);
  process.exit(1);
}
if (!['candidatas', 'publicar'].includes(accion) || !archivo) {
  console.error('Uso: node scripts/radar.mjs candidatas|publicar <archivo.json>');
  process.exit(1);
}

async function pedir(ruta, cuerpo) {
  const r = await fetch(`${SITIO}/api/${ruta}`, {
    method: cuerpo ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'x-clave': CLAVE },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(150000),
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.error || `La web respondió ${r.status}`);
  return datos;
}

try {
  if (accion === 'candidatas') {
    const datos = await pedir('candidatas');
    await writeFile(archivo, JSON.stringify(datos, null, 2));
    console.log(`Hoy ${datos.hoy} · ${datos.ubicacion}`);
    console.log(`Bolsas: ${datos.informe.encontradasHoy} publicadas hoy, ${datos.candidatas.length} que podés tomar y no viste.`);
    console.log(`Ya viste ${datos.yaVistas.length} vacantes; aplicaste en ${datos.empresasDondeAplicaste.length} empresas.`);
    if (datos.informe.avisos.length) console.log(`Avisos: ${datos.informe.avisos.join(' | ')}`);
    console.log(`Detalle completo en ${archivo}`);
  } else {
    const cuerpo = JSON.parse(await readFile(archivo, 'utf8'));
    const r = await pedir('importar', cuerpo);
    console.log(`Guardadas: ${r.guardadas} · ya estaban: ${r.repetidas} · Telegram: ${r.telegram}`);
    for (const v of r.vacantes) console.log(`- ${v.puntaje}% ${v.titulo} · ${v.empresa}${v.yaAplicasteEnEmpresa ? ' (ya aplicaste en esta empresa)' : ''}`);
  }
} catch (e) {
  console.error(`No pude hablar con la web (${SITIO}): ${e.message}`);
  process.exit(1);
}
