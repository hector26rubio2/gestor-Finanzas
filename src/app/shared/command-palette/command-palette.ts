import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommandPaletteService } from './command-palette.service';
import { Router } from '@angular/router';
import { HlmCommandImports } from '@spartan-ng/helm/command';
import { I18nService } from '@core/i18n';
import { P } from '@core/session';
import { navigation, CAPABILITIES, AppStore, FEATURES } from '@core/state';
import { IconComponent, IconName } from '@ui/icon';
import {
  Comando,
  ContextoDeComandos,
  comandosDeApariencia,
  comandosDeMovimiento,
  comandosDeRegistro,
  normalizar,
} from './command-registry';

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
      dialogContentClass="w-[min(40rem,calc(100vw-2rem))]"
    >
      @if (abierto()) {
        <hlm-command [filter]="aceptarTodo" (searchChange)="buscado.set($event)" (keydown.enter)="elegirPrimero()">
          <hlm-command-input [placeholder]="i18n.t('command.placeholder')" />
          <div hlmCommandList class="max-h-[min(64vh,32rem)]">
            @if (!hayResultados()) {
              <p class="py-6 text-center text-sm text-muted-foreground">{{ i18n.t('command.empty') }}</p>
            }
            @for (grupo of grupos(); track grupo.id) {
              @if (grupo.items.length) {
                <hlm-command-group>
                  <hlm-command-group-label>{{ grupo.label }}</hlm-command-group-label>
                  @for (item of grupo.items; track item.id) {
                    <button hlmCommandItem [value]="item.id" (selected)="elegir(item)">
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
          <footer
            class="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-3 py-2 text-[0.7rem] text-muted-foreground"
          >
            <span>{{ i18n.t('command.footer.navigate') }}</span>
            <span>{{ i18n.t('command.footer.choose') }}</span>
            <span>{{ i18n.t('command.footer.close') }}</span>
          </footer>
        </hlm-command>
      }
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

  constructor() {
    effect(() => {
      if (this.abierto()) untracked(() => this.buscado.set(''));
    });
  }

  private ir(ruta: string, despues?: () => void, params?: Record<string, string>): void {
    void this.router.navigate(['/' + ruta], params ? { queryParams: params } : {}).then(() => despues?.());
  }

  private readonly contexto = computed<ContextoDeComandos>(() => {
    const miTema = this.store.preferences().customSaved;
    return {
      t: (clave) => this.i18n.t(clave),
      permite: (permiso) => this.caps.allows(permiso),
      bandera: (clave) => this.features.enabled(clave),
      abrirMovimiento: (kind, operationType) => this.store.form.set({ kind, operationType }),
      abrirPago: () => this.pagarTarjeta(this.tarjetaConMasDeuda()),
      abrirCuenta: (tipo) => this.ir('accounts', () => this.store.form.set({ kind: 'account', accountType: tipo })),
      abrirGestion: (kind, personKind) => {
        const destino =
          kind === 'person'
            ? 'people'
            : kind === 'investment'
              ? 'portfolio'
              : kind === 'recurrence'
                ? 'calendar'
                : 'movements';
        this.ir(destino, () => this.store.form.set({ kind, personKind }));
      },
      irA: (ruta, params) => this.ir(ruta, undefined, params),
      usarTema: (tema) => this.store.usarTema(tema),
      usarMiTema:
        miTema && this.caps.allows(P.preferencias.tema.editar) ? () => this.store.usarTemaPropio(miTema) : undefined,
    };
  });

  private tarjetaConMasDeuda(): string | undefined {
    return [...this.store.data().accounts]
      .filter((cuenta) => cuenta.type === 'credit')
      .sort((a, b) => this.store.balance(a) - this.store.balance(b))[0]?.id;
  }

  private pagarTarjeta(id: string | undefined): void {
    if (!id) return this.ir('accounts');
    this.ir('accounts', () => {
      this.store.inspect('card', id);
      this.store.cardPaymentMode.set(true);
    });
  }

  private readonly secciones = computed<Comando[]>(() =>
    navigation
      .filter((item) => this.caps.allows(item.capability) && this.features.enabled(item.path))
      .map((item) => ({
        id: `nav-${item.path}`,
        label: this.i18n.t('nav.' + item.path),
        palabras: item.path,
        icon: item.icon as IconName,
        run: () => this.ir(item.path),
      })),
  );

  private readonly herramientas = computed<Comando[]>(() => {
    const lista: Comando[] = [];
    if (this.caps.allows(P.movimientos.ver))
      lista.push({
        id: 'accion-buscar',
        label: this.i18n.t('command.searchMovements'),
        palabras: 'buscar filtrar search',
        icon: 'search',
        run: () => void this.router.navigate(['/movements'], { queryParams: { focus: 'search' } }),
      });
    if (this.caps.allows(P.movimientos.exportar))
      lista.push({
        id: 'accion-exportar',
        label: this.i18n.t('command.exportMovements'),
        palabras: 'exportar csv descargar export',
        icon: 'download',
        run: () => this.ir('movements'),
      });
    return lista;
  });

  private readonly cuentas = computed<Comando[]>(() => {
    if (!this.caps.allows(P.cuentas.ver)) return [];
    return this.store.data().accounts.map((cuenta) => ({
      id: `cuenta-${cuenta.id}`,
      label: cuenta.name,
      hint: this.store.money(this.store.balance(cuenta)),
      icon: cuenta.type === 'credit' ? 'accounts' : 'wallet',
      run: () =>
        this.ir('accounts', () => this.store.inspect(cuenta.type === 'credit' ? 'card' : 'account', cuenta.id)),
    }));
  });

  private readonly pagos = computed<Comando[]>(() => {
    if (!this.caps.allows(P.movimientos.pagos.crear)) return [];
    return this.store
      .data()
      .accounts.filter((cuenta) => cuenta.type === 'credit')
      .map((cuenta) => ({
        id: `pagar-${cuenta.id}`,
        label: this.i18n.t('command.payCard', { name: cuenta.name }),
        hint: this.store.money(Math.max(0, -this.store.balance(cuenta))),
        palabras: 'pagar abonar tarjeta pay card',
        icon: 'check',
        run: () => this.pagarTarjeta(cuenta.id),
      }));
  });

  private readonly personas = computed<Comando[]>(() => {
    if (!this.caps.allows(P.personas.ver)) return [];
    return this.store.data().people.map((persona) => ({
      id: `persona-${persona.id}`,
      label: persona.name,
      hint: persona.kind === 'institution' ? this.i18n.t('people.kind.institution') : undefined,
      icon: persona.kind === 'institution' ? 'bank' : 'people',
      run: () => this.ir('people', () => this.store.inspect('person', persona.id)),
    }));
  });

  private readonly movimientos = computed<Comando[]>(() => {
    const texto = normalizar(this.buscado().trim());
    if (texto.length < 2 || !this.caps.allows(P.movimientos.ver)) return [];
    return this.store
      .data()
      .movements.filter((m) => normalizar(m.description).includes(texto))
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
  private coincide(item: Comando): boolean {
    const palabras = normalizar(this.buscado().trim()).split(/\s+/).filter(Boolean);
    const texto = normalizar(`${item.label} ${item.hint ?? ''} ${item.palabras ?? ''}`);
    return palabras.every((palabra) => texto.includes(palabra));
  }
  private filtrar(items: readonly Comando[], limite = Infinity): Comando[] {
    return items.filter((item) => this.coincide(item)).slice(0, limite);
  }
  readonly hayResultados = computed(() => this.grupos().some((grupo) => grupo.items.length > 0));
  readonly grupos = computed(() => {
    const hayTexto = this.buscado().trim().length > 0;
    const contexto = this.contexto();
    return [
      { id: 'crear', label: this.i18n.t('command.group.create'), items: this.filtrar(comandosDeMovimiento(contexto)) },
      {
        id: 'registrar',
        label: this.i18n.t('command.group.register'),
        items: this.filtrar(comandosDeRegistro(contexto)),
      },
      { id: 'secciones', label: this.i18n.t('command.group.sections'), items: this.filtrar(this.secciones()) },
      { id: 'herramientas', label: this.i18n.t('command.group.tools'), items: this.filtrar(this.herramientas()) },
      {
        id: 'apariencia',
        label: this.i18n.t('command.group.appearance'),
        items: hayTexto ? this.filtrar(comandosDeApariencia(contexto)) : [],
      },
      {
        id: 'cuentas',
        label: this.i18n.t('command.group.accounts'),
        items: this.filtrar(this.cuentas(), hayTexto ? 8 : 4),
      },
      {
        id: 'pagos',
        label: this.i18n.t('command.group.payments'),
        items: hayTexto ? this.filtrar(this.pagos(), 6) : [],
      },
      {
        id: 'personas',
        label: this.i18n.t('command.group.people'),
        items: hayTexto ? this.filtrar(this.personas(), 8) : [],
      },
      { id: 'movimientos', label: this.i18n.t('command.group.movements'), items: this.movimientos() },
    ];
  });

  elegirPrimero(): void {
    if (document.querySelector('[data-slot=command-item][data-selected]')) return;
    const primero = this.grupos().find((grupo) => grupo.items.length)?.items[0];
    if (primero) this.elegir(primero);
  }

  elegir(item: Comando): void {
    this.abierto.set(false);
    item.run();
  }
}
