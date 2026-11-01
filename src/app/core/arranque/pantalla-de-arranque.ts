export const CLAVE_DE_ARRANQUE = 'finanzas.arranque';
const DURACION_DE_SALIDA_MS = 240;

export interface PreferenciaDeArranque {
  readonly theme?: string;
  readonly locale?: string;
}

function leer(): PreferenciaDeArranque {
  try {
    const guardado: unknown = JSON.parse(localStorage.getItem(CLAVE_DE_ARRANQUE) ?? '{}');
    return guardado && typeof guardado === 'object' ? (guardado as PreferenciaDeArranque) : {};
  } catch {
    return {};
  }
}

export function guardarPreferenciaDeArranque(parcial: PreferenciaDeArranque): void {
  try {
    localStorage.setItem(CLAVE_DE_ARRANQUE, JSON.stringify({ ...leer(), ...parcial }));
  } catch {
    return;
  }
}

export function retirarPantallaDeArranque(documento: Document = document): void {
  const pantalla = documento.getElementById('arranque');
  if (!pantalla || pantalla.dataset['saliendo'] === 'true') return;
  pantalla.dataset['saliendo'] = 'true';
  pantalla.setAttribute('aria-hidden', 'true');
  setTimeout(() => pantalla.remove(), DURACION_DE_SALIDA_MS);
}
