import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { HlmInput } from '@spartan-ng/helm/input';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FinanceApiClient } from '../../core/api/api-client';
import { ConsoleBufferService } from '../../core/utils/console-buffer';
import { I18nService } from '../../core/i18n';
import { AppStore } from '../../core/state/store';
import { APP_VERSION } from '../../core/utils/version';
import { FieldComponent } from '../../ui/field/field';
import { IconComponent } from '../../ui/icon/icon';
import { UiOption, UiSelectComponent } from '../../ui/select/select';
import { OverlayComponent } from '../../ui/overlay/overlay';

type Step = 1 | 2 | 3 | 4;

/** Tope alineado con `MaxScreenshotBase64Length` en el backend (deja margen bajo el límite de 1 MB por petición de Kestrel). */
const MAX_SCREENSHOT_BASE64_CHARS = 700_000;

@Component({
  selector: 'app-bug-report',
  imports: [
    HlmButton,
    HlmCheckbox,
    HlmTextarea,
    HlmInput,
    CommonModule,
    FormsModule,
    FieldComponent,
    IconComponent,
    UiSelectComponent,
    OverlayComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bug-report.html',
})
export class BugReportButtonComponent {
  private readonly store = inject(AppStore);
  private readonly api = inject(FinanceApiClient);
  private readonly consoleBuffer = inject(ConsoleBufferService);
  private readonly router = inject(Router);
  readonly i18n = inject(I18nService);

  readonly open = signal(false);
  readonly step = signal<Step>(1);
  readonly sending = signal(false);
  readonly capturingScreenshot = signal(false);
  readonly screenshotDataUrl = signal<string | null>(null);
  readonly screenshotTooLarge = signal(false);
  readonly includeScreenshot = signal(true);
  readonly githubIssueUrl = signal<string | null>(null);

  title = '';
  description = '';
  stepsToReproduce = '';
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

  readonly severityOptions = computed<readonly UiOption[]>(() => [
    { value: 'low', label: this.i18n.t('bugReport.severity.low') },
    { value: 'medium', label: this.i18n.t('bugReport.severity.medium') },
    { value: 'high', label: this.i18n.t('bugReport.severity.high') },
    { value: 'critical', label: this.i18n.t('bugReport.severity.critical') },
  ]);

  readonly consoleTail = () => this.consoleBuffer.snapshot().slice(-10);

  launch(): void {
    this.reset();
    this.open.set(true);
  }

  close(): void {
    this.open.set(false);
  }

  private reset(): void {
    this.step.set(1);
    this.title = '';
    this.description = '';
    this.stepsToReproduce = '';
    this.severity = 'medium';
    this.screenshotDataUrl.set(null);
    this.screenshotTooLarge.set(false);
    this.includeScreenshot.set(true);
    this.githubIssueUrl.set(null);
    this.sending.set(false);
  }

  canAdvanceFromStep1(): boolean {
    return this.title.trim().length > 0 && this.description.trim().length > 0;
  }

  async next(): Promise<void> {
    if (this.step() === 1 && !this.canAdvanceFromStep1()) return;
    if (this.step() === 2) {
      this.step.set(3);
      await this.captureScreenshot();
      return;
    }
    this.step.update((s) => (s < 4 ? ((s + 1) as Step) : s));
  }

  back(): void {
    this.step.update((s) => (s > 1 ? ((s - 1) as Step) : s));
  }

  /** Captura la pantalla actual, comprimida, solo si sigue marcado el checkbox al llegar a la revisión. */
  private async captureScreenshot(): Promise<void> {
    if (!this.includeScreenshot() || this.screenshotDataUrl()) return;
    this.capturingScreenshot.set(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(document.body, { scale: 0.35, useCORS: true, logging: false });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.45);
      const base64Length = dataUrl.length - dataUrl.indexOf(',') - 1;
      if (base64Length > MAX_SCREENSHOT_BASE64_CHARS) {
        this.screenshotTooLarge.set(true);
        this.includeScreenshot.set(false);
      } else {
        this.screenshotDataUrl.set(dataUrl);
      }
    } catch {
      // La captura es un extra, nunca debe impedir enviar el reporte.
      this.screenshotDataUrl.set(null);
    } finally {
      this.capturingScreenshot.set(false);
    }
  }

  toggleScreenshot(include: boolean): void {
    this.includeScreenshot.set(include);
    if (!include) this.screenshotDataUrl.set(null);
  }

  private collectSystemInfo(): Record<string, unknown> {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      screen: `${screen.width}x${screen.height}`,
      url: this.router.url,
      timestamp: new Date().toISOString(),
      appVersion: APP_VERSION,
      user: this.store.user()?.email ?? null,
      organization: this.store.organization()?.name ?? null,
    };
  }

  async submit(): Promise<void> {
    if (!this.canAdvanceFromStep1() || this.sending()) return;
    this.sending.set(true);
    try {
      const screenshot = this.includeScreenshot() ? this.screenshotDataUrl() : null;
      const result = await firstValueFrom(
        this.api.reportBug({
          title: this.title.trim(),
          description: this.description.trim(),
          stepsToReproduce: this.stepsToReproduce.trim() || undefined,
          severity: this.severity,
          url: this.router.url,
          consoleLogJson: JSON.stringify(this.consoleBuffer.snapshot().slice(-50)),
          systemInfoJson: JSON.stringify(this.collectSystemInfo()),
          screenshotBase64: screenshot ? screenshot.slice(screenshot.indexOf(',') + 1) : undefined,
        }),
      );
      this.githubIssueUrl.set(result.githubIssueUrl);
      this.step.set(4);
    } catch {
      this.store.toast.set(this.i18n.t('bugReport.toast.failed'));
    } finally {
      this.sending.set(false);
    }
  }
}
