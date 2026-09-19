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
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { ApiAdminRole } from '../../../../core/api/administration.api';
import { I18nService } from '../../../../core/i18n';
import { AppStore } from '../../../../core/state/store';
import { SheetPanelComponent } from '../../../../ui/sheet-panel/sheet-panel';
import { UiSelectComponent } from '../../../../ui/select/select';
import { AdminStore } from '../../admin.store';
import { BulkChange, PermissionGroupsComponent } from '../../permission-groups/permission-groups';

@Component({
  selector: 'app-role-sheet',
  imports: [
    FormsModule,
    HlmButton,
    HlmInput,
    HlmLabel,
    HlmTextarea,
    PermissionGroupsComponent,
    SheetPanelComponent,
    UiSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fin-sheet-panel
      [open]="open()"
      [title]="role() ? i18n.t('admin.roles.drawer.editTitle') : i18n.t('admin.roles.actions.create')"
      [subtitle]="i18n.t('admin.roles.drawer.subtitle')"
      [footer]="true"
      (closed)="closed.emit()"
    >
      <label hlmLabel class="flex items-start flex-col gap-1.5">
        {{ i18n.t('admin.roles.drawer.nameLabel') }}
        <input hlmInput [ngModel]="name()" (ngModelChange)="name.set($event)" />
      </label>
      <label hlmLabel class="flex items-start flex-col gap-1.5">
        {{ i18n.t('admin.roles.drawer.descriptionLabel') }}
        <textarea hlmTextarea rows="2" [ngModel]="description()" (ngModelChange)="description.set($event)"></textarea>
      </label>
      @if (!role()) {
        <label hlmLabel class="flex items-start flex-col gap-1.5">
          {{ i18n.t('admin.roles.drawer.organizationLabel') }}
          <fin-select
            [ngModel]="organizationId()"
            (ngModelChange)="organizationId.set($event)"
            [options]="store.organizationOptions()"
            [ariaLabel]="i18n.t('admin.roles.drawer.organizationAriaLabel')"
          />
        </label>
      }
      <app-permission-groups
        [groups]="store.permissionGroups()"
        [checked]="isChecked"
        [bulk]="true"
        [showLevel]="true"
        (toggled)="toggle($event)"
        (bulkChange)="markGroup($event)"
      />
      <div sheetFooter class="flex gap-2">
        <button hlmBtn variant="outline" (click)="closed.emit()">{{ i18n.t('admin.common.cancel') }}</button>
        <button hlmBtn [disabled]="saving()" (click)="save()">{{ i18n.t('admin.roles.drawer.save') }}</button>
      </div>
    </fin-sheet-panel>
  `,
})
export class RoleSheetComponent {
  readonly store = inject(AdminStore);
  readonly i18n = inject(I18nService);
  private readonly app = inject(AppStore);

  readonly role = input<ApiAdminRole | null>(null);
  readonly creating = input(false);
  readonly closed = output<void>();
  readonly open = computed(() => this.creating() || !!this.role());

  readonly name = signal('');
  readonly description = signal('');
  readonly organizationId = signal('');
  readonly permissions = signal<readonly string[]>([]);
  readonly saving = signal(false);

  constructor() {
    effect(() => {
      const role = this.role();
      const creating = this.creating();
      untracked(() => {
        this.name.set(role?.name ?? '');
        this.description.set(role?.description ?? '');
        this.organizationId.set(role?.organizationId ?? this.store.organizations()[0]?.id ?? '');
        this.permissions.set(role?.permissions ?? []);
        if (!role && !creating) this.saving.set(false);
      });
    });
  }

  readonly isChecked = (code: string): boolean => this.permissions().includes(code);

  toggle(code: string): void {
    this.permissions.update((current) =>
      current.includes(code) ? current.filter((x) => x !== code) : [...current, code],
    );
  }

  markGroup(change: BulkChange): void {
    const codes = change.items.map((permission) => permission.code);
    this.permissions.update((current) => {
      const rest = current.filter((code) => !codes.includes(code));
      return change.value ? [...rest, ...codes] : rest;
    });
  }

  async save(): Promise<void> {
    if (!this.name().trim()) return;
    if (!this.organizationId()) {
      this.app.toast.set(this.i18n.t('admin.toast.selectOrganization'));
      return;
    }
    this.saving.set(true);
    try {
      await this.store.guardarRol(this.role()?.id ?? null, {
        organizationId: this.organizationId(),
        name: this.name(),
        description: this.description(),
        capabilities: this.role()?.capabilities ?? [],
        permissions: this.permissions(),
      });
      this.closed.emit();
    } catch (error) {
      const reason = error instanceof Error ? error.message : '';
      this.app.toast.set(
        reason
          ? this.i18n.t('admin.toast.saveRoleFailedReason', { reason })
          : this.i18n.t('admin.toast.saveRoleFailed'),
      );
    } finally {
      this.saving.set(false);
    }
  }
}
