// Quién está usando el radar en este pedido. Así cada función guarda y lee los datos de esa persona
// sin tener que pasar el perfil de mano en mano.
import { AsyncLocalStorage } from 'node:async_hooks';

const contexto = new AsyncLocalStorage();

// Andrea es la dueña: sus datos viven donde siempre (radar/*.json).
export const DUENA = { id: 'andrea', nombre: 'Andrea', admin: true };

export const conContexto = (perfil, fn) => contexto.run(perfil, fn);
export const perfilActual = () => contexto.getStore() || DUENA;
