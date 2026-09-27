import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmSwitch } from '@spartan-ng/helm/switch';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { I18nService } from '@core/i18n';
import { P } from '@core/session';
import { CAPABILITIES } from '@core/state';
import { PagerComponent } from '@ui/pager';
import { SearchFieldComponent } from '@ui/search-field';
import { IconComponent } from '@ui/icon';
import { UiOption, UiSelectComponent } from '@ui/select';
import { AdminLabels } from '@pages/admin/admin-labels';
import { AdminStore } from '@pages/admin/admin.store';
import { AdminFlagsStore } from '@pages/admin/stores/admin-flags.store';
import { AdminPanelComponent } from '@pages/admin/panel/admin-panel';

@Component({
  selector: 'app-admin-flags-tab',
  imports: [
    FormsModule,
    HlmBadge,
    HlmSwitch,
    HlmTableImports,
    AdminPanelComponent,
    PagerComponent,
    SearchFieldComponent,
    IconComponent,
    UiSelectComponent,
  ],
  host: { class: 'flex min-w-0 flex-col gap-4' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-admin-panel [title]="i18n.t('admin.flags.title')" [subtitle]="i18n.t('admin.flags.hierarchyNote')">
      <div panelActions class="flex flex-wrap items-center gap-2">
        <fin-search-field
          class="w-64"
          [value]="search()"
          (valueChange)="buscar($event)"
          [placeholder]="i18n.t('admin.flags.searchPlaceholder')"
          [ariaLabel]="i18n.t('admin.flags.searchPlaceholder')"
        />
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
            @for (row of paginaActual(); track row.key) {
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
                      [checked]="banderas.flagValue(row.key, null, null)"
                      [disabled]="!canEdit()"
                      [aria-label]="row.key + ' · ' + i18n.t('admin.flags.audience.global')"
                      (checkedChange)="banderas.setFlag(row.key, null, null, $event)"
                    />
                    @if (banderas.flagChanged(row.key, null, null)) {
                      <span hlmBadge variant="secondary">{{ i18n.t('admin.common.unsaved') }}</span>
                    }
                  </span>
                </td>
                <td hlmTd class="px-4">
                  @if (organizationId()) {
                    <span class="flex items-center gap-2">
                      <hlm-switch
                        [checked]="banderas.flagValue(row.key, organizationId(), null)"
                        [disabled]="!canEdit() || !banderas.globalFlagValue(row.key)"
                        [aria-label]="row.key + ' · ' + organizationName()"
                        (checkedChange)="banderas.setFlag(row.key, organizationId(), null, $event)"
                      />
                      <span class="text-xs text-muted-foreground">
                        @if (!banderas.globalFlagValue(row.key)) {
                          <fin-icon name="warning" class="[--icon-size:13px]" />
                          {{ i18n.t('admin.flags.blockedByGlobal') }}
                        } @else {
                          {{ sourceLabel(row.key) }}
                        }
                      </span>
                      @if (banderas.flagChanged(row.key, organizationId(), null)) {
                        <span hlmBadge variant="secondary">{{ i18n.t('admin.common.unsaved') }}</span>
                      }
                    </span>
                  }
                </td>
                <td hlmTd class="px-5 text-muted-foreground">{{ labels.dateTime(row.updatedAt) }}</td>
              </tr>
            } @empty {
              <tr hlmTr>
                <td hlmTd colspan="4" class="py-10 text-center text-muted-foreground">{{ i18n.t('table.empty') }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <fin-pager
        class="border-t border-border px-5 py-3"
        [page]="pagina()"
        [size]="tamano"
        [total]="rows().length"
        [summary]="i18n.t('admin.flags.countLabel', { count: rows().length })"
        (pageChange)="pagina.set($event)"
      />
    </app-admin-panel>
  `,
})
export class FlagsTabComponent {
  readonly store = inject(AdminStore);
  readonly banderas = inject(AdminFlagsStore);
  readonly i18n = inject(I18nService);
  readonly labels = inject(AdminLabels);
  private readonly caps = inject(CAPABILITIES);

  readonly search = signal('');
  readonly pagina = signal(1);
  readonly tamano = 10;
  readonly selectedOrganizationId = signal('');

  readonly organizationOptions = computed<readonly UiOption[]>(() => this.store.organizationOptions());
  readonly organizationId = computed(() => this.selectedOrganizationId() || this.store.organizations()[0]?.id || '');
  readonly canEdit = computed(() => this.caps.allows(P.administracion.banderas.editar));
  readonly organizationName = computed(
    () => this.store.organizations().find((org) => org.id === this.organizationId())?.name ?? '',
  );

  readonly rows = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.banderas
      .platformFlags()
      .filter((flag) => !term || `${flag.key} ${this.labels.feature(flag.key)}`.toLowerCase().includes(term));
  });

  readonly paginaActual = computed(() => {
    const inicio =
      (Math.min(this.pagina(), Math.max(1, Math.ceil(this.rows().length / this.tamano))) - 1) * this.tamano;
    return this.rows().slice(inicio, inicio + this.tamano);
  });

  buscar(valor: string): void {
    this.search.set(valor);
    this.pagina.set(1);
  }

  constructor() {
    effect(() => {
      const id = this.organizationId();
      if (id) untracked(() => void this.banderas.cargarBanderasDe(id));
    });
  }

  sourceLabel(key: string): string {
    const source = this.banderas.organizationFlagsOf(this.organizationId())?.find((flag) => flag.key === key)?.source;
    return source ? this.i18n.t(`admin.organizations.flags.source.${source}`) : '';
  }
}
