import { Component, computed, inject, signal } from '@angular/core';
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
  template: `
    <app-admin-panel
      [title]="i18n.t('admin.permissions.catalog.title')"
      [subtitle]="i18n.t('admin.permissions.catalog.subtitle')"
    >
      <div panelActions class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <span class="text-sm text-muted-foreground tabular-nums" aria-live="polite">{{
          i18n.t('admin.permissions.catalog.count', { count: visibles().length })
        }}</span>
        <input
          hlmInput
          type="search"
          class="w-full sm:w-64"
          [placeholder]="i18n.t('admin.permissions.catalog.search')"
          [attr.aria-label]="i18n.t('admin.permissions.catalog.search')"
          [ngModel]="filtro()"
          (ngModelChange)="filtro.set($event)"
        />
      </div>
      <div class="grid max-h-[36rem] gap-2 overflow-y-auto overscroll-contain px-5 py-4">
        @for (grupo of grupos(); track grupo.recurso) {
          <details
            class="group rounded-lg border border-border bg-background/40 open:bg-transparent"
            [open]="filtro().trim().length > 0 || $first"
          >
            <summary
              class="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <fin-icon name="next" class="transition-transform group-open:rotate-90" aria-hidden="true" />
              <span class="min-w-0 flex-1 truncate font-medium">{{ labels.resource(grupo.recurso) }}</span>
              <span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">{{
                grupo.permisos.length
              }}</span>
            </summary>
            <ul class="grid gap-1 border-t border-border p-2">
              @for (permiso of grupo.permisos; track permiso.code) {
                <li
                  class="grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent/50 max-[760px]:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <span class="min-w-0 max-[760px]:col-span-full">
                    <code class="block truncate text-xs" [title]="permiso.code">{{ permiso.code }}</code>
                    <small class="text-xs text-muted-foreground">{{ labels.action(permiso) }}</small>
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
                    <span class="flex items-center gap-1">
                      @if (cambiado(permiso)) {
                        <button hlmBtn size="sm" [disabled]="guardando() === permiso.code" (click)="guardar(permiso)">
                          <fin-icon name="check" aria-hidden="true" /> {{ i18n.t('form.actions.save') }}
                        </button>
                      }
                      <button
                        hlmBtn
                        size="icon"
                        variant="ghost"
                        class="size-9"
                        [disabled]="guardando() === permiso.code"
                        [title]="i18n.t('admin.permissions.catalog.resetHint')"
                        [attr.aria-label]="i18n.t('admin.permissions.catalog.reset') + ': ' + permiso.code"
                        (click)="restablecer(permiso)"
                      >
                        <fin-icon name="undo" aria-hidden="true" />
                      </button>
                    </span>
                  }
                </li>
              }
            </ul>
          </details>
        } @empty {
          <p class="py-6 text-center text-sm text-muted-foreground">{{ i18n.t('admin.permissions.picker.empty') }}</p>
        }
      </div>
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

  readonly grupos = computed(() => {
    const porRecurso = new Map<string, ApiPermissionDescriptor[]>();
    for (const permiso of this.visibles()) {
      const lista = porRecurso.get(permiso.resource) ?? [];
      lista.push(permiso);
      porRecurso.set(permiso.resource, lista);
    }
    return [...porRecurso].map(([recurso, permisos]) => ({ recurso, permisos }));
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
