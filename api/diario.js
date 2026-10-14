// Búsqueda automática de todos los días (la dispara Vercel Cron, ver vercel.json).
import { leerAjustes, sumarAlHistorial } from '../lib/almacen.js';
import { buscarProyectos } from '../lib/match.js';
import { enviar, hayTelegram, mensajeDeVacantes } from '../lib/telegram.js';
import { urlDelSitio } from '../lib/acceso.js';

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  // En producción solo Vercel Cron puede dispararla (así nadie más gasta tus créditos de Claude).
  const secreto = process.env.CRON_SECRET;
  if ((secreto || process.env.VERCEL_ENV === 'production') && req.headers.authorization !== `Bearer ${secreto}`) {
    return res.status(401).end();
  }
  const ajustes = await leerAjustes();
  const { vacantes, informe } = await buscarProyectos(ajustes);
  await sumarAlHistorial(vacantes);
  if (hayTelegram() && ajustes.telegramChatId) {
    await enviar(ajustes.telegramChatId, mensajeDeVacantes(vacantes, informe, urlDelSitio(req)));
  }
  res.json({ enviadas: vacantes.length, informe });
}
