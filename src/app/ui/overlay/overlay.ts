import { NgTemplateOutlet } from '@angular/common';
import { HlmScrollAreaImports } from '@spartan-ng/helm/scroll-area';
import { NgScrollbar } from 'ngx-scrollbar';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { I18nService } from '../../core/i18n';
import { IconComponent } from '../icon/icon';

@Component({
  selector: 'fin-overlay',
  imports: [
    NgTemplateOutlet,
    NgScrollbar,
    HlmScrollAreaImports,
    HlmButton,
    HlmDialogImports,
    HlmSheetImports,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #body><ng-content /></ng-template>
    @if (mode() === 'modal') {
      <hlm-dialog state="open" (stateChanged)="onStateChanged($event)">
        <hlm-dialog-content
          *hlmDialogPortal="let ctx"
          [showCloseButton]="false"
          class="flex max-h-[calc(100dvh-2rem)] w-[min(48rem,calc(100vw-2rem))] max-w-none flex-col gap-0 p-0 sm:max-w-none"
        >
          <header class="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-5">
            <h2 hlmDialogTitle class="text-lg font-semibold">{{ title() }}</h2>
            <button hlmBtn variant="ghost" size="icon-sm" hlmDialogClose [attr.aria-label]="i18n.t('overlay.close')">
              <fin-icon name="close" />
            </button>
          </header>
          <ng-scrollbar hlm orientation="vertical" class="min-h-0 flex-1"
            ><div class="p-6"><ng-container [ngTemplateOutlet]="body" /></div
          ></ng-scrollbar>
        </hlm-dialog-content>
      </hlm-dialog>
    } @else {
      <hlm-sheet side="right" state="open" (stateChanged)="onStateChanged($event)">
        <hlm-sheet-content
          *hlmSheetPortal="let ctx"
          [showCloseButton]="false"
          [class]="wide() ? 'data-[side=right]:sm:max-w-3xl' : 'data-[side=right]:sm:max-w-xl'"
          class="w-full gap-0 p-0"
        >
          <header class="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-5">
            <h2 hlmSheetTitle class="text-lg font-semibold">{{ title() }}</h2>
            <button hlmBtn variant="ghost" size="icon-sm" hlmSheetClose [attr.aria-label]="i18n.t('overlay.close')">
              <fin-icon name="close" />
            </button>
          </header>
          <ng-scrollbar hlm orientation="vertical" class="min-h-0 flex-1"
            ><div class="p-6"><ng-container [ngTemplateOutlet]="body" /></div
          ></ng-scrollbar>
        </hlm-sheet-content>
      </hlm-sheet>
    }
  `,
})
export class OverlayComponent {
  readonly i18n = inject(I18nService);
  readonly title = input(this.i18n.t('overlay.defaultTitle'));
  readonly mode = input<'modal' | 'inspector'>('inspector');
  readonly wide = input(false);
  readonly closed = output<void>();
  private emittedClose = false;

  protected onStateChanged(state: 'open' | 'closed'): void {
    if (state !== 'closed' || this.emittedClose) return;
    this.emittedClose = true;
    this.closed.emit();
  }
}
