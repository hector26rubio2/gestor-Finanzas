import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmSwitch } from '@spartan-ng/helm/switch';
import { ApiAdminOrganization } from '../../../../core/api/administration.api';
import { I18nService } from '../../../../core/i18n';
import { P } from '../../../../core/session/permissions';
import { CAPABILITIES, AppStore } from '../../../../core/state/store';
import { ConfirmDialogComponent } from '../../../../ui/confirm-dialog/confirm-dialog';
import { EmptyStateComponent } from '../../../../ui/empty-state/empty-state';
import { DataTableComponent, TableColumn } from '../../../../ui/data-table/data-table';
import { FinTableCellDirective } from '../../../../ui/data-table/table-cell.directive';
import { IconComponent } from '../../../../ui/icon/icon';
import { SheetPanelComponent } from '../../../../ui/sheet-panel/sheet-panel';
import { AdminStore } from '../../admin.store';
import { AdminGridComponent } from '../../panel/admin-grid';
import { AdminPanelComponent } from '../../panel/admin-panel';
import { OrganizationSheetComponent } from './organization-sheet';

@Component({
  selector: 'app-admin-organizations-tab',
  imports: [
    FormsModule,
    HlmBadge,
    HlmButton,
    HlmInput,
    HlmLabel,
    HlmSwitch,
    AdminGridComponent,
    AdminPanelComponent,
    DataTableComponent,
    FinTableCellDirective,
    EmptyStateComponent,
    IconComponent,
    OrganizationSheetComponent,
    SheetPanelComponent,
    ConfirmDialogComponent,
  ],
  host: { class: 'flex min-w-0 flex-col gap-4' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.sinDatos()) {
      <fin-empty
        [title]="i18n.t('admin.emptyState.title')"
        [detail]="i18n.t('admin.emptyState.organizations.detail')"
      />
    } @else {
      <fin-confirm-dialog
        [open]="confirmingConsolidation()"
        [title]="i18n.t('admin.organizations.consolidate.title')"
        [description]="i18n.t('admin.organizations.consolidate.description')"
        [confirmLabel]="i18n.t('admin.organizations.consolidate.confirm')"
        [cancelLabel]="i18n.t('admin.common.cancel')"
        (confirmed)="consolidate()"
        (dismissed)="confirmingConsolidation.set(false)"
      />
      <fin-confirm-dialog
        [open]="!!deleting()"
        [title]="i18n.t('admin.organizations.delete.title', { name: deleting()?.name ?? '' })"
        [description]="i18n.t('admin.organizations.delete.description')"
        [confirmLabel]="i18n.t('admin.organizations.delete.confirm')"
        [cancelLabel]="i18n.t('admin.common.cancel')"
        (confirmed)="confirmDelete()"
        (dismissed)="deleting.set(null)"
      />
      <app-admin-panel
        [title]="i18n.t('admin.organizations.title')"
        [subtitle]="i18n.t('admin.organizations.subtitle')"
      >
        <div panelActions class="flex flex-wrap items-center gap-2">
          @if (canConsolidate()) {
            <button hlmBtn variant="outline" (click)="confirmingConsolidation.set(true)">
              <fin-icon name="layers" /> {{ i18n.t('admin.organizations.consolidate.action') }}
            </button>
          }
          <label class="flex items-center gap-2 text-xs text-muted-foreground">
            <hlm-switch
              [checked]="showArchived()"
              [aria-label]="i18n.t('admin.organizations.showArchived')"
              (checkedChange)="showArchived.set($event)"
            />
            {{ i18n.t('admin.organizations.showArchived') }}
          </label>
          @if (caps.allows(P.administracion.organizaciones.crear)) {
            <button hlmBtn (click)="creating.set(true)">
              <fin-icon name="plus" /> {{ i18n.t('admin.organizations.actions.create') }}
            </button>
          }
        </div>
        <app-admin-grid>
          <fin-table
            [columns]="columns()"
            [rows]="rows()"
            [selectable]="false"
            [pageSize]="15"
            [tableLabel]="i18n.t('admin.organizations.title')"
          >
            <ng-template finCell="organization" let-row>
              <div class="flex items-center gap-3">
                <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                  <fin-icon name="organization" />
                </span>
                <span class="flex min-w-0 flex-col">
                  <b class="text-sm">{{ row.raw.name }}</b>
                  <small class="text-xs text-muted-foreground">{{ row.raw.slug }}</small>
                </span>
              </div>
            </ng-template>
            <ng-template finCell="default" let-row>
              @if (store.isDefaultOrganization(row.raw)) {
                <span hlmBadge>{{ i18n.t('admin.organizations.defaultBadge') }}</span>
              } @else if (canMakeDefault(row.raw)) {
                <button hlmBtn variant="ghost" size="sm" (click)="store.setDefaultOrganization(row.raw)">
                  {{ i18n.t('admin.organizations.makeDefault') }}
                </button>
              }
            </ng-template>
            <ng-template finCell="active" let-row>
              <span class="flex items-center gap-2">
                @if (caps.allows(P.administracion.organizaciones.editar)) {
                  <hlm-switch
                    [checked]="store.isOrganizationActive(row.raw)"
                    [disabled]="store.isDefaultOrganization(row.raw)"
                    [aria-label]="i18n.t('admin.organizations.activeToggle', { name: row.raw.name })"
                    (checkedChange)="store.setOrganizationActive(row.raw, $event)"
                  />
                }
                <span class="text-xs text-muted-foreground">{{ row.active }}</span>
              </span>
            </ng-template>
            <ng-template finCell="actions" let-row>
              <span class="inline-flex items-center gap-2">
                @if (canDelete(row.raw)) {
                  <button
                    hlmBtn
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    class="text-destructive"
                    [attr.aria-label]="i18n.t('admin.organizations.delete.action', { name: row.raw.name })"
                    [attr.title]="i18n.t('admin.organizations.delete.action', { name: row.raw.name })"
                    (click)="deleting.set(row.raw)"
                  >
                    <fin-icon name="trash" />
                  </button>
                }
                <button hlmBtn variant="outline" size="sm" (click)="managingId.set(row.raw.id)">
                  {{ i18n.t('admin.organizations.manage') }}
                </button>
              </span>
            </ng-template>
          </fin-table>
        </app-admin-grid>
      </app-admin-panel>
    }
    <app-organization-sheet [organization]="managing()" (closed)="managingId.set(null)" />
    <fin-sheet-panel
      [open]="creating()"
      [title]="i18n.t('admin.organizations.actions.create')"
      [subtitle]="i18n.t('admin.organizations.drawer.subtitle')"
      [footer]="true"
      (closed)="creating.set(false)"
    >
      <label hlmLabel class="flex items-start flex-col gap-1.5">
        {{ i18n.t('admin.organizations.drawer.nameLabel') }}
        <input hlmInput [ngModel]="name()" (ngModelChange)="name.set($event)" />
      </label>
      <label hlmLabel class="flex items-start flex-col gap-1.5">
        {{ i18n.t('admin.organizations.drawer.currencyLabel') }}
        <input hlmInput maxlength="3" [ngModel]="currency()" (ngModelChange)="currency.set($event.toUpperCase())" />
      </label>
      <div sheetFooter class="flex gap-2">
        <button hlmBtn variant="outline" (click)="creating.set(false)">
          <fin-icon name="close" /> {{ i18n.t('admin.common.cancel') }}
        </button>
        <button hlmBtn [disabled]="saving() || !name().trim()" (click)="create()">
          <fin-icon name="check" /> {{ i18n.t('admin.roles.drawer.save') }}
        </button>
      </div>
    </fin-sheet-panel>
  `,
})
export class OrganizationsTabComponent {
  readonly store = inject(AdminStore);
  readonly i18n = inject(I18nService);
  readonly caps = inject(CAPABILITIES);
  private readonly app = inject(AppStore);
  readonly P = P;

  readonly creating = signal(false);
  readonly showArchived = signal(false);
  readonly deleting = signal<ApiAdminOrganization | null>(null);
  readonly confirmingConsolidation = signal(false);
  readonly search = signal('');
  readonly name = signal('');
  readonly currency = signal('COP');
  readonly saving = signal(false);
  readonly managingId = signal<string | null>(null);
  readonly managing = computed<ApiAdminOrganization | null>(
    () => this.store.organizations().find((org) => org.id === this.managingId()) ?? null,
  );

  readonly visibleOrganizations = computed(() =>
    this.store.organizations().filter((org) => this.showArchived() || this.store.isOrganizationActive(org)),
  );

  readonly columns = computed<TableColumn[]>(() => [
    { key: 'organization', label: this.i18n.t('admin.organizations.column.organization') },
    { key: 'currency', label: this.i18n.t('admin.organizations.column.currency'), facet: true },
    { key: 'members', label: this.i18n.t('admin.organizations.column.members') },
    { key: 'roles', label: this.i18n.t('admin.organizations.column.roles'), essential: false },
    { key: 'default', label: this.i18n.t('admin.organizations.column.default'), sortKey: 'defaultSort' },
    { key: 'active', label: this.i18n.t('admin.organizations.column.active'), facet: true },
    { key: 'actions', label: this.i18n.t('admin.common.actions'), sortable: false, hideable: false },
  ]);

  readonly rows = computed(() =>
    this.visibleOrganizations().map((org) => ({
      id: org.id,
      organization: `${org.name} ${org.slug}`,
      currency: org.baseCurrency,
      members: org.memberCount,
      roles: this.store.roleCountOf(org.id),
      default: this.store.isDefaultOrganization(org) ? this.i18n.t('admin.organizations.defaultBadge') : '',
      defaultSort: this.store.isDefaultOrganization(org) ? '0' : '1',
      active: this.store.isOrganizationActive(org)
        ? this.i18n.t('admin.users.state.active')
        : this.i18n.t('admin.organizations.inactiveBadge'),
      raw: org,
    })),
  );

  readonly canConsolidate = computed(
    () =>
      this.caps.allows(P.administracion.organizaciones.editar) &&
      this.store.organizations().length > 1 &&
      this.store.organizations().some((org) => org.isDefault),
  );

  canDelete(org: ApiAdminOrganization): boolean {
    return this.caps.allows(P.administracion.organizaciones.editar) && !org.isActive && !org.isDefault;
  }

  async confirmDelete(): Promise<void> {
    const organization = this.deleting();
    this.deleting.set(null);
    if (organization) await this.store.eliminarOrganizacion(organization);
  }

  async consolidate(): Promise<void> {
    this.confirmingConsolidation.set(false);
    await this.store.consolidarOrganizaciones();
  }

  canMakeDefault(org: ApiAdminOrganization): boolean {
    return this.caps.allows(P.administracion.organizaciones.editar) && this.store.isOrganizationActive(org);
  }

  async create(): Promise<void> {
    this.saving.set(true);
    try {
      await this.store.crearOrganizacion({ name: this.name().trim(), baseCurrency: this.currency() });
      this.name.set('');
      this.creating.set(false);
    } catch (error) {
      const reason = error instanceof Error ? error.message : '';
      this.app.toast.set(
        reason
          ? this.i18n.t('admin.toast.createOrganizationFailedReason', { reason })
          : this.i18n.t('admin.toast.createOrganizationFailed'),
      );
    } finally {
      this.saving.set(false);
    }
  }
}
