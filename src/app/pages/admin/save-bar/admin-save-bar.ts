import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { I18nService } from '../../../core/i18n';
import { IconComponent } from '../../../ui/icon';
import { AdminStore } from '../admin.store';

@Component({
  selector: 'app-admin-save-bar',
  imports: [HlmButton, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sticky bottom-4 z-30 block' },
  template: `
    @if (store.dirty() || store.failures().length) {
      <section
        class="rounded-xl border border-border bg-card shadow-pop"
        role="region"
        [attr.aria-label]="i18n.t('admin.save.region')"
      >
        @if (store.failures().length) {
          <div class="border-b border-border p-3 text-sm text-destructive" role="alert">
            <p class="font-medium">{{ i18n.t('admin.save.failedTitle') }}</p>
            <ul class="mt-1 list-disc ps-5">
              @for (failure of store.failures(); track failure.key) {
                <li>
                  {{ failure.label }}
                  @if (failure.reason) {
                    — {{ failure.reason }}
                  }
                </li>
              }
            </ul>
          </div>
        }
        @if (open() && store.dirty()) {
          <ul class="max-h-56 space-y-1 overflow-y-auto border-b border-border p-3 text-sm">
            @for (change of store.changes(); track $index) {
              <li class="flex items-start gap-2">
                <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"></span>
                <span>{{ store.describe(change) }}</span>
              </li>
            }
          </ul>
        }
        <div class="flex flex-wrap items-center justify-between gap-3 p-3">
          <button hlmBtn variant="ghost" size="sm" [attr.aria-expanded]="open()" (click)="open.set(!open())">
            <span aria-live="polite">{{ pendingLabel() }}</span>
            <fin-icon [name]="open() ? 'chevronDown' : 'chevronUp'" />
          </button>
          <div class="flex gap-2">
            <button hlmBtn variant="outline" [disabled]="store.saving()" (click)="store.descartar()">
              {{ i18n.t('admin.save.discard') }}
            </button>
            <button hlmBtn [disabled]="store.saving() || !store.dirty()" (click)="store.guardar()">
              {{ saveLabel() }}
            </button>
          </div>
        </div>
      </section>
    }
  `,
})
export class AdminSaveBarComponent {
  readonly store = inject(AdminStore);
  readonly i18n = inject(I18nService);
  readonly open = signal(false);

  pendingLabel(): string {
    const count = this.store.count();
    if (!count) return this.i18n.t('admin.save.nothingPending');
    return this.i18n.t(count === 1 ? 'admin.save.pendingOne' : 'admin.save.pendingMany', { count });
  }

  saveLabel(): string {
    if (this.store.saving()) return this.i18n.t('admin.save.saving');
    return `${this.i18n.t('admin.save.action')} (${this.store.count()})`;
  }
}
