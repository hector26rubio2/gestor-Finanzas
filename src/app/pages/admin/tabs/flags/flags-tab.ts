import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSwitch } from '@spartan-ng/helm/switch';
import { ApiAdminFeatureFlag } from '../../../../core/api/administration.api';
import { I18nService } from '../../../../core/i18n';
import { P } from '../../../../core/permissions';
import { CAPABILITIES } from '../../../../core/store';
import { EmptyStateComponent } from '../../../../ui/empty-state/empty-state';
import { IconComponent } from '../../../../ui/icon';
import { AdminStore } from '../../admin.store';

@Component({
  selector: 'app-admin-flags-tab',
  imports: [DatePipe, FormsModule, HlmBadge, HlmInput, HlmSwitch, EmptyStateComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.sinDatos()) {
      <fin-empty [title]="i18n.t('admin.emptyState.title')" [detail]="i18n.t('admin.emptyState.flags.detail')" />
    } @else {
      <section class="rounded-xl border border-border bg-card">
        <header class="flex flex-wrap items-end justify-between gap-3 p-4">
          <div>
            <h2 class="text-base font-semibold">{{ i18n.t('admin.flags.title') }}</h2>
            <p class="text-sm text-muted-foreground">{{ i18n.t('admin.flags.subtitle') }}</p>
          </div>
          <label class="relative">
            <fin-icon
              name="search"
              class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              hlmInput
              class="w-64 ps-9"
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
              [placeholder]="i18n.t('admin.flags.searchPlaceholder')"
              [attr.aria-label]="i18n.t('admin.flags.searchPlaceholder')"
            />
          </label>
        </header>
        <ul class="divide-y divide-border">
          @for (flag of rows(); track flag.id) {
            <li class="flex items-center gap-3 px-4 py-3">
              <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                <fin-icon name="flag" />
              </span>
              <span class="flex min-w-0 flex-1 flex-col">
                <b class="truncate text-sm">{{ flag.key }}</b>
                <small class="truncate text-xs text-muted-foreground">{{ flag.audience }}</small>
              </span>
              @if (store.flagChanged(flag.key, flag.organizationId, flag.userId)) {
                <span hlmBadge variant="secondary">{{ i18n.t('admin.common.unsaved') }}</span>
              }
              <span class="hidden text-xs text-muted-foreground sm:inline">{{
                flag.updatedAt | date: 'dd MMM, HH:mm'
              }}</span>
              <hlm-switch
                [checked]="store.flagValue(flag.key, flag.organizationId, flag.userId)"
                [disabled]="!caps.allows(P.administracion.banderas.editar)"
                [aria-label]="flag.key"
                (checkedChange)="store.setFlag(flag.key, flag.organizationId, flag.userId, $event)"
              />
            </li>
          }
        </ul>
      </section>
    }
  `,
})
export class FlagsTabComponent {
  readonly store = inject(AdminStore);
  readonly i18n = inject(I18nService);
  readonly caps = inject(CAPABILITIES);
  readonly P = P;

  readonly search = signal('');

  readonly rows = computed(() =>
    this.store
      .flags()
      .filter((flag) => flag.key.toLowerCase().includes(this.search().toLowerCase()))
      .map((flag) => ({
        ...flag,
        id: `${flag.key}|${flag.organizationId}|${flag.userId}`,
        audience: this.audience(flag),
      })),
  );

  private audience(flag: ApiAdminFeatureFlag): string {
    if (flag.userId) return `${this.i18n.t('admin.flags.audience.user')} · ${this.store.userName(flag.userId)}`;
    if (flag.organizationId) {
      const name = this.store.organizations().find((org) => org.id === flag.organizationId)?.name;
      return `${this.i18n.t('admin.flags.audience.organization')}${name ? ' · ' + name : ''}`;
    }
    return this.i18n.t('admin.flags.audience.global');
  }
}
