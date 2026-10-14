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

// Busca el último chat que le escribió al bot (así no tenés que buscar tu chat id a mano).
export async function ultimoChat() {
  const r = await fetch(api('getUpdates'));
  const j = await r.json();
  if (!j.ok) throw new Error(j.description || 'No pude leer los mensajes del bot');
  const ultimo = [...(j.result || [])].reverse().find((u) => u.message?.chat?.id);
  return ultimo ? { id: ultimo.message.chat.id, nombre: ultimo.message.chat.first_name || ultimo.message.chat.title || '' } : null;
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
