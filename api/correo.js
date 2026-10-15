// Recibe los mails nuevos que manda tu script de Gmail (Apps Script), los une a tus postulaciones
// y te avisa por Telegram solo cuando avanzás (entrevista u oferta).
import { autorizado, pedirClave, urlDelSitio } from '../lib/acceso.js';
import { leerHistorial, leerAjustes, guardarAjustes, leerDato, guardarDato, guardarHistorial, EN_SEGUIMIENTO } from '../lib/almacen.js';
import { clasificar, buscarPostulacion, vieneDePlataforma, ETAPA_POR_TIPO, ORDEN_ETAPAS } from '../lib/correo.js';
import { enviar, hayTelegram } from '../lib/telegram.js';

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function nuevaEtapa(actual, tipo) {
  const destino = ETAPA_POR_TIPO[tipo];
  if (!destino) return actual;
  if (destino === 'rechazada') return actual === 'oferta' ? actual : 'rechazada';
  // Nunca retrocede: un mail de entrevista no saca una tarjeta de "Oferta".
  return ORDEN_ETAPAS.indexOf(destino) > ORDEN_ETAPAS.indexOf(actual) ? destino : actual;
}

function avisoTelegram(tipo, correo, v, sitio) {
  const titulo = tipo === 'oferta' ? '🎉 <b>¡Te llegó una oferta!</b>' : '📅 <b>¡Avanzás a la siguiente etapa!</b>';
  const quien = v ? `<b>${esc(v.empresa)}</b> · ${esc(v.titulo)}` : '<i>No la encontré en tu seguimiento: revisala.</i>';
  return [
    titulo,
    quien,
    `✉️ ${esc(correo.asunto)}`,
    `De: ${esc(correo.de)}`,
    correo.enlace ? `<a href="${esc(correo.enlace)}">Abrir el mail en Gmail →</a>` : null,
    v ? `La moví a <b>${tipo === 'oferta' ? 'Oferta' : 'Entrevista'}</b> en tu radar.${sitio ? ` <a href="${esc(sitio)}">Ver seguimiento</a>` : ''}` : null,
  ].filter(Boolean).join('\n');
}

const hora = (d) => d.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' });

function resumenDeRevision(resultado, cadaHoras) {
  const cuenta = (t) => resultado.filter((r) => r.tipo === t).length;
  const partes = [
    cuenta('oferta') && `🎉 ${cuenta('oferta')} oferta${cuenta('oferta') > 1 ? 's' : ''}`,
    cuenta('avance') && `📅 ${cuenta('avance')} para avanzar`,
    cuenta('recibido') && `📩 ${cuenta('recibido') > 1 ? `${cuenta('recibido')} postulaciones recibidas` : '1 postulación recibida'}`,
    cuenta('rechazo') && `💌 ${cuenta('rechazo')} no quedó`,
  ].filter(Boolean);
  const ahora = new Date();
  const proxima = cadaHoras ? ` Próxima revisión: ${hora(new Date(ahora.getTime() + cadaHoras * 3600 * 1000))}` : '';
  return partes.length
    ? `✅ <b>Revisión de Gmail completada</b> · ${hora(ahora)}\n${partes.join(' · ')}${cuenta('avance') || cuenta('oferta') ? '\n(Los detalles te llegaron en el mensaje anterior.)' : ''}\n${proxima.trim()}`
    : `✅ <b>Revisión de Gmail completada</b> · ${hora(ahora)}\nSin novedades de tus postulaciones.${proxima}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!autorizado(req)) return pedirClave(res);
  const correos = Array.isArray(req.body?.correos) ? req.body.correos.slice(0, 50) : null;
  if (!correos) return res.status(400).json({ error: 'Mandá { correos: [...] }' });

  const [historial, ajustes, procesados] = await Promise.all([leerHistorial(), leerAjustes(), leerDato('correos', [])]);
  const vistos = new Set(procesados.map((c) => c.id));
  const postulaciones = historial.filter((v) => EN_SEGUIMIENTO.includes(v.estado));
  const resultado = [];
  let huboCambios = false;

  for (const crudo of correos) {
    const correo = {
      id: texto(crudo.id, 100), de: texto(crudo.de, 200), asunto: texto(crudo.asunto, 300),
      extracto: texto(crudo.extracto, 1500), fecha: texto(crudo.fecha, 40), enlace: texto(crudo.enlace, 300),
    };
    if (!correo.id || vistos.has(correo.id)) continue;
    vistos.add(correo.id);

    const tipo = clasificar(correo);
    const v = tipo === 'otro' ? null : buscarPostulacion(correo, postulaciones);
    const registro = { id: correo.id, tipo, de: correo.de, asunto: correo.asunto, fecha: correo.fecha || new Date().toISOString(), enlace: correo.enlace, empresa: v?.empresa || null };
    procesados.unshift(registro);

    if (v) {
      v.correos = [{ tipo, asunto: correo.asunto, de: correo.de, fecha: registro.fecha, enlace: correo.enlace }, ...(v.correos || [])].slice(0, 20);
      const etapa = nuevaEtapa(v.estado, tipo);
      if (etapa !== v.estado) {
        v.estado = etapa;
        v.etapas = { ...(v.etapas || {}), [etapa]: new Date().toISOString() };
      }
      huboCambios = true;
    }

    let telegram = null;
    const avisar = (tipo === 'avance' || tipo === 'oferta') && (v || vieneDePlataforma(correo.de));
    if (avisar && hayTelegram() && ajustes.telegramChatId) {
      try {
        await enviar(ajustes.telegramChatId, avisoTelegram(tipo, correo, v, urlDelSitio(req)));
        telegram = 'enviado';
      } catch (e) {
        telegram = `error: ${e.message}`;
      }
    }
    resultado.push({ asunto: correo.asunto, tipo, empresa: v?.empresa || null, etapa: v?.estado || null, telegram });
  }

  if (huboCambios) await guardarHistorial(historial);
  await guardarDato('correos', procesados.slice(0, 500));
  await guardarAjustes({ correoRevisado: new Date().toISOString() });

  // Al final de cada revisión, un resumen corto a Telegram (aunque no haya novedades).
  let resumen = null;
  if (req.body.resumen && hayTelegram() && ajustes.telegramChatId) {
    try {
      await enviar(ajustes.telegramChatId, resumenDeRevision(resultado, Number(req.body.cadaHoras) || null));
      resumen = 'enviado';
    } catch (e) {
      resumen = `error: ${e.message}`;
    }
  }
  res.json({ procesados: resultado.length, resultado, resumen });
}
