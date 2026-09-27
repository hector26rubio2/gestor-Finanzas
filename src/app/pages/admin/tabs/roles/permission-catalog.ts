import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { ApiPermissionDescriptor } from '@core/api';
import { I18nService } from '@core/i18n';
import { P } from '@core/session';
import { CAPABILITIES } from '@core/state';
import { IconComponent } from '@ui/icon';
import { AdminLabels } from '@pages/admin/admin-labels';
import { AdminStore } from '@pages/admin/admin.store';
import { AdminPanelComponent } from '@pages/admin/panel/admin-panel';
import { AdminPermissionsStore } from '@pages/admin/stores/admin-permissions.store';

@Component({
  selector: 'app-admin-permission-catalog',
  imports: [FormsModule, HlmButton, HlmInput, IconComponent, AdminPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-admin-panel
      [title]="i18n.t('admin.permissions.catalog.title')"
      [subtitle]="i18n.t('admin.permissions.catalog.subtitle')"
    >
      <div panelActions>
        <input
          hlmInput
          type="search"
          class="w-64 max-w-full"
          [placeholder]="i18n.t('admin.permissions.catalog.search')"
          [attr.aria-label]="i18n.t('admin.permissions.catalog.search')"
          [ngModel]="filtro()"
          (ngModelChange)="filtro.set($event)"
        />
      </div>
      <ul class="grid max-h-[28rem] gap-2 overflow-auto pr-1">
        @for (permiso of visibles(); track permiso.code) {
          <li class="grid grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] items-center gap-3 max-[700px]:grid-cols-1">
            <span class="min-w-0">
              <code class="block truncate text-xs">{{ permiso.code }}</code>
              <small class="text-xs text-muted-foreground"
                >{{ labels.resource(permiso.resource) }} · {{ labels.action(permiso) }}</small
              >
            </span>
            <input
              hlmInput
              [disabled]="!puedeEditar"
              [attr.aria-label]="i18n.t('admin.permissions.catalog.descriptionAria', { code: permiso.code })"
              [ngModel]="borradores()[permiso.code] ?? permiso.description"
              (ngModelChange)="escribir(permiso.code, $event)"
              (keydown.enter)="guardar(permiso)"
            />
            @if (puedeEditar) {
              <span class="flex gap-1.5">
                <button
                  hlmBtn
                  size="sm"
                  [disabled]="!cambiado(permiso) || guardando() === permiso.code"
                  (click)="guardar(permiso)"
                >
                  <fin-icon name="check" /> {{ i18n.t('form.actions.save') }}
                </button>
                <button
                  hlmBtn
                  size="sm"
                  variant="ghost"
                  [disabled]="guardando() === permiso.code"
                  [title]="i18n.t('admin.permissions.catalog.resetHint')"
                  (click)="restablecer(permiso)"
                >
                  <fin-icon name="undo" />
                  <span class="sr-only">{{ i18n.t('admin.permissions.catalog.reset') }}</span>
                </button>
              </span>
            }
          </li>
        } @empty {
          <li class="text-sm text-muted-foreground">{{ i18n.t('admin.permissions.picker.empty') }}</li>
        }
      </ul>
    </app-admin-panel>
  `,
})
export class PermissionCatalogComponent {
  readonly store = inject(AdminStore);
  readonly permisos = inject(AdminPermissionsStore);
  readonly i18n = inject(I18nService);
  readonly labels = inject(AdminLabels);
  readonly puedeEditar = inject(CAPABILITIES).allows(P.administracion.capacidades.editar);
  readonly filtro = signal('');
  readonly borradores = signal<Readonly<Partial<Record<string, string>>>>({});
  readonly guardando = signal<string | null>(null);
  readonly visibles = computed(() => {
    const texto = this.filtro().trim().toLowerCase();
    return this.permisos
      .catalog()
      .filter((permiso) => !texto || `${permiso.code} ${permiso.description}`.toLowerCase().includes(texto));
  });

  escribir(code: string, valor: string): void {
    this.borradores.update((actuales) => ({ ...actuales, [code]: valor }));
  }

  cambiado(permiso: ApiPermissionDescriptor): boolean {
    const borrador = this.borradores()[permiso.code];
    return borrador !== undefined && borrador.trim() !== permiso.description;
  }

  async guardar(permiso: ApiPermissionDescriptor): Promise<void> {
    if (!this.puedeEditar || !this.cambiado(permiso)) return;
    await this.enviar(permiso.code, this.borradores()[permiso.code] ?? '');
  }

  async restablecer(permiso: ApiPermissionDescriptor): Promise<void> {
    await this.enviar(permiso.code, '');
  }

  private async enviar(code: string, descripcion: string): Promise<void> {
    this.guardando.set(code);
    try {
      await this.permisos.guardarDescripcion(code, descripcion);
      this.borradores.update((actuales) => ({ ...actuales, [code]: undefined }));
    } catch {
      return;
    } finally {
      this.guardando.set(null);
    }
  }
}
