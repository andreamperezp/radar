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

## Personas con acceso (invitados)

Andrea es la dueña (entra con `APP_PASSWORD`). Desde **Ajustes → Personas con acceso** invita a alguien: el radar crea una
clave solo para esa persona (se muestra una vez, se guarda cifrada) y un mensaje listo para mandarle.

- Cada persona tiene **su propio radar**, separado: perfil, CV, ajustes, vacantes, seguimiento y Telegram
  (`radar/personas/<id>/` en Blob). Andrea sigue en `radar/*.json` como siempre.
- La primera vez, el invitado ve una **bienvenida**: sube su CV en PDF, sus links, los puestos que busca y su inglés;
  después elige dónde trabajar y conecta Telegram con un **link personal** (`t.me/<bot>?start=<código>`), así el mismo
  bot sirve para todos sin mezclar avisos.
- Su **búsqueda rápida** usa sus puestos. La **búsqueda a fondo** usa el plan Pro de Andrea: el invitado toca
  "Pedir búsqueda a fondo", a Andrea le llega un aviso por Telegram y ella corre `/radar <id>` en Claude Code.
  La primera vez Claude lee su CV y su web y le arma el perfil (`perfilTexto`, búsquedas y palabras clave).
- Andrea puede crear una clave nueva, quitar el acceso o devolverlo. Quitar el acceso no borra los datos.

Rutas: `api/personas.js` (solo la dueña), `api/perfil.js` (perfil y CV), `api/pedido.js` (pedir búsqueda).
Cada ruta corre "dentro" del radar de quien hace el pedido (`lib/contexto.js` + `conPerfil` en `lib/acceso.js`).

## Gmail: seguimiento automático de respuestas

`apps-script/RadarGmail.gs` corre gratis en tu cuenta de Google (Apps Script) y cada 3 horas le pasa a la web los
mails nuevos sobre postulaciones. Solo lee: no borra ni responde nada. La web (`api/correo.js` + `lib/correo.js`) decide:

| Mail | Qué pasa |
|---|---|
| "Gracias por postularte" / "recibimos tu CV" | Queda anotado en la tarjeta (📩). Sin aviso. |
| Invitación a entrevista, agenda, Calendly, prueba técnica | Aviso por Telegram y la tarjeta pasa a **Entrevista** |
| Oferta | Aviso por Telegram y la tarjeta pasa a **Oferta** |
| "Lamentablemente…" | La tarjeta pasa a **No quedó**, sin aviso |

Une cada mail con tu postulación por el nombre de la empresa (remitente, dominio o asunto). Si una entrevista llega
desde una plataforma de selección (Greenhouse, Lever, Workable…) y no encuentra la empresa, igual te avisa.
Las tarjetas nunca retroceden de etapa por un mail. Para ajustar las reglas, se edita `lib/correo.js` y se publica.

Instalación: Ajustes → Gmail en la web tiene el paso a paso. Para apagarlo, ejecutá `desinstalar` en el script.

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
