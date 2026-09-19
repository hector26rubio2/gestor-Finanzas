import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { I18nService } from '../../core/i18n';
import { P } from '../../core/session/permissions';
import { CAPABILITIES } from '../../core/state/store';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog';
import { IconComponent } from '../../ui/icon/icon';
import { AdminStore, AdminTab } from './admin.store';
import { AdminSaveBarComponent } from './save-bar/admin-save-bar';
import { AuditTabComponent } from './tabs/audit/audit-tab';
import { ErrorsTabComponent } from './tabs/errors/errors-tab';
import { FlagsTabComponent } from './tabs/flags/flags-tab';
import { OrganizationsTabComponent } from './tabs/organizations/organizations-tab';
import { RolesTabComponent } from './tabs/roles/roles-tab';
import { SummaryTabComponent } from './tabs/summary/summary-tab';
import { UsersTabComponent } from './tabs/users/users-tab';

const TABS: readonly { id: AdminTab; labelKey: string; icon: string; capability: string }[] = [
  { id: 'summary', labelKey: 'admin.tabs.summary', icon: 'dashboard', capability: P.administracion.ver },
  { id: 'users', labelKey: 'admin.tabs.users', icon: 'people', capability: P.administracion.usuarios.listar },
  { id: 'roles', labelKey: 'admin.tabs.roles', icon: 'shield', capability: P.administracion.roles.listar },
  {
    id: 'organizations',
    labelKey: 'admin.tabs.organizations',
    icon: 'organization',
    capability: P.administracion.organizaciones.listar,
  },
  { id: 'flags', labelKey: 'admin.tabs.flags', icon: 'flag', capability: P.administracion.banderas.listar },
  { id: 'audit', labelKey: 'admin.tabs.audit', icon: 'list', capability: P.administracion.auditoria.listar },
  { id: 'errors', labelKey: 'admin.tabs.errors', icon: 'notifications', capability: P.administracion.errores.listar },
];

@Component({
  selector: 'app-admin',
  imports: [
    HlmTabsImports,
    AdminSaveBarComponent,
    AuditTabComponent,
    ConfirmDialogComponent,
    ErrorsTabComponent,
    FlagsTabComponent,
    IconComponent,
    OrganizationsTabComponent,
    RolesTabComponent,
    SummaryTabComponent,
    UsersTabComponent,
  ],
  providers: [AdminStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6 lg:p-8" data-page="admin">
      <header>
        <h1 class="font-display text-3xl font-semibold tracking-tight">{{ i18n.t('admin.title') }}</h1>
        <p class="mt-1 text-muted-foreground">{{ i18n.t('admin.subtitle') }}</p>
      </header>
      <hlm-tabs [tab]="store.tab()" (tabActivated)="store.tab.set($any($event))">
        <hlm-tabs-list
          class="h-auto w-full justify-start overflow-x-auto"
          [attr.aria-label]="i18n.t('admin.nav.ariaLabel')"
        >
          @for (item of tabs(); track item.id) {
            <button [hlmTabsTrigger]="item.id" class="flex-none px-3 py-1.5">
              <fin-icon [name]="item.icon" />
              {{ item.label }}
            </button>
          }
        </hlm-tabs-list>
        @for (item of tabs(); track item.id) {
          <div [hlmTabsContent]="item.id" class="flex flex-col gap-4 pt-2">
            @if (store.tab() === item.id) {
              @switch (item.id) {
                @case ('summary') {
                  <app-admin-summary-tab />
                }
                @case ('users') {
                  <app-admin-users-tab />
                }
                @case ('roles') {
                  <app-admin-roles-tab />
                }
                @case ('organizations') {
                  <app-admin-organizations-tab />
                }
                @case ('flags') {
                  <app-admin-flags-tab />
                }
                @case ('audit') {
                  <app-admin-audit-tab />
                }
                @case ('errors') {
                  <app-admin-errors-tab />
                }
              }
            }
          </div>
        }
      </hlm-tabs>
      <app-admin-save-bar />
    </main>
    <fin-confirm-dialog
      [open]="!!leaving()"
      [title]="i18n.t('admin.leave.title')"
      [description]="i18n.t('admin.leave.detail')"
      [confirmLabel]="i18n.t('admin.leave.confirm')"
      [cancelLabel]="i18n.t('admin.leave.stay')"
      (confirmed)="resolveLeave(true)"
      (dismissed)="resolveLeave(false)"
    />
  `,
})
export class AdminComponent implements OnInit {
  readonly store = inject(AdminStore);
  readonly i18n = inject(I18nService);
  private readonly caps = inject(CAPABILITIES);

  readonly leaving = signal<((allowed: boolean) => void) | null>(null);

  readonly tabs = computed(() =>
    TABS.filter((item) => this.caps.allows(item.capability)).map((item) => ({
      id: item.id,
      icon: item.icon,
      label: this.i18n.t(item.labelKey),
    })),
  );

  ngOnInit(): void {
    void this.store.cargar();
  }

  puedeSalir(): boolean | Promise<boolean> {
    if (!this.store.dirty()) return true;
    return new Promise<boolean>((resolve) => this.leaving.set(resolve));
  }

  resolveLeave(allowed: boolean): void {
    const resolve = this.leaving();
    if (!resolve) return;
    this.leaving.set(null);
    resolve(allowed);
  }

  @HostListener('window:beforeunload', ['$event'])
  warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.store.dirty()) event.preventDefault();
  }
}
