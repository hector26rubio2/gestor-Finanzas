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

const FAB_POSITION_KEY = 'finanzas.bug-report.fab.v1';
const FAB_SIZE = 52;
const FAB_MARGIN = 8;
const FAB_DEFAULT = { right: 24, bottom: 24 };
const FAB_DRAG_THRESHOLD = 4;

interface FabPosition {
  right: number;
  bottom: number;
}

function clampFab(position: FabPosition): FabPosition {
  const maxRight = Math.max(FAB_MARGIN, window.innerWidth - FAB_SIZE - FAB_MARGIN);
  const maxBottom = Math.max(FAB_MARGIN, window.innerHeight - FAB_SIZE - FAB_MARGIN);
  return {
    right: Math.min(maxRight, Math.max(FAB_MARGIN, Math.round(position.right))),
    bottom: Math.min(maxBottom, Math.max(FAB_MARGIN, Math.round(position.bottom))),
  };
}

function readFab(): FabPosition {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAB_POSITION_KEY) ?? 'null') as FabPosition | null;
    if (parsed && Number.isFinite(parsed.right) && Number.isFinite(parsed.bottom)) return clampFab(parsed);
  } catch {
    return FAB_DEFAULT;
  }
  return FAB_DEFAULT;
}

function writeFab(position: FabPosition | null): void {
  try {
    if (position) localStorage.setItem(FAB_POSITION_KEY, JSON.stringify(position));
    else localStorage.removeItem(FAB_POSITION_KEY);
  } catch {
    return;
  }
}

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
  host: { '(window:resize)': 'fab.set(clampFab(fab()))' },
  templateUrl: './bug-report.html',
})
export class BugReportButtonComponent {
  protected readonly clampFab = clampFab;
  private readonly store = inject(AppStore);
  private readonly api = inject(FinanceApiClient);
  private readonly consoleBuffer = inject(ConsoleBufferService);
  private readonly router = inject(Router);
  readonly i18n = inject(I18nService);

  readonly fab = signal<FabPosition>(readFab());
  private fabDrag: { pointerX: number; pointerY: number; origin: FabPosition; moved: boolean } | null = null;
  private suppressClick = false;

  readonly open = signal(false);
  readonly step = signal<Step>(1);
  readonly sending = signal(false);
  readonly capturingScreenshot = signal(false);
  readonly screenshotDataUrl = signal<string | null>(null);
  readonly screenshotTooLarge = signal(false);
  readonly screenshotFailed = signal(false);
  readonly githubStatus = signal<string>('disabled');
  readonly githubDetail = signal<string | null>(null);
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

  startFabDrag(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    this.fabDrag = { pointerX: event.clientX, pointerY: event.clientY, origin: this.fab(), moved: false };
  }

  moveFab(event: PointerEvent): void {
    const drag = this.fabDrag;
    if (!drag) return;
    const dx = event.clientX - drag.pointerX;
    const dy = event.clientY - drag.pointerY;
    if (!drag.moved && Math.hypot(dx, dy) < FAB_DRAG_THRESHOLD) return;
    drag.moved = true;
    this.fab.set(clampFab({ right: drag.origin.right - dx, bottom: drag.origin.bottom - dy }));
  }

  endFabDrag(): void {
    const drag = this.fabDrag;
    this.fabDrag = null;
    if (!drag?.moved) return;
    this.suppressClick = true;
    writeFab(this.fab());
  }

  moveFabByKey(event: KeyboardEvent): void {
    if (!event.altKey) return;
    if (event.key === 'Home') {
      event.preventDefault();
      this.resetFab();
      return;
    }
    const step = event.shiftKey ? 64 : 16;
    const { right, bottom } = this.fab();
    const delta: Record<string, FabPosition> = {
      ArrowLeft: { right: right + step, bottom },
      ArrowRight: { right: right - step, bottom },
      ArrowUp: { right, bottom: bottom + step },
      ArrowDown: { right, bottom: bottom - step },
    };
    const next = delta[event.key];
    if (!next) return;
    event.preventDefault();
    this.fab.set(clampFab(next));
    writeFab(this.fab());
  }

  resetFab(): void {
    this.fab.set(FAB_DEFAULT);
    writeFab(null);
  }

  press(): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    this.launch();
  }

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
    this.screenshotFailed.set(false);
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
      const { domToJpeg } = await import('modern-screenshot');
      const dataUrl = await domToJpeg(document.documentElement, {
        scale: 0.5,
        quality: 0.55,
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        filter: (node) => !(node instanceof HTMLElement && node.classList.contains('cdk-overlay-container')),
      });
      const base64Length = dataUrl.length - dataUrl.indexOf(',') - 1;
      if (base64Length > MAX_SCREENSHOT_BASE64_CHARS) {
        this.screenshotTooLarge.set(true);
        this.includeScreenshot.set(false);
      } else {
        this.screenshotDataUrl.set(dataUrl);
      }
    } catch (error) {
      console.warn('No se pudo capturar la pantalla', error);
      this.screenshotDataUrl.set(null);
      this.screenshotFailed.set(true);
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
      this.githubStatus.set(result.githubStatus ?? 'disabled');
      this.githubDetail.set(result.githubDetail ?? null);
      this.step.set(4);
    } catch {
      this.store.toast.set(this.i18n.t('bugReport.toast.failed'));
    } finally {
      this.sending.set(false);
    }
  }
}
