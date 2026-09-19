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
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmSwitch } from '@spartan-ng/helm/switch';
import { I18nService } from '../../../core/i18n';
import { IconComponent } from '../../../ui/icon/icon';
import { AdminLabels } from '../admin-labels';
import { AdminStore } from '../admin.store';
import { BulkChange, PermissionGroup, PermissionPickerComponent } from './permission-picker';

const RESOURCE_FEATURE: Readonly<Record<string, string>> = {
  dashboard: 'dashboard',
  movimientos: 'movements',
  calendario: 'calendar',
  cuentas: 'accounts',
  personas: 'people',
  patrimonio: 'portfolio',
  planificacion: 'planning',
  reportes: 'reports',
  notificaciones: 'notifications',
  preferencias: 'settings',
};

@Component({
  selector: 'app-permission-sections',
  imports: [HlmBadge, HlmSwitch, IconComponent, PermissionPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3' },
  template: `
    @for (group of visibleGroups(); track group.name) {
      <section class="rounded-lg border border-border" [class.bg-muted]="!enabled(group)">
        <header class="flex items-center gap-3 p-3">
          <hlm-switch
            [checked]="enabled(group)"
            [disabled]="disabled()"
            [aria-label]="i18n.t('admin.permissions.section.toggle', { name: labels.resource(group.name) })"
            (checkedChange)="setEnabled(group, $event)"
          />
          <span class="flex min-w-0 flex-1 flex-col">
            <b class="text-sm">{{ labels.resource(group.name) }}</b>
            <small class="text-xs text-muted-foreground">{{
              i18n.t('admin.permissions.section.count', { selected: countIn(group), total: group.items.length })
            }}</small>
          </span>
          @if (enabled(group)) {
            <span hlmBadge variant="secondary"
              ><fin-icon name="check" class="[--icon-size:12px]" />{{
                i18n.t('admin.permissions.section.active')
              }}</span
            >
          }
        </header>
        @if (enabled(group)) {
          <div class="border-t border-border p-3">
            <app-permission-picker
              [groups]="[group]"
              [checked]="checked()"
              [changed]="changed()"
              [disabled]="disabled()"
              [showLevel]="showLevel()"
              [hideSummary]="true"
              (toggled)="toggled.emit($event)"
            />
          </div>
        }
      </section>
    }
    @if (hiddenCount() > 0) {
      <p class="flex items-center gap-2 text-xs text-muted-foreground">
        <fin-icon name="info" />{{ i18n.t('admin.permissions.section.hidden', { count: hiddenCount() }) }}
      </p>
    }
  `,
})
export class PermissionSectionsComponent {
  readonly i18n = inject(I18nService);
  readonly labels = inject(AdminLabels);
  private readonly store = inject(AdminStore);

  readonly groups = input.required<readonly PermissionGroup[]>();
  readonly checked = input.required<(code: string) => boolean>();
  readonly changed = input<(code: string) => boolean>(() => false);
  readonly organizationId = input<string | null>(null);
  readonly disabled = input(false);
  readonly showLevel = input(false);
  readonly toggled = output<string>();
  readonly bulkChange = output<BulkChange>();

  private readonly opened = signal<ReadonlySet<string>>(new Set());

  private readonly disabledFeatures = computed(() => {
    const organizationId = this.organizationId();
    const flags = organizationId ? this.store.organizationFlagsOf(organizationId) : undefined;
    return new Set((flags ?? []).filter((flag) => !flag.isEnabled).map((flag) => flag.key));
  });

  readonly visibleGroups = computed(() =>
    this.groups().filter((group) => {
      const feature = RESOURCE_FEATURE[group.name];
      return !feature || !this.disabledFeatures().has(feature);
    }),
  );
  readonly hiddenCount = computed(() => this.groups().length - this.visibleGroups().length);

  constructor() {
    effect(() => {
      const organizationId = this.organizationId();
      if (organizationId) untracked(() => void this.store.cargarBanderasDe(organizationId));
    });
  }

  countIn(group: PermissionGroup): number {
    const isChecked = this.checked();
    return group.items.filter((permission) => isChecked(permission.code)).length;
  }

  enabled(group: PermissionGroup): boolean {
    return this.opened().has(group.name) || this.countIn(group) > 0;
  }

  setEnabled(group: PermissionGroup, on: boolean): void {
    this.opened.update((current) => {
      const next = new Set(current);
      if (on) next.add(group.name);
      else next.delete(group.name);
      return next;
    });
    if (on) {
      const base = group.items.find((permission) => permission.action === 1) ?? group.items[0];
      if (base && this.countIn(group) === 0) this.toggled.emit(base.code);
      return;
    }
    if (this.countIn(group) > 0) this.bulkChange.emit({ items: group.items, value: false });
  }
}
