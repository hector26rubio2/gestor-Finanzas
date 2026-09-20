export type ErrorOrigin = 'console' | 'window' | 'promise';

export interface ErrorReportContext {
  origin: ErrorOrigin;
  page: string;
  organization: { id: string; name: string } | null;
  user: { id: string; name: string; email: string };
  userAgent: string;
  viewport: string;
  stack?: string;
  at: string;
}

const MAX_MESSAGE = 1900;
const MAX_STACK = 3000;
const MAX_FINGERPRINT_INPUT = 300;
const IGNORED_MESSAGES = [/ResizeObserver loop/i, /^Script error\.?$/i];

export function isIgnoredMessage(message: string): boolean {
  return IGNORED_MESSAGES.some((pattern) => pattern.test(message.trim()));
}

export function fingerprintOf(origin: ErrorOrigin, message: string): string {
  const normalized = message
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '#')
    .replace(/\d+/g, '#')
    .slice(0, MAX_FINGERPRINT_INPUT);
  let hash = 0x811c9dc5;
  for (const char of `${origin}:${normalized}`) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `web:${origin}:${hash.toString(16).padStart(8, '0')}`;
}

export function buildReport(message: string, context: ErrorReportContext) {
  const trimmed = message.trim().slice(0, MAX_MESSAGE);
  const withStack = context.stack ? { ...context, stack: context.stack.slice(0, MAX_STACK) } : context;
  return {
    source: 'web' as const,
    fingerprint: fingerprintOf(context.origin, trimmed),
    message: trimmed,
    contextJson: JSON.stringify(withStack),
  };
}
