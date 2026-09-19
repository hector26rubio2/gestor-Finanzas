import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { ApiAdminOrganization, ApiAdminUser } from '../../../../core/api/administration.api';
import { I18nService } from '../../../../core/i18n';
import { P } from '../../../../core/session/permissions';
import { CAPABILITIES, AppStore } from '../../../../core/state/store';
import { OptionRowComponent } from '../../../../ui/option-row/option-row';
import { SheetPanelComponent } from '../../../../ui/sheet-panel/sheet-panel';
import { AdminLabels } from '../../admin-labels';
import { AdminStore } from '../../admin.store';

@Component({
  selector: 'app-organization-sheet',
  imports: [FormsModule, HlmBadge, HlmButton, HlmInput, HlmLabel, OptionRowComponent, SheetPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fin-sheet-panel
      [open]="!!organization()"
      [title]="organization()?.name ?? ''"
      [subtitle]="organization() ? organization()!.slug + ' · ' + organization()!.baseCurrency : ''"
      (closed)="closed.emit()"
    >
      @if (organization(); as org) {
        @if (caps.allows(P.administracion.organizaciones.editar)) {
          <section class="flex items-end gap-2">
            <label hlmLabel class="flex items-start flex-1 flex-col gap-1.5">
              {{ i18n.t('admin.organizations.drawer.nameLabel') }}
              <input hlmInput [ngModel]="name()" (ngModelChange)="name.set($event)" />
            </label>
            <button hlmBtn variant="outline" [disabled]="!nameChanged() || renaming()" (click)="rename(org)">
              {{ i18n.t('admin.organizations.saveName') }}
            </button>
          </section>
        }

        <section class="flex flex-col gap-2">
          <h3 class="text-sm font-semibold">{{ i18n.t('admin.organizations.members.title') }}</h3>
          <p class="text-xs text-muted-foreground">{{ i18n.t('admin.organizations.members.hint') }}</p>
          <ul class="divide-y divide-border rounded-lg border border-border">
            @for (member of members(); track member.membershipId) {
              <li class="flex items-center justify-between gap-3 px-3 py-2">
                <span class="flex min-w-0 flex-col">
                  <b class="truncate text-sm">{{ member.displayName }}</b>
                  <small class="truncate text-xs text-muted-foreground">
                    {{ member.email }} · {{ member.roles.join(', ') || i18n.t('admin.users.directAccess') }}
                  </small>
                </span>
                <span hlmBadge variant="outline">{{ member.status }}</span>
              </li>
            } @empty {
              <li class="px-3 py-4 text-center text-sm text-muted-foreground">
                {{ i18n.t('admin.organizations.members.empty') }}
              </li>
            }
            @for (userId of pendingMembers(); track userId) {
              <li class="flex items-center justify-between gap-3 bg-accent/50 px-3 py-2">
                <b class="text-sm">{{ store.userName(userId) }}</b>
                <span hlmBadge variant="secondary">{{ i18n.t('admin.organizations.members.pending') }}</span>
              </li>
            }
          </ul>
          @if (caps.allows(P.administracion.usuarios.organizacion.editar)) {
            <label hlmLabel class="flex items-start flex-col gap-1.5">
              {{ i18n.t('admin.organizations.members.add') }}
              <input
                hlmInput
                [ngModel]="query()"
                (ngModelChange)="onQuery($event)"
                [placeholder]="i18n.t('admin.users.searchPlaceholder')"
              />
            </label>
            @if (results().length) {
              <ul class="divide-y divide-border rounded-lg border border-border">
                @for (user of results(); track user.id) {
                  <li class="flex items-center justify-between gap-3 px-3 py-2">
                    <span class="flex min-w-0 flex-col">
                      <b class="truncate text-sm">{{ user.displayName }}</b>
                      <small class="truncate text-xs text-muted-foreground">{{ user.email }}</small>
                    </span>
                    <button
                      hlmBtn
                      variant="outline"
                      size="sm"
                      [disabled]="isMember(user, org.id)"
                      (click)="add(user, org)"
                    >
                      {{
                        i18n.t(
                          isMember(user, org.id)
                            ? 'admin.organizations.members.already'
                            : 'admin.organizations.members.addAction'
                        )
                      }}
                    </button>
                  </li>
                }
              </ul>
            }
          }
        </section>

        <section class="flex flex-col gap-1">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-semibold">{{ i18n.t('admin.organizations.roles.title') }}</h3>
            <button hlmBtn variant="ghost" size="sm" (click)="openRoles(org)">
              {{ i18n.t('admin.organizations.roles.manage') }}
            </button>
          </div>
          <p class="text-xs text-muted-foreground">{{ i18n.t('admin.organizations.roles.hint') }}</p>
          <div class="flex flex-wrap gap-1.5">
            @for (role of roles(); track role.id) {
              <span hlmBadge variant="secondary">{{ role.name }} · {{ role.permissions.length }}</span>
            }
          </div>
        </section>

        @if (caps.allows(P.administracion.banderas.listar)) {
          <section class="flex flex-col gap-1">
            <h3 class="text-sm font-semibold">{{ i18n.t('admin.organizations.flags.title') }}</h3>
            <p class="text-xs text-muted-foreground">{{ i18n.t('admin.organizations.flags.hint') }}</p>
            @for (flag of flags(); track flag.key) {
              <fin-option-row
                [label]="labels.feature(flag.key)"
                [description]="flag.key + ' · ' + i18n.t('admin.organizations.flags.source.' + flag.source)"
                [checked]="store.flagValue(flag.key, org.id, null)"
                [changed]="store.flagChanged(flag.key, org.id, null)"
                [disabled]="!caps.allows(P.administracion.banderas.editar)"
                (toggled)="store.setFlag(flag.key, org.id, null, $event)"
              />
            }
          </section>
        }
      }
    </fin-sheet-panel>
  `,
})
export class OrganizationSheetComponent {
  readonly store = inject(AdminStore);
  readonly i18n = inject(I18nService);
  readonly labels = inject(AdminLabels);
  readonly caps = inject(CAPABILITIES);
  private readonly app = inject(AppStore);
  readonly P = P;

  readonly organization = input.required<ApiAdminOrganization | null>();
  readonly closed = output<void>();

  readonly name = signal('');
  readonly renaming = signal(false);
  readonly query = signal('');
  readonly results = signal<readonly ApiAdminUser[]>([]);
  private queryTimer: ReturnType<typeof setTimeout> | undefined;

  readonly members = computed(() => {
    const org = this.organization();
    return org ? (this.store.membersOf(org.id) ?? []) : [];
  });
  readonly pendingMembers = computed(() => {
    const org = this.organization();
    return org ? this.store.pendingMembersOf(org.id) : [];
  });
  readonly roles = computed(() => {
    const org = this.organization();
    return org ? this.store.rolesOf(org.id) : [];
  });
  readonly flags = computed(() => {
    const org = this.organization();
    return org ? (this.store.organizationFlagsOf(org.id) ?? []) : [];
  });
  readonly nameChanged = computed(
    () => !!this.name().trim() && this.name().trim() !== (this.organization()?.name ?? ''),
  );

  constructor() {
    effect(() => {
      const org = this.organization();
      untracked(() => {
        this.name.set(org?.name ?? '');
        this.query.set('');
        this.results.set([]);
        if (!org) return;
        void this.store.cargarMiembros(org.id);
        void this.store.cargarRolesDe(org.id);
        void this.store.cargarBanderasDe(org.id);
      });
    });
  }

  isMember(user: ApiAdminUser, organizationId: string): boolean {
    return this.store.targetOrganizationId(user) === organizationId;
  }

  onQuery(value: string): void {
    this.query.set(value);
    clearTimeout(this.queryTimer);
    if (!value.trim()) {
      this.results.set([]);
      return;
    }
    this.queryTimer = setTimeout(async () => this.results.set(await this.store.buscarUsuarios(value.trim())), 300);
  }

  add(user: ApiAdminUser, org: ApiAdminOrganization): void {
    this.store.setUserOrganization(user, org.id);
  }

  openRoles(org: ApiAdminOrganization): void {
    void this.store.cargarRoles(1, org.id);
    this.store.tab.set('roles');
    this.closed.emit();
  }

  async rename(org: ApiAdminOrganization): Promise<void> {
    this.renaming.set(true);
    try {
      await this.store.renombrarOrganizacion(org.id, this.name().trim());
    } catch (error) {
      const reason = error instanceof Error ? error.message : '';
      this.app.toast.set(
        reason
          ? this.i18n.t('admin.toast.renameOrganizationFailedReason', { reason })
          : this.i18n.t('admin.toast.renameOrganizationFailed'),
      );
    } finally {
      this.renaming.set(false);
    }
  }
}
