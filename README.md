# Radar de vacantes

Un buscador que trabaja al revés que un reclutador: en vez de buscar candidatas para una empresa, busca empresas para vos.
Cada vez que tocás **BUSCAR NUEVO PROYECTO** (y solo una vez por día, a las 12:00 de Argentina):

1. Junta ofertas **publicadas hoy** en Get on Board, Himalayas y Remote OK.
2. Claude busca en internet (LinkedIn, Computrabajo, Bumeran, ZonaJobs, Indeed, InfoJobs…) ofertas de hoy para la ubicación que elegiste. Solo las acepta si ve que se publicaron hoy.
3. Descarta las que no podés tomar (por ejemplo "remoto solo EE. UU.").
4. Claude lee cada una contra tu CV, le pone un puntaje y te explica por qué encaja y qué contar al postular.
5. Te muestra las mejores (mínimo 3 si las hay; si hoy no hay tantas, te lo dice en vez de rellenar con vacantes viejas) y te avisa por Telegram.

## Qué hay en cada archivo

```
public/index.html     La web (botón, resultados, historial y ajustes)
api/buscar.js         El botón BUSCAR NUEVO PROYECTO
api/diario.js         La búsqueda automática diaria (Vercel Cron, ver vercel.json)
api/ajustes.js        Ubicación, modalidad y exigencia
api/historial.js      Vacantes ya vistas y marcadas como aplicada / descartada
api/telegram.js       Conectar tu chat y mandar una prueba
lib/perfil.js         Tu CV resumido: si actualizás el CV, actualizá este texto
lib/fuentes.js        Bolsas de empleo con fecha exacta
lib/match.js          Búsqueda web y evaluación con Claude
lib/ubicaciones.js    Lugares que podés elegir
```

## Probarlo en tu compu

```bash
npm install
npm run dev
```

Abrí http://localhost:5180. Sin `ANTHROPIC_API_KEY` funciona en "modo palabras clave" (solo bolsas de empleo).
Los datos de prueba quedan en `.datos/`.

## Publicarlo en Vercel (cuenta personal andreamperezp)

1. Subí la carpeta a un repo de GitHub e importalo en Vercel (Framework: **Other**, sin build).
2. En **Storage → Create → Blob**, creá un store privado y conectalo al proyecto (agrega `BLOB_STORE_ID` solo).
   Ya está hecho: el store se llama `radar-datos`.
3. En **Settings → Environment Variables** cargá:

| Variable | Qué es |
|---|---|
| `ANTHROPIC_API_KEY` | Tu clave de console.anthropic.com |
| `APP_PASSWORD` | La clave que te va a pedir la web (inventala) |
| `CRON_SECRET` | Un texto largo al azar; protege la búsqueda diaria |
| `TELEGRAM_BOT_TOKEN` | El token que te da @BotFather |

4. Redeploy. Entrá a la web → **Ajustes** → **Conectar** Telegram.

## Costo aproximado

Cada búsqueda usa Claude Opus 5.5 con búsqueda web (hasta 10 búsquedas, a USD 10 cada 1.000) y lee bastantes páginas:
calculá entre USD 0,20 y 0,40 por búsqueda. Con la diaria más algunas manuales, unos USD 8 a 15 por mes.
Para gastar menos, bajá `max_uses` en `lib/match.js`.
