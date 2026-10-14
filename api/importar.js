// Recibe las vacantes que eligió Claude Code (/radar), las guarda y te avisa por Telegram.
import { autorizado, pedirClave, urlDelSitio } from '../lib/acceso.js';
import { leerAjustes, leerHistorial, sumarAlHistorial, marcarEmpresasAplicadas } from '../lib/almacen.js';
import { enviar, hayTelegram, mensajeDeVacantes } from '../lib/telegram.js';

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function limpiar(v) {
  let url = texto(v.url, 600);
  try { url = new URL(url).toString(); } catch { return null; }
  if (!/^https?:/.test(url) || !texto(v.titulo, 1)) return null;
  return {
    titulo: texto(v.titulo, 200),
    empresa: texto(v.empresa, 120) || 'Sin nombre',
    ubicacion: texto(v.ubicacion, 160),
    url,
    fuente: texto(v.fuente, 60) || 'Web',
    publicada: texto(v.publicada, 40),
    evidenciaFecha: texto(v.evidenciaFecha, 200),
    resumen: texto(v.resumen, 1200),
    salario: texto(v.salario, 80) || null,
    puntaje: Math.max(0, Math.min(100, Math.round(Number(v.puntaje) || 0))),
    porQue: texto(v.porQue, 500),
    comoDestacar: texto(v.comoDestacar, 400),
    idioma: v.idioma === 'en' ? 'en' : 'es',
    modo: 'claude',
    encontrada: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!autorizado(req)) return pedirClave(res);
  const lista = Array.isArray(req.body?.vacantes) ? req.body.vacantes.slice(0, 20).map(limpiar).filter(Boolean) : null;
  if (!lista) return res.status(400).json({ error: 'Mandá { vacantes: [...] }' });

  const historial = await leerHistorial();
  const marcadas = marcarEmpresasAplicadas(lista, historial).sort((a, b) => b.puntaje - a.puntaje);
  const { nuevas } = await sumarAlHistorial(marcadas);
  const repetidas = marcadas.length - nuevas.length;
  const enviadas = marcadas.filter((v) => nuevas.some((n) => n.url === v.url));

  const informe = { hoy: texto(req.body.informe?.hoy, 20), ubicacion: texto(req.body.informe?.ubicacion, 120), revisadas: Number(req.body.informe?.revisadas) || 0 };
  let telegram = 'sin configurar';
  const { telegramChatId } = await leerAjustes();
  if (req.body.avisar !== false && hayTelegram() && telegramChatId) {
    try {
      await enviar(telegramChatId, mensajeDeVacantes(enviadas, informe, urlDelSitio(req)));
      telegram = 'enviado';
    } catch (e) {
      telegram = `error: ${e.message}`;
    }
  } else if (hayTelegram() && !telegramChatId) {
    telegram = 'falta conectar tu chat (Ajustes → Conectar)';
  }
  res.json({ guardadas: nuevas.length, repetidas, telegram, vacantes: enviadas });
}
