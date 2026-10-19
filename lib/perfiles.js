// El perfil de cada persona: lo que el radar sabe de ella para buscarle trabajo.
// Andrea ya tiene el suyo escrito en perfil.js; los invitados lo cargan desde la web
// (CV, links, puestos) y Claude lo completa la primera vez que corre /radar para ellos.
import { PERFIL, PUESTOS, BUSQUEDAS, CLAVES_FUERTES, CLAVES_EXTRA } from './perfil.js';
import { leerDato, guardarDato } from './almacen.js';
import { perfilActual } from './contexto.js';

export const NIVELES_INGLES = ['basico', 'intermedio', 'avanzado', 'nativo'];

const PERFIL_ANDREA = {
  nombre: 'Andrea Pérez',
  puestos: PUESTOS,
  linkedin: 'linkedin.com/in/andreamariange',
  portfolio: 'andreaperez.dev',
  web: '',
  ingles: 'basico',
  contexto: '',
  perfilTexto: PERFIL,
  busquedas: BUSQUEDAS,
  claves: CLAVES_FUERTES,
  extra: CLAVES_EXTRA,
};

const VACIO = { nombre: '', puestos: [], linkedin: '', portfolio: '', web: '', ingles: '', contexto: '', cv: null, perfilTexto: '', busquedas: [], claves: [], extra: [] };

export async function leerPerfil() {
  const guardado = await leerDato('perfil', {});
  const base = perfilActual().id === 'andrea' ? PERFIL_ANDREA : { ...VACIO, nombre: perfilActual().nombre };
  return { ...base, ...guardado };
}

export async function guardarPerfil(cambios) {
  const perfil = { ...(await leerDato('perfil', {})), ...cambios, actualizado: new Date().toISOString() };
  await guardarDato('perfil', perfil);
  return leerPerfil();
}

// Lo mínimo para que el radar pueda buscar: qué puestos y un CV o un LinkedIn.
export const perfilCompleto = (p) => Boolean(p.puestos?.length && (p.cv || p.linkedin || p.perfilTexto));

const SOBRAN = new Set(['de', 'del', 'la', 'el', 'en', 'y', 'o', 'para', 'con', 'the', 'of', 'and', 'or', 'a', 'senior', 'sr', 'junior', 'jr', 'semi', 'ssr', 'mid', 'trainee', 'intern', 'pasante']);

// Las palabras que usa la búsqueda rápida. Si Claude ya las afinó (en /radar), se usan esas.
// Siglas cortas que sí importan ("QA", "UX"): se buscan como palabra suelta, no dentro de otras.
const SIGLAS = new Set(['qa', 'ux', 'ui', 'pm', 'po', 'bi', 'hr', 'rh', 'it', 'ai', 'ia', 'ml', 'cx', 'seo', 'sre', 'dba', 'erp', 'sap']);
// Cómo se suelen llamar los avisos de cada familia de puestos.
const PARIENTES = [
  { si: /\b(qa|tester|testing|calidad)\b/, busquedas: ['qa analyst', 'qa tester', 'analista qa'], claves: ['tester', 'testing', 'quality assurance', 'analista de calidad', 'test analyst', 'qa analyst', 'qa engineer', 'automation qa'] },
];
const comoPalabra = (w) => [` ${w} `, ` ${w}/`, `/${w} `, ` ${w}-`, `-${w} `, `(${w})`, ` ${w},`];

export function criteriosDe(p) {
  const puestos = (p.puestos || []).map((x) => x.toLowerCase().trim()).filter(Boolean);
  const palabras = [...new Set(puestos.flatMap((x) => x.split(/[\s/,()-]+/)))];
  const sueltas = palabras.filter((w) => w.length >= 3 && !SOBRAN.has(w) && !SIGLAS.has(w));
  const siglas = palabras.filter((w) => SIGLAS.has(w)).flatMap(comoPalabra);
  const familia = PARIENTES.filter((f) => puestos.some((x) => f.si.test(x)));
  return {
    busquedas: p.busquedas?.length ? p.busquedas : [...new Set([...puestos.slice(0, 2), ...familia.flatMap((f) => f.busquedas), ...puestos.slice(2)])].slice(0, 8),
    claves: p.claves?.length ? p.claves : [...new Set([...puestos, ...sueltas, ...siglas, ...familia.flatMap((f) => f.claves)])],
    extra: p.extra || [],
  };
}

// El texto que lee Claude en /radar para comparar cada vacante.
export function textoParaClaude(p) {
  if (p.perfilTexto) return p.perfilTexto;
  return [
    `${p.nombre || 'Persona sin nombre'}`,
    `Busca: ${(p.puestos || []).join(', ') || '(sin puestos cargados)'}`,
    p.ingles && `Inglés: ${p.ingles}`,
    p.linkedin && `LinkedIn: ${p.linkedin}`,
    p.portfolio && `Portfolio: ${p.portfolio}`,
    p.web && `Web: ${p.web}`,
    p.contexto && `Contexto que contó: ${p.contexto}`,
    p.cv ? 'Tiene CV en PDF (bajalo y leelo).' : 'No subió CV.',
  ].filter(Boolean).join('\n');
}
