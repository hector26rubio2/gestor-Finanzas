import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSwitch } from '@spartan-ng/helm/switch';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { I18nService } from '../../../../core/i18n';
import { P } from '../../../../core/session/permissions';
import { CAPABILITIES } from '../../../../core/state/store';
import { EmptyStateComponent } from '../../../../ui/empty-state/empty-state';
import { IconComponent } from '../../../../ui/icon/icon';
import { UiOption, UiSelectComponent } from '../../../../ui/select/select';
import { AdminLabels } from '../../admin-labels';
import { AdminStore } from '../../admin.store';
import { AdminPanelComponent } from '../../panel/admin-panel';

@Component({
  selector: 'app-admin-flags-tab',
  imports: [
    DatePipe,
    FormsModule,
    HlmBadge,
    HlmInput,
    HlmSwitch,
    HlmTableImports,
    AdminPanelComponent,
    EmptyStateComponent,
    IconComponent,
    UiSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.sinDatos()) {
      <fin-empty [title]="i18n.t('admin.emptyState.title')" [detail]="i18n.t('admin.emptyState.flags.detail')" />
    } @else {
      <app-admin-panel [title]="i18n.t('admin.flags.title')" [subtitle]="i18n.t('admin.flags.subtitle')">
        <div panelActions class="flex flex-wrap items-center gap-2">
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
          <fin-select
            class="w-64"
            [ngModel]="organizationId()"
            (ngModelChange)="selectedOrganizationId.set($event)"
            [options]="organizationOptions()"
            [ariaLabel]="i18n.t('admin.flags.organizationAriaLabel')"
          />
        </div>
        <div hlmTableContainer>
          <table hlmTable [attr.aria-label]="i18n.t('admin.flags.title')">
            <thead hlmTHead class="bg-muted/40">
              <tr hlmTr>
                <th hlmTh class="h-11 px-5">{{ i18n.t('admin.flags.column.feature') }}</th>
                <th hlmTh class="w-56 px-4">{{ i18n.t('admin.flags.audience.global') }}</th>
                <th hlmTh class="w-72 px-4">
                  {{ i18n.t('admin.flags.audience.organization') }}
                  @if (organizationName()) {
                    <span class="font-normal text-muted-foreground">· {{ organizationName() }}</span>
                  }
                </th>
                <th hlmTh class="w-44 px-5">{{ i18n.t('admin.flags.column.updated') }}</th>
              </tr>
            </thead>
            <tbody hlmTBody>
              @for (row of rows(); track row.key) {
                <tr hlmTr>
                  <td hlmTd class="px-5 py-3">
                    <div class="flex items-center gap-3">
                      <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                        <fin-icon name="flag" />
                      </span>
                      <span class="flex min-w-0 flex-col">
                        <b class="text-sm">{{ labels.feature(row.key) }}</b>
                        <small class="text-xs text-muted-foreground">{{ row.key }}</small>
                      </span>
                    </div>
                  </td>
                  <td hlmTd class="px-4">
                    <span class="flex items-center gap-2">
                      <hlm-switch
                        [checked]="store.flagValue(row.key, null, null)"
                        [disabled]="!canEdit()"
                        [aria-label]="row.key + ' · ' + i18n.t('admin.flags.audience.global')"
                        (checkedChange)="store.setFlag(row.key, null, null, $event)"
                      />
                      @if (store.flagChanged(row.key, null, null)) {
                        <span hlmBadge variant="secondary">{{ i18n.t('admin.common.unsaved') }}</span>
                      }
                    </span>
                  </td>
                  <td hlmTd class="px-4">
                    @if (organizationId()) {
                      <span class="flex items-center gap-2">
                        <hlm-switch
                          [checked]="store.flagValue(row.key, organizationId(), null)"
                          [disabled]="!canEdit()"
                          [aria-label]="row.key + ' · ' + organizationName()"
                          (checkedChange)="store.setFlag(row.key, organizationId(), null, $event)"
                        />
                        <span class="text-xs text-muted-foreground">{{ sourceLabel(row.key) }}</span>
                        @if (store.flagChanged(row.key, organizationId(), null)) {
                          <span hlmBadge variant="secondary">{{ i18n.t('admin.common.unsaved') }}</span>
                        }
                      </span>
                    }
                  </td>
                  <td hlmTd class="px-5 text-muted-foreground">{{ row.updatedAt | date: 'dd MMM, HH:mm' }}</td>
                </tr>
              } @empty {
                <tr hlmTr>
                  <td hlmTd colspan="4" class="py-10 text-center text-muted-foreground">{{ i18n.t('table.empty') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </app-admin-panel>
    }
  `,
})
export class FlagsTabComponent {
  readonly store = inject(AdminStore);
  readonly i18n = inject(I18nService);
  readonly labels = inject(AdminLabels);
  private readonly caps = inject(CAPABILITIES);

  readonly search = signal('');
  readonly selectedOrganizationId = signal('');

  readonly organizationOptions = computed<readonly UiOption[]>(() => this.store.organizationOptions());
  readonly organizationId = computed(() => this.selectedOrganizationId() || this.store.organizations()[0]?.id || '');
  readonly canEdit = computed(() => this.caps.allows(P.administracion.banderas.editar));
  readonly organizationName = computed(
    () => this.store.organizations().find((org) => org.id === this.organizationId())?.name ?? '',
  );

  readonly rows = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.store
      .platformFlags()
      .filter((flag) => !term || `${flag.key} ${this.labels.feature(flag.key)}`.toLowerCase().includes(term));
  });

  constructor() {
    effect(() => {
      const id = this.organizationId();
      if (id) untracked(() => void this.store.cargarBanderasDe(id));
    });
  }

  sourceLabel(key: string): string {
    const source = this.store.organizationFlagsOf(this.organizationId())?.find((flag) => flag.key === key)?.source;
    return source ? this.i18n.t(`admin.organizations.flags.source.${source}`) : '';
  }
}
