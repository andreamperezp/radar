# Radar de vacantes

Un buscador que trabaja al revés que un reclutador: en vez de buscar candidatas para una empresa, busca empresas para vos.
Solo muestra ofertas **publicadas hoy**, descarta las que no podés tomar desde tu ubicación y nunca te repite una vacante.

Tiene dos formas de buscar:

| | Botón **BUSCAR NUEVO PROYECTO** (web) | **/radar** en Claude Code |
|---|---|---|
| Dónde busca | Get on Board, Himalayas, Remote OK | Lo mismo + LinkedIn, Computrabajo, Bumeran, ZonaJobs, Indeed, InfoJobs |
| Cómo elige | Palabras clave | Claude lee cada oferta contra tu CV y te explica por qué encaja |
| Costo | Gratis | Usa tu plan Pro de Claude, sin pagar nada extra |
| Aviso a Telegram | No | Sí |

Nada corre solo: el radar busca únicamente cuando se lo pedís.

## Seguimiento de postulaciones

Cuando tocás **Ya apliqué** en una vacante:
- queda con el sello verde "✓ Aplicaste el…", en la web y en el historial;
- si aparece otra vacante de la misma empresa, la ves marcada con "⚠️ Ya aplicaste en…" (también en Telegram);
- pasa a la pestaña **Seguimiento**: un tablero Aplicada → Entrevista → Oferta / No quedó, con notas, días desde que
  aplicaste (a los 10 días te sugiere escribirles) y métricas de cuántas te respondieron.

## Usar /radar

1. Una sola vez, creá el archivo `radar/.env.radar` (no se sube a GitHub) con tu clave de la web:
   ```
   APP_PASSWORD=la-misma-clave-que-cargaste-en-vercel
   ```
2. En Claude Code escribí `/radar`. Para una búsqueda puntual en otro lugar: `/radar Madrid, España`.

El comando vive en `~/.claude/skills/radar/SKILL.md` (tu configuración personal de Claude Code) y usa `scripts/radar.mjs`
para hablar con la web.

## Qué hay en cada archivo

```
public/index.html     La web: Hoy, Seguimiento, Historial y Ajustes
api/buscar.js         Botón BUSCAR NUEVO PROYECTO (búsqueda rápida y gratis)
api/candidatas.js     Le da a /radar las vacantes de hoy, tu perfil y lo que ya viste
api/importar.js       Recibe lo que eligió /radar, lo guarda y avisa por Telegram
api/historial.js      Historial, etapas de seguimiento y notas
api/ajustes.js        Ubicación, modalidad y exigencia
api/telegram.js       Conectar tu chat y mandar una prueba
lib/perfil.js         Tu CV resumido: si actualizás el CV, actualizá este texto
lib/fuentes.js        Bolsas de empleo con fecha exacta
lib/match.js          Filtro de hoy y puntaje por palabras clave
lib/almacen.js        Guardado (Vercel Blob) y marcas de "ya aplicaste"
scripts/radar.mjs     Puente entre /radar y la web
```

## Probarlo en tu compu

```bash
npm install
npm run dev
```

Abrí http://localhost:5180. Los datos de prueba quedan en `.datos/`. Para probar `/radar` contra tu compu, agregá
`RADAR_URL=http://localhost:5180` en `.env.radar`.

## Vercel (cuenta personal andreamperezp)

Proyecto `radar`, conectado al repo `andreamperezp/radar`: cada cambio en `main` se publica solo.
Almacenamiento: Blob privado `radar-datos`. Variables:

| Variable | Qué es |
|---|---|
| `APP_PASSWORD` | La clave que te pide la web (y que usa `/radar`) |
| `TELEGRAM_BOT_TOKEN` | El token que te da @BotFather |
| `SITIO_URL`, `BLOB_*` | Ya cargadas; no tocar |

No hace falta `ANTHROPIC_API_KEY`: la parte con Claude corre en Claude Code con tu plan Pro.
