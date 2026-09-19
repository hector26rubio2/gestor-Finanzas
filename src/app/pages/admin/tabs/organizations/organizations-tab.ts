import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmSwitch } from '@spartan-ng/helm/switch';
import { ApiAdminOrganization } from '../../../../core/api/administration.api';
import { I18nService } from '../../../../core/i18n';
import { P } from '../../../../core/permissions';
import { CAPABILITIES, AppStore } from '../../../../core/store';
import { EmptyStateComponent } from '../../../../ui/empty-state/empty-state';
import { IconComponent } from '../../../../ui/icon';
import { SheetPanelComponent } from '../../../../ui/sheet-panel/sheet-panel';
import { AdminStore } from '../../admin.store';
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
    EmptyStateComponent,
    IconComponent,
    OrganizationSheetComponent,
    SheetPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.sinDatos()) {
      <fin-empty
        [title]="i18n.t('admin.emptyState.title')"
        [detail]="i18n.t('admin.emptyState.organizations.detail')"
      />
    } @else {
      <section class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold">{{ i18n.t('admin.organizations.title') }}</h2>
          <p class="text-sm text-muted-foreground">{{ i18n.t('admin.organizations.subtitle') }}</p>
        </div>
        @if (caps.allows(P.administracion.organizaciones.crear)) {
          <button hlmBtn (click)="creating.set(true)">
            <fin-icon name="plus" /> {{ i18n.t('admin.organizations.actions.create') }}
          </button>
        }
      </section>
      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        @for (org of store.organizations(); track org.id) {
          <article
            class="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            [class.opacity-70]="!store.isOrganizationActive(org)"
          >
            <header class="flex items-start gap-3">
              <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                <fin-icon name="organization" />
              </span>
              <span class="flex min-w-0 flex-1 flex-col">
                <h3 class="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {{ org.name }}
                  @if (store.isDefaultOrganization(org)) {
                    <span hlmBadge>{{ i18n.t('admin.organizations.defaultBadge') }}</span>
                  }
                  @if (!store.isOrganizationActive(org)) {
                    <span hlmBadge variant="outline">{{ i18n.t('admin.organizations.inactiveBadge') }}</span>
                  }
                </h3>
                <small class="text-xs text-muted-foreground">{{ org.slug }} · {{ org.baseCurrency }}</small>
                <small class="text-xs text-muted-foreground">
                  {{ i18n.t('admin.organizations.memberCount', { count: org.memberCount }) }}
                </small>
              </span>
              @if (caps.allows(P.administracion.organizaciones.editar)) {
                <hlm-switch
                  [checked]="store.isOrganizationActive(org)"
                  [disabled]="store.isDefaultOrganization(org)"
                  [aria-label]="i18n.t('admin.organizations.activeToggle', { name: org.name })"
                  (checkedChange)="store.setOrganizationActive(org, $event)"
                />
              }
            </header>
            <footer class="mt-auto flex flex-wrap justify-end gap-2">
              @if (
                caps.allows(P.administracion.organizaciones.editar) &&
                !store.isDefaultOrganization(org) &&
                store.isOrganizationActive(org)
              ) {
                <button hlmBtn variant="ghost" size="sm" (click)="store.setDefaultOrganization(org)">
                  {{ i18n.t('admin.organizations.makeDefault') }}
                </button>
              }
              <button hlmBtn variant="outline" size="sm" (click)="managingId.set(org.id)">
                {{ i18n.t('admin.organizations.manage') }}
              </button>
            </footer>
          </article>
        }
      </section>
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
        <button hlmBtn variant="outline" (click)="creating.set(false)">{{ i18n.t('admin.common.cancel') }}</button>
        <button hlmBtn [disabled]="saving() || !name().trim()" (click)="create()">
          {{ i18n.t('admin.roles.drawer.save') }}
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
  readonly name = signal('');
  readonly currency = signal('COP');
  readonly saving = signal(false);
  readonly managingId = signal<string | null>(null);
  readonly managing = computed<ApiAdminOrganization | null>(
    () => this.store.organizations().find((org) => org.id === this.managingId()) ?? null,
  );

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
