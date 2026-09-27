import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdministrationApi, ApiBugReportResult, ApiClientError, ApiPage } from '@core/api';
import { CAPABILITIES, AppStore } from '@core/state';
import { I18nService } from '@core/i18n';
import { P } from '@core/session';

const serverStatus = (status: string): string => (status === 'new' ? 'open' : status);

@Injectable()
export class AdminErrorsStore {
  private readonly api = inject(AdministrationApi);
  private readonly app = inject(AppStore);
  private readonly caps = inject(CAPABILITIES);
  private readonly i18n = inject(I18nService);

  readonly items = signal<readonly ApiClientError[]>([]);
  readonly page = signal(1);
  readonly total = signal(0);
  readonly size = signal(25);
  readonly status = signal('');

  primeraPagina(): Promise<ApiPage<ApiClientError>> {
    return firstValueFrom(this.api.adminErrors(1, this.size(), serverStatus(this.status())));
  }

  aplicar(page: ApiPage<ApiClientError>): void {
    this.items.set(
      page.items.map((error) => ({
        ...error,
        status: ((error.status as string) === 'open' ? 'new' : error.status) as ApiClientError['status'],
        occurrences: error.occurrences ?? 1,
        affectedUsers: error.affectedUsers ?? 1,
        version: error.version ?? error.source,
        traceId: error.traceId ?? null,
        lastSeenAt: error.lastSeenAt ?? error.createdAt ?? new Date().toISOString(),
      })),
    );
    this.page.set(page.page);
    this.total.set(page.total);
  }

  async cargar(page: number, status = this.status()): Promise<void> {
    if (!this.caps.allows(P.administracion.errores.listar)) return;
    try {
      this.status.set(status);
      this.aplicar(await firstValueFrom(this.api.adminErrors(page, this.size(), serverStatus(status))));
    } catch {
      this.app.toast.set(this.i18n.t('admin.toast.loadFailed'));
    }
  }

  async crearIssueDeGithub(error: ApiClientError): Promise<ApiBugReportResult> {
    const result = await firstValueFrom(this.api.createErrorGithubIssue(error.id));
    if (result.githubIssueUrl) {
      this.items.update((xs) =>
        xs.map((x) => (x.id === error.id ? { ...x, githubIssueUrl: result.githubIssueUrl ?? undefined } : x)),
      );
    }
    return result;
  }

  async actualizar(error: ApiClientError, status: ApiClientError['status']): Promise<void> {
    await firstValueFrom(this.api.updateAdminError(error.id, status));
    this.items.update((xs) => xs.map((x) => (x.id === error.id ? { ...x, status } : x)));
  }
}
