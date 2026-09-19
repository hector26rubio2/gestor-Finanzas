import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n';
import { CAPABILITIES } from '../../core/state/store';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog';
import { sincronizarConLaUrl } from '../../core/state/url-state';
import { ADMIN_TABS, ADMIN_TAB_IDS } from './admin-tabs';
import { AdminStore } from './admin.store';
import { AdminSaveBarComponent } from './save-bar/admin-save-bar';
import { AuditTabComponent } from './tabs/audit/audit-tab';
import { ErrorsTabComponent } from './tabs/errors/errors-tab';
import { FlagsTabComponent } from './tabs/flags/flags-tab';
import { OrganizationsTabComponent } from './tabs/organizations/organizations-tab';
import { RolesTabComponent } from './tabs/roles/roles-tab';
import { SummaryTabComponent } from './tabs/summary/summary-tab';
import { UsersTabComponent } from './tabs/users/users-tab';

@Component({
  selector: 'app-admin',
  imports: [
    AdminSaveBarComponent,
    AuditTabComponent,
    ConfirmDialogComponent,
    ErrorsTabComponent,
    FlagsTabComponent,
    OrganizationsTabComponent,
    RolesTabComponent,
    SummaryTabComponent,
    UsersTabComponent,
  ],
  providers: [AdminStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex w-full min-w-0 flex-col gap-4" data-page="admin">
      <header>
        <h1 class="font-display text-[clamp(1.5rem,2vw,2rem)] font-semibold tracking-tight">
          {{ i18n.t('admin.title') }}
        </h1>
        <p class="mt-1 text-muted-foreground">{{ i18n.t(currentLabel()) }} · {{ i18n.t('admin.subtitle') }}</p>
      </header>
      <div class="flex flex-col gap-4">
        @switch (store.tab()) {
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
      </div>
      <app-admin-save-bar />
    </div>
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

  readonly currentLabel = computed(
    () => ADMIN_TABS.find((tab) => tab.id === this.store.tab())?.labelKey ?? 'admin.tabs.summary',
  );

  constructor() {
    sincronizarConLaUrl('tab', this.store.tab, 'summary', (value) => ADMIN_TAB_IDS.includes(value));
  }

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
