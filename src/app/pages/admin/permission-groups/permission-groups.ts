import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { ApiPermissionDescriptor } from '../../../core/api/administration.api';
import { I18nService } from '../../../core/i18n';
import { IconComponent } from '../../../ui/icon';
import { OptionRowComponent } from '../../../ui/option-row/option-row';
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
  selector: 'app-permission-groups',
  imports: [HlmButton, IconComponent, OptionRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (group of groups(); track group.name) {
      <details class="group rounded-lg border border-border">
        <summary
          class="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden"
        >
          <fin-icon name="menu" />
          <span class="flex min-w-0 flex-1 flex-col">
            <b class="text-sm">{{ labels.resource(group.name) }}</b>
            <small class="text-xs text-muted-foreground">{{ group.name }}</small>
          </span>
          <span class="text-xs text-muted-foreground">{{ checkedIn(group.items) }}/{{ group.items.length }}</span>
          <fin-icon name="chevronDown" class="transition-transform group-open:rotate-180" />
        </summary>
        <div class="border-t border-border p-2">
          @if (bulk()) {
            <div class="flex justify-end gap-2 pb-2">
              <button
                hlmBtn
                variant="ghost"
                size="xs"
                type="button"
                (click)="bulkChange.emit({ items: group.items, value: true })"
              >
                {{ i18n.t('admin.roles.drawer.selectAll') }}
              </button>
              <button
                hlmBtn
                variant="ghost"
                size="xs"
                type="button"
                (click)="bulkChange.emit({ items: group.items, value: false })"
              >
                {{ i18n.t('admin.roles.drawer.clear') }}
              </button>
            </div>
          }
          @for (permission of group.items; track permission.code) {
            <fin-option-row
              kind="checkbox"
              [label]="permission.description"
              [description]="
                labels.action(permission) +
                ' · ' +
                permission.code +
                (showLevel() ? ' · ' + labels.level(permission) : '')
              "
              [checked]="checked()(permission.code)"
              [changed]="changed()(permission.code)"
              [disabled]="disabled()"
              (toggled)="toggled.emit(permission.code)"
            />
          }
        </div>
      </details>
    }
  `,
  host: { class: 'flex flex-col gap-2' },
})
export class PermissionGroupsComponent {
  readonly i18n = inject(I18nService);
  readonly labels = inject(AdminLabels);
  readonly groups = input.required<readonly PermissionGroup[]>();
  readonly checked = input.required<(code: string) => boolean>();
  readonly changed = input<(code: string) => boolean>(() => false);
  readonly disabled = input(false);
  readonly bulk = input(false);
  readonly showLevel = input(false);
  readonly toggled = output<string>();
  readonly bulkChange = output<BulkChange>();

  checkedIn(items: readonly ApiPermissionDescriptor[]): number {
    const isChecked = this.checked();
    return items.filter((permission) => isChecked(permission.code)).length;
  }
}
