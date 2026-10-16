// Conectar el Telegram de cada persona y mandar un mensaje de prueba.
// Cada persona tiene un código propio: abre t.me/<bot>?start=<código>, toca "Iniciar" y después "Conectar".
import { randomBytes } from 'node:crypto';
import { conPerfil } from '../lib/acceso.js';
import { leerAjustes, guardarAjustes } from '../lib/almacen.js';
import { enviar, hayTelegram, chatConCodigo, nombreDelBot } from '../lib/telegram.js';

async function codigoPropio() {
  const a = await leerAjustes();
  if (a.telegramCodigo) return a.telegramCodigo;
  const codigo = randomBytes(6).toString('hex');
  await guardarAjustes({ telegramCodigo: codigo });
  return codigo;
}

export default (req, res) => conPerfil(req, res, async (perfil) => {
  if (req.method !== 'POST') return res.status(405).end();
  if (!hayTelegram()) return res.status(400).json({ error: 'Falta TELEGRAM_BOT_TOKEN en Vercel.' });
  try {
    const accion = req.body?.accion;
    if (accion === 'link') {
      const [bot, codigo] = await Promise.all([nombreDelBot(), codigoPropio()]);
      return res.json({ link: `https://t.me/${bot}?start=${codigo}`, bot });
    }
    if (accion === 'conectar') {
      const chat = await chatConCodigo(await codigoPropio());
      if (!chat) return res.status(404).json({ error: 'Todavía no veo tu "Iniciar". Abrí el link de Telegram, tocá Iniciar (Start) y volvé a tocar Conectar.' });
      await guardarAjustes({ telegramChatId: chat.id });
      await enviar(chat.id, `👋 ¡Listo${chat.nombre ? `, ${chat.nombre}` : ''}! Soy tu radar de vacantes. Desde ahora te aviso por acá las vacantes que encajan con vos.`);
      return res.json({ ok: true });
    }
    const { telegramChatId } = await leerAjustes();
    if (!telegramChatId) return res.status(400).json({ error: 'Primero conectá tu chat.' });
    await enviar(telegramChatId, `🔔 Prueba del radar de ${perfil.nombre}: si leés esto, los avisos funcionan.`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
