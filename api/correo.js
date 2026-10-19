// Recibe los mails nuevos que manda tu script de Gmail (Apps Script) y mantiene tu Seguimiento al día solo:
// - "Tu solicitud se envió a X" / "gracias por postularte": pasa la vacante a Aplicada (y si no la tenías, crea la tarjeta).
// - "Vieron tu postulación": queda anotado.
// - Entrevista u oferta: mueve la tarjeta y te avisa por Telegram.
// - "Lamentablemente…": la pasa a No quedó, sin aviso.
// GET devuelve las palabras que tiene que buscar el script en Gmail (así se ajustan sin volver a pegar el script).
import { conPerfil, urlDelSitio } from '../lib/acceso.js';
import { leerHistorial, leerAjustes, guardarAjustes, leerDato, guardarDato, guardarHistorial, EN_SEGUIMIENTO, normalizarEmpresa } from '../lib/almacen.js';
import { clasificar, buscarPostulacion, vieneDePlataforma, empresaDelCorreo, puestoDelCorreo, ETAPA_POR_TIPO, ORDEN_ETAPAS } from '../lib/correo.js';
import { enviar, hayTelegram } from '../lib/telegram.js';

// Palabras para la búsqueda de Gmail (se combinan con OR).
export const PALABRAS_GMAIL = [
  'entrevista', 'interview', 'postulación', 'postulacion', 'postularte', 'postulaste', 'postulado', 'candidatura',
  'solicitud', '"se envió a"', '"was sent to"', 'application', 'applying', 'applied', '"proceso de selección"',
  '"next steps"', '"próximos pasos"', 'oferta', 'offer', 'lamentablemente', 'unfortunately', 'calendly',
  'desafío', 'challenge', 'assessment', '"thank you for your interest"', '"vio tu"', '"viewed your"', '"was viewed"',
];

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function nuevaEtapa(actual, tipo) {
  const destino = tipo === 'recibido' ? 'aplicada' : ETAPA_POR_TIPO[tipo];
  if (!destino) return actual;
  if (!EN_SEGUIMIENTO.includes(actual)) return destino; // estaba como "nueva" o "descartada": ya postulaste
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
  const nuevas = resultado.filter((r) => r.creada).length;
  const partes = [
    cuenta('oferta') && `🎉 ${cuenta('oferta')} oferta${cuenta('oferta') > 1 ? 's' : ''}`,
    cuenta('avance') && `📅 ${cuenta('avance')} para avanzar`,
    cuenta('recibido') && `📩 ${cuenta('recibido') > 1 ? `${cuenta('recibido')} postulaciones confirmadas` : '1 postulación confirmada'}`,
    nuevas && `🆕 ${nuevas} tarjeta${nuevas > 1 ? 's' : ''} nueva${nuevas > 1 ? 's' : ''} en Seguimiento`,
    cuenta('vista') && `👀 ${cuenta('vista')} vieron tu postulación`,
    cuenta('rechazo') && `💌 ${cuenta('rechazo')} no quedó`,
  ].filter(Boolean);
  const ahora = new Date();
  const proxima = cadaHoras ? ` Próxima revisión: ${hora(new Date(ahora.getTime() + cadaHoras * 3600 * 1000))}` : '';
  return partes.length
    ? `✅ <b>Revisión de Gmail completada</b> · ${hora(ahora)}\n${partes.join(' · ')}${cuenta('avance') || cuenta('oferta') ? '\n(Los detalles te llegaron en el mensaje anterior.)' : ''}\n${proxima.trim()}`
    : `✅ <b>Revisión de Gmail completada</b> · ${hora(ahora)}\nSin novedades de tus postulaciones.${proxima}`;
}

// Link de la oferta si vino en el mail (LinkedIn, Computrabajo); si no, el del mail en Gmail.
function linkDeLaOferta(correo) {
  const linkedin = (correo.enlaceOferta || correo.extracto).match(/linkedin\.com\/(?:comm\/)?jobs\/view\/(\d+)/);
  if (linkedin) return `https://www.linkedin.com/jobs/view/${linkedin[1]}`;
  if (/^https?:\/\//.test(correo.enlaceOferta)) return correo.enlaceOferta.split('?')[0];
  return correo.enlace || `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(correo.asunto)}`;
}

export default (req, res) => conPerfil(req, res, async () => {
  if (req.method === 'GET') return res.json({ palabras: PALABRAS_GMAIL });
  if (req.method !== 'POST') return res.status(405).end();
  const correos = Array.isArray(req.body?.correos) ? req.body.correos.slice(0, 80) : null;
  if (!correos) return res.status(400).json({ error: 'Mandá { correos: [...] }' });

  const [historial, ajustes, procesadosAntes] = await Promise.all([leerHistorial(), leerAjustes(), leerDato('correos', [])]);
  // Los mails que antes no se entendieron ("otro") se vuelven a leer con las reglas nuevas.
  const procesados = procesadosAntes.filter((c) => c.tipo !== 'otro');
  const vistos = new Set(procesados.map((c) => c.id));
  const resultado = [];
  let huboCambios = false;

  // Más viejos primero: así "se envió" llega antes que "vieron tu postulación" o la entrevista.
  const ordenados = correos.map((c) => ({
    id: texto(c.id, 100), de: texto(c.de, 200), asunto: texto(c.asunto, 300), extracto: texto(c.extracto, 1500),
    fecha: texto(c.fecha, 40), enlace: texto(c.enlace, 300), enlaceOferta: texto(c.enlaceOferta, 400),
  })).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

  for (const correo of ordenados) {
    if (!correo.id || vistos.has(correo.id)) continue;
    vistos.add(correo.id);

    const tipo = clasificar(correo);
    const fecha = correo.fecha || new Date().toISOString();
    let v = null;
    let creada = false;
    if (tipo !== 'otro') {
      // Primero entre tus postulaciones; si no está, entre todo lo que el radar te mostró.
      v = buscarPostulacion(correo, historial.filter((x) => EN_SEGUIMIENTO.includes(x.estado)))
        || buscarPostulacion(correo, historial.filter((x) => !EN_SEGUIMIENTO.includes(x.estado)));
      // Confirmación de una postulación que hiciste por fuera del radar: se crea la tarjeta.
      const empresa = empresaDelCorreo(correo.asunto);
      if (!v && tipo === 'recibido' && empresa) {
        v = {
          titulo: puestoDelCorreo(correo.extracto, empresa) || `Postulación en ${empresa}`,
          empresa, ubicacion: '', url: linkDeLaOferta(correo),
          fuente: /linkedin/i.test(correo.de) ? 'LinkedIn' : vieneDePlataforma(correo.de) ? correo.de.replace(/<.*>/, '').trim() : 'Mail',
          publicada: '', puntaje: null, porQue: 'La sumé sola: llegó la confirmación de tu postulación por mail.', comoDestacar: '',
          idioma: 'es', modo: 'mail', encontrada: fecha, estado: 'nueva',
        };
        // Si ya hay una tarjeta igual (misma empresa y mismo link), no se duplica.
        if (!historial.some((x) => x.url === v.url || (normalizarEmpresa(x.empresa) === normalizarEmpresa(empresa) && x.modo === 'mail'))) {
          historial.unshift(v);
          creada = true;
        } else {
          v = historial.find((x) => x.url === v.url || (normalizarEmpresa(x.empresa) === normalizarEmpresa(empresa) && x.modo === 'mail'));
        }
      }
    }

    if (v) {
      v.correos = [{ tipo, asunto: correo.asunto, de: correo.de, fecha, enlace: correo.enlace }, ...(v.correos || [])].slice(0, 20);
      const etapa = nuevaEtapa(v.estado, tipo);
      if (etapa !== v.estado) {
        if (!EN_SEGUIMIENTO.includes(v.estado)) v.aplicadaEl = v.aplicadaEl || fecha;
        v.estado = etapa;
        v.etapas = { ...(v.etapas || {}), [etapa]: fecha };
      }
      huboCambios = true;
    }
    procesados.unshift({ id: correo.id, tipo, de: correo.de, asunto: correo.asunto, fecha, enlace: correo.enlace, empresa: v?.empresa || null });

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
    resultado.push({ asunto: correo.asunto, tipo, empresa: v?.empresa || null, etapa: v?.estado || null, creada, telegram });
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
});
