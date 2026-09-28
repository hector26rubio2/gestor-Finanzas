export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  const path = value.split(/[?#]/)[0].replace(/\/$/, '');
  if (path === '' || path === '/login' || path === '/sin-acceso') return null;
  return value;
}
