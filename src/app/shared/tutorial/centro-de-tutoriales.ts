import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '@core/i18n';
import { CAPABILITIES, FEATURES } from '@core/state/store';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { IconComponent } from '@ui/icon';
import { OverlayComponent } from '@ui/overlay';
import { guiasDisponibles, type Guia } from './catalogo-de-guias';
import { SelectorDeIdiomaComponent } from './selector-de-idioma';
import { TutorialService } from './tutorial.service';

interface GrupoDeGuias {
  categoria: string;
  guias: Guia[];
}

export function agruparGuias(guias: readonly Guia[], busqueda: string): GrupoDeGuias[] {
  const texto = busqueda.trim().toLocaleLowerCase();
  const grupos = new Map<string, Guia[]>();
  for (const guia of guias) {
    const coincide = !texto || `${guia.titulo} ${guia.resumen} ${guia.categoria}`.toLocaleLowerCase().includes(texto);
    if (coincide) grupos.set(guia.categoria, [...(grupos.get(guia.categoria) ?? []), guia]);
  }
  return [...grupos].map(([categoria, lista]) => ({ categoria, guias: lista }));
}

@Component({
  selector: 'fin-centro-de-tutoriales',
  imports: [FormsModule, HlmButton, HlmInput, IconComponent, OverlayComponent, SelectorDeIdiomaComponent],
  template: `
    <fin-overlay [title]="i18n.t('tutorial.center.title')" mode="inspector" (closed)="tutorial.cerrarCentro()">
      <div class="grid gap-5" data-testid="centro-de-tutoriales">
        <p class="text-sm text-muted-foreground">{{ i18n.t('tutorial.center.description') }}</p>
        <section class="grid gap-2" [attr.aria-label]="i18n.t('tutorial.center.language')">
          <h3 class="text-sm font-semibold">{{ i18n.t('tutorial.center.language') }}</h3>
          <fin-selector-de-idioma />
          <small class="text-xs text-muted-foreground">{{ i18n.t('tutorial.center.languageHint') }}</small>
        </section>
        <label class="grid gap-1.5 text-sm font-semibold">
          {{ i18n.t('tutorial.center.search') }}
          <input
            hlmInput
            type="search"
            name="buscarTutorial"
            data-testid="buscar-tutorial"
            [placeholder]="i18n.t('tutorial.center.searchPlaceholder')"
            [ngModel]="busqueda()"
            (ngModelChange)="busqueda.set($event)"
          />
        </label>
        <p class="text-xs text-muted-foreground" role="status">
          {{ i18n.t('tutorial.center.progress', { done: hechas(), total: guias().length }) }}
        </p>
        @for (grupo of grupos(); track grupo.categoria) {
          <section class="grid gap-2" [attr.aria-label]="grupo.categoria">
            <h3 class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{{ grupo.categoria }}</h3>
            @for (guia of grupo.guias; track guia.id) {
              <article
                class="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3"
                [attr.data-guia]="guia.id"
              >
                <div class="grid min-w-0 gap-0.5">
                  <strong class="text-sm">{{ guia.titulo }}</strong>
                  <span class="text-xs text-muted-foreground">{{ guia.resumen }}</span>
                  <small class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {{ i18n.t('tutorial.center.steps', { count: guia.pasos.length }) }}
                    @if (completada(guia.id)) {
                      <span class="inline-flex items-center gap-1 text-primary" data-testid="guia-completada">
                        <fin-icon name="check" /> {{ i18n.t('tutorial.center.done') }}
                      </span>
                    }
                  </small>
                </div>
                <button hlmBtn size="sm" type="button" (click)="empezar(guia.id)">
                  <fin-icon name="play" /> {{ i18n.t('tutorial.center.start') }}
                </button>
              </article>
            }
          </section>
        } @empty {
          <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('tutorial.center.empty') }}</p>
        }
      </div>
    </fin-overlay>
  `,
})
export class CentroDeTutorialesComponent {
  readonly i18n = inject(I18nService);
  readonly tutorial = inject(TutorialService);
  private readonly caps = inject(CAPABILITIES);
  private readonly features = inject(FEATURES);
  readonly busqueda = signal('');

  readonly guias = computed(() =>
    guiasDisponibles({
      t: (clave) => this.i18n.t(clave),
      puede: (permiso) => this.caps.allows(permiso),
      activa: (bandera) => this.features.enabled(bandera),
    }),
  );
  readonly grupos = computed(() => agruparGuias(this.guias(), this.busqueda()));
  readonly hechas = computed(() => this.guias().filter((guia) => this.tutorial.completadas().has(guia.id)).length);

  completada(id: string): boolean {
    return this.tutorial.completadas().has(id);
  }

  empezar(id: string): void {
    this.tutorial.cerrarCentro();
    setTimeout(() => void this.tutorial.iniciarGuia(id), 150);
  }
}
