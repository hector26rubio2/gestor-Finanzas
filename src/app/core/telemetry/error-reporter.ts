import { inject, Injectable } from '@angular/core';
import { AdministrationApi } from '../api/administration.api';
import { AppStore } from '../state/store';
import { listenToConsole } from '../utils/console-buffer';
import { buildReport, fingerprintOf, isIgnoredMessage, ErrorOrigin } from './error-report';

const MAX_REPORTS_PER_WINDOW = 10;
const WINDOW_MS = 60_000;
const MAX_DISTINCT_ERRORS = 50;

@Injectable({ providedIn: 'root' })
export class ErrorReporter {
  private readonly api = inject(AdministrationApi);
  private readonly store = inject(AppStore);
  private readonly reported = new Set<string>();
  private readonly stops: Array<() => void> = [];
  private windowStartedAt = 0;
  private windowCount = 0;
  private sending = false;

  start(): void {
    if (this.stops.length || this.store.runtime.mode !== 'api' || typeof window === 'undefined') return;
    this.stops.push(
      listenToConsole((entry, args) => {
        if (entry.level !== 'error') return;
        const failure = args.find((arg): arg is Error => arg instanceof Error);
        this.capture('console', entry.message, failure?.stack);
      }),
    );
    const onError = (event: ErrorEvent) => this.capture('window', event.message, event.error?.stack);
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      this.capture(
        'promise',
        reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason),
        reason?.stack,
      );
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    this.stops.push(
      () => window.removeEventListener('error', onError),
      () => window.removeEventListener('unhandledrejection', onRejection),
    );
  }

  stop(): void {
    this.stops.splice(0).forEach((stop) => stop());
    this.reported.clear();
    this.windowCount = 0;
  }

  private capture(origin: ErrorOrigin, message: string, stack?: string): void {
    const user = this.store.user();
    if (this.sending || !user || !message.trim() || isIgnoredMessage(message)) return;
    const fingerprint = fingerprintOf(origin, message);
    if (this.reported.has(fingerprint) || this.reported.size >= MAX_DISTINCT_ERRORS || !this.hasBudget()) return;
    this.reported.add(fingerprint);

    const report = buildReport(message, {
      origin,
      page: `${location.pathname}${location.search}`,
      organization: this.store.organization(),
      user: { id: user.id, name: user.name, email: user.email },
      userAgent: navigator.userAgent,
      viewport: `${innerWidth}x${innerHeight}`,
      stack,
      at: new Date().toISOString(),
    });
    this.sending = true;
    try {
      this.api.reportClientError(report).subscribe({ error: () => undefined });
    } finally {
      this.sending = false;
    }
  }

  private hasBudget(): boolean {
    const now = Date.now();
    if (now - this.windowStartedAt > WINDOW_MS) {
      this.windowStartedAt = now;
      this.windowCount = 0;
    }
    this.windowCount += 1;
    return this.windowCount <= MAX_REPORTS_PER_WINDOW;
  }
}
