import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommandPaletteService } from './command-palette.service';
import { Router } from '@angular/router';
import { HlmCommandImports } from '@spartan-ng/helm/command';
import { I18nService } from '../../core/i18n';
import { P } from '../../core/session/permissions';
import { navigation } from '../../core/state/navigation';
import { CAPABILITIES, AppStore, FEATURES } from '../../core/state/store';
import { IconComponent, IconName } from '../../ui/icon/icon';

interface Destino {
  id: string;
  label: string;
  hint?: string;
  icon: IconName;
  run: () => void;
}

const MAX_MOVIMIENTOS = 8;

@Component({
  selector: 'fin-command-palette',
  imports: [HlmCommandImports, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-command-dialog
      [state]="abierto() ? 'open' : 'closed'"
      (stateChange)="abierto.set($event === 'open')"
      [title]="i18n.t('command.title')"
      [description]="i18n.t('command.description')"
      dialogContentClass="w-[min(36rem,calc(100vw-2rem))]"
    >
      <hlm-command [filter]="aceptarTodo" (searchChange)="buscado.set($event)" (keydown.enter)="elegirPrimero()">
        <hlm-command-input [placeholder]="i18n.t('command.placeholder')" />
        <div hlmCommandList class="max-h-[min(60vh,28rem)]">
          @if (!hayResultados()) {
            <p class="py-6 text-center text-sm text-muted-foreground">{{ i18n.t('command.empty') }}</p>
          }
          @for (grupo of grupos(); track grupo.id) {
            @if (grupo.items.length) {
              <hlm-command-group>
                <hlm-command-group-label>{{ grupo.label }}</hlm-command-group-label>
                @for (item of grupo.items; track item.id) {
                  <button hlmCommandItem [value]="item.label + ' ' + (item.hint ?? '')" (selected)="elegir(item)">
                    <fin-icon [name]="item.icon" />
                    <span class="truncate">{{ item.label }}</span>
                    @if (item.hint) {
                      <span class="ms-auto truncate text-xs text-muted-foreground">{{ item.hint }}</span>
                    }
                  </button>
                }
              </hlm-command-group>
            }
          }
        </div>
      </hlm-command>
    </hlm-command-dialog>
  `,
})
export class CommandPaletteComponent {
  readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly store = inject(AppStore);
  private readonly caps = inject(CAPABILITIES);
  private readonly features = inject(FEATURES);
  private readonly servicio = inject(CommandPaletteService);
  readonly abierto = this.servicio.abierto;
  readonly buscado = signal('');

  private ir(ruta: string, despues?: () => void): void {
    void this.router.navigate(['/' + ruta]).then(() => despues?.());
  }

  private readonly secciones = computed<Destino[]>(() =>
    navigation
      .filter((item) => this.caps.allows(item.capability) && this.features.enabled(item.path))
      .map((item) => ({
        id: `nav-${item.path}`,
        label: this.i18n.t('nav.' + item.path),
        icon: item.icon as IconName,
        run: () => this.ir(item.path),
      })),
  );

  private readonly acciones = computed<Destino[]>(() => {
    const lista: Destino[] = [];
    if (this.caps.allows(P.movimientos.crear))
      lista.push({
        id: 'accion-nuevo',
        label: this.i18n.t('shell.newMovement'),
        icon: 'plus',
        run: () => this.store.open(),
      });
    if (this.caps.allows(P.movimientos.ver))
      lista.push({
        id: 'accion-buscar',
        label: this.i18n.t('command.searchMovements'),
        icon: 'search',
        run: () => void this.router.navigate(['/movements'], { queryParams: { focus: 'search' } }),
      });
    return lista;
  });

  private readonly cuentas = computed<Destino[]>(() => {
    if (!this.caps.allows(P.cuentas.ver)) return [];
    return this.store.data().accounts.map((cuenta) => ({
      id: `cuenta-${cuenta.id}`,
      label: cuenta.name,
      hint: this.store.money(this.store.balance(cuenta)),
      icon: cuenta.type === 'credit' ? 'accounts' : 'wallet',
      run: () => this.ir('accounts', () => this.store.inspect('card', cuenta.id)),
    }));
  });

  private readonly personas = computed<Destino[]>(() => {
    if (!this.caps.allows(P.personas.ver)) return [];
    return this.store.data().people.map((persona) => ({
      id: `persona-${persona.id}`,
      label: persona.name,
      icon: 'people',
      run: () => this.ir('people', () => this.store.inspect('person', persona.id)),
    }));
  });

  private readonly movimientos = computed<Destino[]>(() => {
    const texto = this.buscado().trim().toLocaleLowerCase();
    if (texto.length < 2 || !this.caps.allows(P.movimientos.ver)) return [];
    return this.store
      .data()
      .movements.filter((m) => m.description.toLocaleLowerCase().includes(texto))
      .slice(0, MAX_MOVIMIENTOS)
      .map((m) => ({
        id: `mov-${m.id}`,
        label: m.description,
        hint: `${m.date} · ${this.store.money(m.amount)}`,
        icon: 'movements',
        run: () => this.ir('movements', () => this.store.inspect('movement', m.id)),
      }));
  });

  readonly aceptarTodo = () => true;
  private coincide(item: Destino): boolean {
    const texto = this.buscado().trim().toLocaleLowerCase();
    return !texto || `${item.label} ${item.hint ?? ''}`.toLocaleLowerCase().includes(texto);
  }
  readonly hayResultados = computed(() => this.grupos().some((grupo) => grupo.items.length > 0));
  readonly grupos = computed(() => [
    {
      id: 'acciones',
      label: this.i18n.t('command.group.actions'),
      items: this.acciones().filter((item) => this.coincide(item)),
    },
    {
      id: 'secciones',
      label: this.i18n.t('command.group.sections'),
      items: this.secciones().filter((item) => this.coincide(item)),
    },
    {
      id: 'cuentas',
      label: this.i18n.t('command.group.accounts'),
      items: this.cuentas().filter((item) => this.coincide(item)),
    },
    {
      id: 'personas',
      label: this.i18n.t('command.group.people'),
      items: this.personas().filter((item) => this.coincide(item)),
    },
    { id: 'movimientos', label: this.i18n.t('command.group.movements'), items: this.movimientos() },
  ]);

  elegirPrimero(): void {
    if (document.querySelector('[data-slot=command-item][data-selected]')) return;
    const primero = this.grupos().find((grupo) => grupo.items.length)?.items[0];
    if (primero) this.elegir(primero);
  }

  elegir(item: Destino): void {
    this.abierto.set(false);
    item.run();
  }
}
