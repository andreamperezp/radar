// Lee los mails que manda tu script de Gmail y decide qué son.
// Reglas por palabras (gratis): si una regla se equivoca, se ajusta acá y se publica, sin tocar Gmail.
import { normalizarEmpresa } from './almacen.js';

const sinTildes = (s = '') => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const RECHAZO = /lamentablemente|unfortunately|no (seguiremos|continuaremos|avanzaremos)|decidimos (avanzar|continuar|seguir) con otr|otros? (candidat|perfiles)|other candidates|not (be )?moving forward|no (has|ha) sido seleccionad|not been selected|position has been filled|no podremos avanzar|we will not be proceeding|regret to inform/;
const OFERTA = /job offer|offer letter|oferta (laboral|de empleo|formal|de trabajo)|propuesta (laboral|economica|formal)|we are (pleased|happy|excited) to offer|nos complace ofrecerte/;
// Señales fuertes de que te quieren ver: coordinar día y hora, links de agenda, pruebas.
const AVANCE_FUERTE = /calendly|cal\.com|agend(ar|emos|a tu)|coordin(ar|emos) (una |un )?(llamada|reunion|charla|entrevista|videollamada|call)|schedule (a |an )?(call|interview|time|meeting|chat)|book (a )?time|your availability|tu disponibilidad|disponibilidad horaria|prueba tecnica|desafio (tecnico|practico)|challenge|case study|caso practico|assessment|te invitamos a (una|la) entrevista|invite you to (an )?interview|nos gustaria (conocerte|hablar con vos|charlar)|would (like|love) to (meet|speak|talk|chat)|siguiente etapa|next (stage|round)/;
// Señales flojas: aparecen también en "si quedás seleccionada te contactamos para una entrevista".
const AVANCE_FLOJO = /entrevista|interview|next steps?|proximos? pasos/;
// Confirmaciones de que la postulación se envió (portales y empresas), en español e inglés.
// Incluye los de LinkedIn: "tu solicitud se envió a X" / "your application was sent to X".
const RECIBIDO = /gracias por (tu |su )?(postula|aplica|interes|candidatura|solicitud)|hemos recibido|recibimos tu|thank(s| you) for (applying|your application|your interest|submitting)|application (was |has been )?(received|submitted|sent)|your application was sent|we('ve| have) received your|tu (postulacion|candidatura|solicitud) (fue|ha sido|se ha|se) (recibida|enviada|envio|registrada|enviado)|tu solicitud se (envio|ha enviado)|te (postulaste|has postulado)|postulacion (enviada|exitosa|realizada|confirmada)|you applied (to|for)|aplicaste (a|en|para)/;
// "Vieron tu postulación": no cambia la etapa, pero queda anotado.
const VISTA = /(vio|vieron|ha visto|han visto|reviso|revisaron|ha revisado) tu (solicitud|postulacion|candidatura|cv|perfil)|your application was (viewed|reviewed)|viewed your application|application (was )?viewed/;

// Plataformas de selección: un avance que viene de acá vale la pena avisarlo aunque no encuentre la empresa.
const PLATAFORMAS = /greenhouse|lever\.co|workable|ashbyhq|teamtailor|recruitee|smartrecruiters|bamboohr|jobvite|breezy|personio|getonbrd|linkedin|computrabajo|bumeran|zonajobs|himalayas|hiringroom|icims|myworkday/;

// "Si tu perfil avanza, te contactaremos para coordinar una entrevista" no es una invitación.
const CONDICIONAL = /si (tu|su) perfil|si (sos|quedas|resultas|resultás) seleccionad|en caso de (que|avanzar|ser)|te (contactaremos|contactaremos|escribiremos)|nos pondremos en contacto|if (you are |you're )?(selected|shortlisted)|if your (profile|background|experience)|should (you|your)|we will (reach out|contact you|be in touch)|will reach out/;

export function clasificar({ asunto = '', extracto = '' }) {
  const t = sinTildes(`${asunto} ${extracto}`);
  if (RECHAZO.test(t)) return 'rechazo';
  if (OFERTA.test(t)) return 'oferta';
  if (VISTA.test(t)) return 'vista';
  if (RECIBIDO.test(t) && CONDICIONAL.test(t) && !/calendly|cal\.com|book a time|tu disponibilidad|your availability/.test(t)) return 'recibido';
  if (AVANCE_FUERTE.test(t)) return 'avance';
  if (RECIBIDO.test(t)) return 'recibido';
  if (AVANCE_FLOJO.test(t)) return 'avance';
  return 'otro';
}

export const vieneDePlataforma = (de = '') => PLATAFORMAS.test(sinTildes(de));

const GENERICAS = new Set(['grupo', 'group', 'global', 'consulting', 'consultores', 'tech', 'technologies', 'software', 'digital', 'solutions', 'soluciones', 'empresa', 'company', 'banco', 'bank', 'servicios', 'services', 'labs', 'studio']);

// Busca a qué postulación de tu seguimiento corresponde el mail (por nombre de empresa en remitente, asunto o texto).
export function buscarPostulacion(correo, postulaciones) {
  const remitente = sinTildes(correo.de);
  const dominio = (remitente.match(/@([a-z0-9.-]+)/) || [])[1] || '';
  const texto = ` ${sinTildes(`${correo.de} ${correo.asunto} ${correo.extracto}`).replace(/[^a-z0-9]+/g, ' ')} `;
  let mejor = null;
  for (const v of postulaciones) {
    const clave = normalizarEmpresa(v.empresa);
    if (!clave || clave.length < 3) continue;
    const pegada = clave.replace(/ /g, '');
    // "EPAM Systems" también es "epam.com": alcanza con la primera palabra si es distintiva.
    const primera = clave.split(' ')[0];
    const distintiva = primera.length >= 4 && !GENERICAS.has(primera) ? primera : null;
    const puntos = (dominio.includes(pegada) ? 3 : 0)
      + (distintiva && dominio.split('.').some((p) => p === distintiva || p.startsWith(distintiva)) ? 2 : 0)
      + (texto.includes(` ${clave} `) ? 2 : 0)
      + (distintiva && texto.includes(` ${distintiva} `) ? 1 : 0)
      + (remitente.replace(/[^a-z0-9]/g, '').includes(pegada) ? 1 : 0);
    if (puntos && (!mejor || puntos > mejor.puntos)) mejor = { v, puntos };
  }
  return mejor?.v || null;
}

// De qué empresa habla una confirmación, sacado del asunto (para crear la tarjeta si no la tenías).
// "Andrea, tu solicitud se envió a Privera" · "Your application was sent to Privera" · "Privera vio tu solicitud"
export function empresaDelCorreo(asunto = '') {
  const despues = asunto.match(/(?:se envi[oó] a|se ha enviado a|was sent to|application to|applied to|postulaste (?:a|en)|postularte (?:a|en)|applying (?:to|at|for a role at)|aplicar (?:a|en)|viewed by|reviewed by|candidatura (?:a|en|para))\s+(.+?)(?:\s*[!.|]|\s+-\s+|\s+para\s+|\s+for\s+|$)/i);
  const antes = asunto.match(/^(.+?)\s+(?:vio|ha visto|revisó|reviewed|viewed)\s+tu|^(.+?)\s+(?:viewed|reviewed) your/i);
  const crudo = (despues?.[1] || antes?.[1] || antes?.[2] || '').replace(/^["“']|["”']$/g, '').trim();
  // Si lo que quedó nombra un portal ("Diseñador UX en Computrabajo"), no es una empresa: mejor no inventar.
  if (PLATAFORMAS.test(sinTildes(crudo)) || /\b(en|at|on) (computrabajo|bumeran|zonajobs|indeed|infojobs|linkedin)\b/i.test(crudo)) return null;
  return crudo.length >= 2 && crudo.length <= 60 ? crudo : null;
}

// El puesto, cuando se puede: en los mails de LinkedIn el título aparece entre el nombre de la empresa repetido.
export function puestoDelCorreo(extracto = '', empresa = '') {
  if (!empresa) return null;
  const partes = extracto.split(empresa);
  const candidato = (partes[1] || '').replace(/^[\s·,.:–-]+|[\s·,.:–-]+$/g, '').trim();
  return candidato.length >= 3 && candidato.length <= 90 && !/http|solicitud|application|ver |view /i.test(candidato) ? candidato : null;
}

export const ETAPA_POR_TIPO = { avance: 'entrevista', oferta: 'oferta', rechazo: 'rechazada' };
export const ORDEN_ETAPAS = ['aplicada', 'entrevista', 'oferta'];
