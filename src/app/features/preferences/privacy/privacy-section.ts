import { Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCard } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { ApiRequestError, FinanceApiClient } from '@core/api';
import { I18nService } from '@core/i18n';
import { RemoteBootstrap } from '@core/session';
import { AppStore } from '@core/state';

const ERROR_KEYS: Readonly<Record<string, string>> = {
  'account.delete.sole_owner': 'privacy.delete.error.soleOwner',
  'account.delete.super_admin': 'privacy.delete.error.superAdmin',
  'account.delete.confirmation_mismatch': 'privacy.delete.error.mismatch',
};

@Component({
  selector: 'app-privacy-section',
  imports: [HlmAlertDialogImports, HlmButton, HlmCard, HlmInput],
  templateUrl: './privacy-section.html',
})
export class PrivacySectionComponent {
  readonly i18n = inject(I18nService);
  private readonly store = inject(AppStore);
  private readonly api = inject(FinanceApiClient);
  private readonly arranque = inject(RemoteBootstrap);

  readonly exporting = signal(false);
  readonly deleting = signal(false);
  readonly dialogOpen = signal(false);
  readonly typedEmail = signal('');
  readonly errorMessage = signal('');
  readonly accountEmail = computed(() => this.store.user()?.email ?? '');
  readonly confirmationMatches = computed(
    () => this.accountEmail() !== '' && this.typedEmail().trim().toLowerCase() === this.accountEmail().toLowerCase(),
  );

  async exportData(): Promise<void> {
    this.exporting.set(true);
    try {
      const blob = await firstValueFrom(this.api.exportMyData());
      this.download(blob, `finanzas-datos-${new Date().toISOString().slice(0, 10)}.json`);
      this.store.toast.set(this.i18n.t('privacy.export.done'));
    } catch {
      this.store.toast.set(this.i18n.t('privacy.export.error'));
    } finally {
      this.exporting.set(false);
    }
  }

  openDialog(): void {
    this.typedEmail.set('');
    this.errorMessage.set('');
    this.dialogOpen.set(true);
  }

  onDialogState(state: 'open' | 'closed'): void {
    if (state === 'closed') this.dialogOpen.set(false);
  }

  onEmailInput(event: Event): void {
    this.typedEmail.set((event.target as HTMLInputElement).value);
  }

  async deleteAccount(context: { close: () => void }): Promise<void> {
    if (!this.confirmationMatches() || this.deleting()) return;
    this.deleting.set(true);
    this.errorMessage.set('');
    try {
      await firstValueFrom(this.api.deleteMyAccount(this.typedEmail().trim()));
      context.close();
      await this.arranque.cerrarSesion();
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.deleting.set(false);
    }
  }

  private messageFor(error: unknown): string {
    const key = error instanceof ApiRequestError ? ERROR_KEYS[error.problem.code ?? ''] : undefined;
    return this.i18n.t(key ?? 'privacy.delete.error.generic');
  }

  private download(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
}
