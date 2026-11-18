const PREFIJO = 'finanzas.tabla.columnas-ocultas.';

export function leerColumnasOcultas(clave: string): string[] | null {
  try {
    const crudo = localStorage.getItem(PREFIJO + clave);
    if (crudo === null) return null;
    const valor: unknown = JSON.parse(crudo);
    return Array.isArray(valor) && valor.every((item) => typeof item === 'string') ? valor : null;
  } catch {
    return null;
  }
}

export function guardarColumnasOcultas(clave: string, ocultas: readonly string[]): void {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(ocultas));
  } catch {
    return;
  }
}
