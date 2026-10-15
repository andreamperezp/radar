/**
 * Radar · Gmail
 * Cada 3 horas revisa tus mails nuevos sobre postulaciones y se los pasa a tu radar.
 * El radar decide si es "gracias por postularte", una entrevista, una oferta o un rechazo,
 * actualiza tu Seguimiento, te avisa por Telegram cuando avanzás y al final te manda
 * "✅ Revisión completada" con el resumen.
 * No usa Claude: no consume nada de tu plan.
 *
 * Este script solo LEE mails: no borra, no responde ni mueve nada en tu Gmail.
 *
 * Instalación (una sola vez):
 *  1. Pegá este código en script.google.com → Nuevo proyecto.
 *  2. Engranaje "Configuración del proyecto" → Propiedades del script → agregá:
 *       RADAR_URL     https://radar-eight-topaz.vercel.app
 *       APP_PASSWORD  (la misma clave de tu web)
 *  3. Elegí la función "instalar" arriba y tocá Ejecutar. Google te pide permiso: aceptalo.
 */

// Palabras que suelen aparecer en mails de procesos de selección (español e inglés).
var PALABRAS = [
  'entrevista', 'interview', 'postulación', 'postulacion', 'postularte', 'postulaste', 'candidatura',
  'application', 'applying', 'proceso de selección', '"next steps"', '"próximos pasos"', 'oferta', 'offer',
  'lamentablemente', 'unfortunately', 'calendly', 'desafío', 'challenge', 'assessment', '"thank you for your interest"'
];

// Cada cuántas horas revisar. Google solo deja programar cada 1, 2, 4, 6, 8 o 12 horas,
// así que el script se despierta cada hora y revisa solo cuando pasaron estas horas.
var CADA_HORAS = 3;

function instalar() {
  // Borra programaciones anteriores de este script y crea una que se despierta cada hora.
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('cadaHora').timeBased().everyHours(1).create();
  revisar();
  Logger.log('Listo: el radar va a revisar tu Gmail cada ' + CADA_HORAS + ' horas y te avisa por Telegram al terminar.');
}

// La llama Google cada hora: revisa solo si ya pasaron CADA_HORAS desde la última vez.
function cadaHora() {
  var ultima = Number(PropertiesService.getScriptProperties().getProperty('ULTIMA_REVISION')) || 0;
  var margen = 10 * 60 * 1000; // 10 minutos de tolerancia, porque Google no es exacto con la hora
  if (Date.now() - ultima >= CADA_HORAS * 3600 * 1000 - margen) revisar();
}

function desinstalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  Logger.log('Listo: el radar dejó de revisar tu Gmail.');
}

function revisar() {
  var props = PropertiesService.getScriptProperties();
  var sitio = (props.getProperty('RADAR_URL') || '').replace(/\/$/, '');
  var clave = props.getProperty('APP_PASSWORD');
  if (!sitio || !clave) throw new Error('Faltan RADAR_URL o APP_PASSWORD en Propiedades del script.');

  var ahora = Date.now();
  // La primera vez mira los últimos 3 días; después, desde la última revisión.
  var desde = Number(props.getProperty('ULTIMA_REVISION')) || ahora - 3 * 24 * 3600 * 1000;
  var yo = Session.getActiveUser().getEmail().toLowerCase();

  var consulta = 'after:' + Math.floor(desde / 1000) + ' -in:sent -in:chats -category:promotions -category:social {' + PALABRAS.join(' ') + '}';
  var hilos = GmailApp.search(consulta, 0, 40);
  var correos = [];

  hilos.forEach(function (hilo) {
    hilo.getMessages().forEach(function (m) {
      if (m.getDate().getTime() < desde) return;
      if (m.getFrom().toLowerCase().indexOf(yo) !== -1) return; // tus propios mails
      correos.push({
        id: m.getId(),
        de: m.getFrom(),
        asunto: m.getSubject(),
        extracto: m.getPlainBody().replace(/\s+/g, ' ').slice(0, 1500),
        fecha: m.getDate().toISOString(),
        enlace: 'https://mail.google.com/mail/u/0/#all/' + hilo.getId()
      });
    });
  });

  // Aunque no haya mails, avisa al radar que revisó (así la web muestra "última revisión").
  var respuesta = UrlFetchApp.fetch(sitio + '/api/correo', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-clave': clave },
    payload: JSON.stringify({ correos: correos, resumen: true, cadaHoras: CADA_HORAS }),
    muteHttpExceptions: true
  });
  if (respuesta.getResponseCode() !== 200) {
    throw new Error('El radar respondió ' + respuesta.getResponseCode() + ': ' + respuesta.getContentText());
  }
  Logger.log(correos.length ? respuesta.getContentText() : 'Sin mails nuevos de postulaciones.');
  props.setProperty('ULTIMA_REVISION', String(ahora));
}
