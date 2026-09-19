import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmComboboxImports } from '@spartan-ng/helm/combobox';
import { ApiPermissionDescriptor } from '../../../core/api/administration.api';
import { I18nService } from '../../../core/i18n';
import { IconComponent } from '../../../ui/icon/icon';
import { UiOption, UiSelectComponent } from '../../../ui/select/select';
import { AdminLabels } from '../admin-labels';

export interface PermissionGroup {
  name: string;
  items: readonly ApiPermissionDescriptor[];
}

export interface BulkChange {
  items: readonly ApiPermissionDescriptor[];
  value: boolean;
}

@Component({
  selector: 'app-permission-picker',
  imports: [FormsModule, HlmBadgeImports, HlmButton, HlmComboboxImports, IconComponent, UiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3' },
  template: `
    <hlm-combobox-multiple
      [value]="selected()"
      [disabled]="disabled()"
      [itemToString]="searchText"
      (valueChange)="selectionChanged($event)"
    >
      <hlm-combobox-chips class="max-h-44 w-full overflow-auto">
        <ng-template hlmComboboxValues let-values>
          @for (code of values; track code) {
            <hlm-combobox-chip [value]="code" [showRemove]="!disabled()">{{ describe(code) }}</hlm-combobox-chip>
          }
        </ng-template>
        <input
          hlmComboboxChipInput
          [placeholder]="i18n.t('admin.permissions.picker.placeholder')"
          [attr.aria-label]="i18n.t('admin.permissions.picker.ariaLabel')"
        />
      </hlm-combobox-chips>
      <hlm-combobox-content *hlmComboboxPortal>
        <hlm-combobox-empty>{{ i18n.t('admin.permissions.picker.empty') }}</hlm-combobox-empty>
        <div hlmComboboxList>
          @for (group of groups(); track group.name) {
            <div hlmComboboxGroup>
              <div hlmComboboxLabel class="font-semibold text-foreground">{{ labels.resource(group.name) }}</div>
              @for (permission of group.items; track permission.code) {
                <hlm-combobox-item [value]="permission.code">
                  <span class="flex min-w-0 flex-1 flex-col">
                    <span>{{ permission.description }}</span>
                    <small class="text-xs text-muted-foreground">
                      {{ labels.action(permission) }} · {{ permission.code }}
                      @if (showLevel()) {
                        · {{ labels.level(permission) }}
                      }
                    </small>
                  </span>
                  @if (changed()(permission.code)) {
                    <span hlmBadge variant="outline">{{ i18n.t('admin.permissions.picker.pending') }}</span>
                  }
                </hlm-combobox-item>
              }
            </div>
          }
        </div>
      </hlm-combobox-content>
    </hlm-combobox-multiple>
    @if (bulk() && !disabled()) {
      <div
        class="flex flex-wrap items-center gap-2"
        role="group"
        [attr.aria-label]="i18n.t('admin.permissions.picker.groupActions')"
      >
        <fin-select
          class="min-w-44 flex-1"
          [options]="groupOptions()"
          [ngModel]="bulkGroup()"
          (ngModelChange)="bulkGroup.set($event)"
          [ariaLabel]="i18n.t('admin.permissions.picker.group')"
        />
        <button hlmBtn variant="outline" size="sm" type="button" (click)="applyBulk(true)">
          <fin-icon name="check" /> {{ i18n.t('admin.roles.drawer.selectAll') }}
        </button>
        <button hlmBtn variant="outline" size="sm" type="button" (click)="applyBulk(false)">
          <fin-icon name="close" /> {{ i18n.t('admin.roles.drawer.clear') }}
        </button>
      </div>
    }
    @if (!hideSummary()) {
      <p class="text-xs text-muted-foreground" aria-live="polite">
        {{ i18n.t('admin.permissions.picker.summary', { selected: selected().length, total: total() }) }}
      </p>
    }
  `,
})
export class PermissionPickerComponent {
  readonly i18n = inject(I18nService);
  readonly labels = inject(AdminLabels);
  readonly groups = input.required<readonly PermissionGroup[]>();
  readonly checked = input.required<(code: string) => boolean>();
  readonly changed = input<(code: string) => boolean>(() => false);
  readonly disabled = input(false);
  readonly bulk = input(false);
  readonly showLevel = input(false);
  readonly hideSummary = input(false);
  readonly toggled = output<string>();
  readonly bulkChange = output<BulkChange>();

  readonly bulkGroup = signal('');
  readonly groupOptions = computed<readonly UiOption[]>(() =>
    this.groups().map((group) => ({ value: group.name, label: this.labels.resource(group.name) })),
  );

  private readonly all = computed(() => this.groups().flatMap((group) => group.items));
  private readonly index = computed(() => new Map(this.all().map((permission) => [permission.code, permission])));
  readonly total = computed(() => this.all().length);
  readonly selected = computed(() => {
    const isChecked = this.checked();
    return this.all()
      .filter((permission) => isChecked(permission.code))
      .map((permission) => permission.code);
  });

  readonly searchText = (code: string): string => {
    const permission = this.index().get(code);
    return permission ? `${permission.description} ${permission.code}` : code;
  };

  applyBulk(value: boolean): void {
    const group = this.groups().find((item) => item.name === (this.bulkGroup() || this.groups()[0]?.name));
    if (group) this.bulkChange.emit({ items: group.items, value });
  }

  describe(code: string): string {
    return this.index().get(code)?.description ?? code;
  }

  selectionChanged(next: readonly string[] | null | undefined): void {
    const before = new Set(this.selected());
    const after = new Set(next ?? []);
    for (const code of before) if (!after.has(code)) this.toggled.emit(code);
    for (const code of after) if (!before.has(code)) this.toggled.emit(code);
  }
}
