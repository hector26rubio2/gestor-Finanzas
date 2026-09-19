/**
 * Ruta interna a la que volver después de entrar, o null si no es segura.
 *
 * Solo se acepta un camino de esta misma aplicación: nada que empiece por `//` (URL de
 * protocolo relativo) ni por `/\`, y nunca el propio login ni la pantalla de sin acceso,
 * que devolverían a la persona al mismo sitio del que viene.
 */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  const path = value.split(/[?#]/)[0].replace(/\/$/, '');
  if (path === '' || path === '/login' || path === '/sin-acceso') return null;
  return value;
}
