// Conectar tu chat de Telegram y mandar un mensaje de prueba.
import { autorizado, pedirClave } from '../lib/acceso.js';
import { leerAjustes, guardarAjustes } from '../lib/almacen.js';
import { enviar, hayTelegram, ultimoChat } from '../lib/telegram.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!autorizado(req)) return pedirClave(res);
  if (!hayTelegram()) return res.status(400).json({ error: 'Falta TELEGRAM_BOT_TOKEN en Vercel.' });
  try {
    if (req.body?.accion === 'conectar') {
      const chat = await ultimoChat();
      if (!chat) return res.status(404).json({ error: 'No encontré mensajes. Abrí tu bot en Telegram, mandale "hola" y volvé a tocar Conectar.' });
      await guardarAjustes({ telegramChatId: chat.id });
      await enviar(chat.id, `👋 ¡Listo${chat.nombre ? `, ${chat.nombre}` : ''}! Desde ahora te aviso por acá las vacantes del día.`);
      return res.json({ ok: true });
    }
    const { telegramChatId } = await leerAjustes();
    if (!telegramChatId) return res.status(400).json({ error: 'Primero conectá tu chat.' });
    await enviar(telegramChatId, '🔔 Prueba del radar: si leés esto, los avisos funcionan.');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
