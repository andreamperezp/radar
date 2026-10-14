// Botón "BUSCAR NUEVO PROYECTO".
import { autorizado, pedirClave, urlDelSitio } from '../lib/acceso.js';
import { leerAjustes, sumarAlHistorial } from '../lib/almacen.js';
import { buscarProyectos } from '../lib/match.js';
import { enviar, hayTelegram, mensajeDeVacantes } from '../lib/telegram.js';

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!autorizado(req)) return pedirClave(res);
  try {
    const ajustes = await leerAjustes();
    const { vacantes, informe } = await buscarProyectos(ajustes);
    await sumarAlHistorial(vacantes);
    if (req.body?.avisar && hayTelegram() && ajustes.telegramChatId && vacantes.length) {
      await enviar(ajustes.telegramChatId, mensajeDeVacantes(vacantes, informe, urlDelSitio(req)))
        .catch((e) => informe.avisos.push(`Telegram: ${e.message}`));
    }
    res.json({ vacantes, informe });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
