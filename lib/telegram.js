// Avisos por Telegram. Necesita TELEGRAM_BOT_TOKEN (te lo da @BotFather al crear el bot).
const api = (metodo) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${metodo}`;

export const hayTelegram = () => Boolean(process.env.TELEGRAM_BOT_TOKEN);

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function enviar(chatId, html) {
  const r = await fetch(api('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.description || 'Telegram no aceptó el mensaje');
}

// El @usuario del bot, para armar el link personal t.me/<bot>?start=<código>.
let usuarioBot = null;
export async function nombreDelBot() {
  if (usuarioBot) return usuarioBot;
  const j = await (await fetch(api('getMe'))).json();
  if (!j.ok) throw new Error(j.description || 'No pude leer el bot');
  usuarioBot = j.result.username;
  return usuarioBot;
}

// Busca el chat que tocó "Iniciar" con el link personal (el mensaje llega como "/start <código>").
// Así el mismo bot sirve para varias personas sin mezclar sus avisos.
export async function chatConCodigo(codigo) {
  const j = await (await fetch(api('getUpdates'))).json();
  if (!j.ok) throw new Error(j.description || 'No pude leer los mensajes del bot');
  const mensaje = [...(j.result || [])].reverse()
    .map((u) => u.message)
    .find((m) => m?.chat?.id && typeof m.text === 'string' && m.text.trim() === `/start ${codigo}`);
  return mensaje ? { id: mensaje.chat.id, nombre: mensaje.chat.first_name || mensaje.chat.title || '' } : null;
}

export function mensajeDeVacantes(vacantes, informe, urlSitio) {
  if (!vacantes.length) {
    return `🔎 <b>Radar · ${esc(informe.hoy)}</b>\nHoy revisé ${informe.revisadas} vacantes publicadas en el día para <i>${esc(informe.ubicacion)}</i> y ninguna nueva estuvo a tu altura. Las empresas publican todo el día: probá más tarde.`;
  }
  const items = vacantes.map((v, i) => [
    `<b>${i + 1}. ${esc(v.titulo)}</b> · ${esc(v.empresa)}`,
    `📍 ${esc(v.ubicacion)} · ${esc(v.fuente)} · <b>${v.puntaje}%</b>`,
    v.yaAplicasteEnEmpresa ? `⚠️ Ya aplicaste en ${esc(v.empresa)} (${esc(v.yaAplicasteEnEmpresa.titulo)})` : null,
    `💬 ${esc(v.porQue)}`,
    `✨ ${esc(v.comoDestacar)}`,
    `<a href="${esc(v.url)}">Ver y postular →</a>`,
  ].filter(Boolean).join('\n'));
  const pie = urlSitio ? `\n\n<a href="${esc(urlSitio)}">Abrir el radar</a>` : '';
  return `🎯 <b>${vacantes.length} lugares para postular hoy</b> (${esc(informe.hoy)} · ${esc(informe.ubicacion)})\n\n${items.join('\n\n')}${pie}`;
}
