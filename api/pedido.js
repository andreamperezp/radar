// Un invitado pide una búsqueda a fondo con Claude. Como usa el plan de la dueña, no corre sola:
// se le avisa a Andrea por Telegram y ella la corre con /radar <id> cuando puede.
import { conPerfil, urlDelSitio } from '../lib/acceso.js';
import { leerAjustes, guardarAjustes, leerDe } from '../lib/almacen.js';
import { leerPerfil, perfilCompleto } from '../lib/perfiles.js';
import { enviar, hayTelegram } from '../lib/telegram.js';

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default (req, res) => conPerfil(req, res, async (quien) => {
  if (req.method !== 'POST') return res.status(405).end();
  if (quien.admin) return res.status(400).json({ error: 'Vos corrés /radar directamente.' });

  if (req.body?.accion === 'cancelar') {
    await guardarAjustes({ pedido: null });
    return res.json({ pedido: null });
  }

  const perfil = await leerPerfil();
  if (!perfilCompleto(perfil)) return res.status(400).json({ error: 'Primero completá tu perfil: tus puestos y tu CV o LinkedIn.' });
  const actual = (await leerAjustes()).pedido;
  if (actual) return res.json({ pedido: actual, yaEstaba: true });

  const pedido = { fecha: new Date().toISOString(), nota: String(req.body?.nota || '').trim().slice(0, 300) };
  await guardarAjustes({ pedido });

  // Aviso a la dueña (su chat de Telegram está en sus propios ajustes).
  let aviso = 'sin avisar';
  const chatDuena = (await leerDe('andrea', 'ajustes', {})).telegramChatId;
  if (hayTelegram() && chatDuena) {
    try {
      await enviar(chatDuena, [
        `🙋 <b>${esc(perfil.nombre || quien.nombre)}</b> pidió una búsqueda a fondo.`,
        pedido.nota ? `💬 "${esc(pedido.nota)}"` : null,
        `Cuando puedas, en Claude Code escribí: <code>/radar ${esc(quien.id)}</code>`,
        `<a href="${esc(urlDelSitio(req))}">Ver personas con acceso</a>`,
      ].filter(Boolean).join('\n'));
      aviso = 'enviado';
    } catch (e) {
      aviso = `error: ${e.message}`;
    }
  }
  res.json({ pedido, aviso });
});
