import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSliderImports } from '@spartan-ng/helm/slider';
import { I18nService } from '@core/i18n';
import { P } from '@core/session';
import { AppStore, CAPABILITIES, DEFAULT_PALETTE, StoredPalette, contraste, PreferencesActions } from '@core/state';
import { FieldComponent } from '@ui/field';
import { IconComponent } from '@ui/icon';
import { ThemePreviewComponent } from '@features/preferences/theme-preview/theme-preview';

type ColorKey = 'primary' | 'background' | 'surface' | 'text' | 'border' | 'secondary';

interface Borrador {
  name: string;
  primary: string;
  secondary: string;
  text: string;
  surface: string;
  border: string;
  background: string;
  radius: number;
}

const PUNTOS_DE_PARTIDA: readonly { id: string; clave: string; paleta: Omit<Borrador, 'name' | 'radius'> }[] = [
  {
    id: 'claro',
    clave: 'preferences.studio.start.light',
    paleta: {
      primary: '#4f46e5',
      secondary: '#f1f2f6',
      text: '#1e2130',
      surface: '#ffffff',
      border: '#e4e7ec',
      background: '#f7f8fb',
    },
  },
  {
    id: 'oscuro',
    clave: 'preferences.studio.start.dark',
    paleta: {
      primary: '#8b95fa',
      secondary: '#20243d',
      text: '#eef0fa',
      surface: '#191d33',
      border: '#2b2f4a',
      background: '#0f1222',
    },
  },
  {
    id: 'bosque',
    clave: 'preferences.studio.start.forest',
    paleta: {
      primary: '#15803d',
      secondary: '#ecf5ee',
      text: '#14261a',
      surface: '#ffffff',
      border: '#d6e5da',
      background: '#f4f8f5',
    },
  },
  {
    id: 'grafito',
    clave: 'preferences.studio.start.graphite',
    paleta: {
      primary: '#f59e0b',
      secondary: '#27272a',
      text: '#f4f4f5',
      surface: '#18181b',
      border: '#3f3f46',
      background: '#09090b',
    },
  },
];

@Component({
  selector: 'fin-theme-studio',
  imports: [FormsModule, HlmButton, HlmInput, HlmSliderImports, FieldComponent, IconComponent, ThemePreviewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './theme-studio.html',
  host: { class: 'block' },
})
export class ThemeStudioComponent {
  readonly store = inject(AppStore);
  private readonly preferencesActions = inject(PreferencesActions);
  private readonly capabilities = inject(CAPABILITIES);
  readonly i18n = inject(I18nService);
  readonly puedeEditar = computed(() => this.capabilities.allows(P.preferencias.tema.editar));
  readonly puntosDePartida = PUNTOS_DE_PARTIDA;

  readonly colores: readonly { key: ColorKey; label: string }[] = [
    { key: 'primary', label: 'preferences.studio.color.primary' },
    { key: 'background', label: 'preferences.studio.color.background' },
    { key: 'surface', label: 'preferences.studio.color.surface' },
    { key: 'secondary', label: 'preferences.studio.color.secondary' },
    { key: 'text', label: 'preferences.studio.color.text' },
    { key: 'border', label: 'preferences.studio.color.border' },
  ];

  private readonly guardado = computed<Borrador>(() => {
    const p = this.store.preferences();
    if (p.customSaved) return { ...p.customSaved };
    return {
      name: p.name,
      primary: p.primary,
      secondary: p.custom ? p.secondary : PUNTOS_DE_PARTIDA[0].paleta.secondary,
      text: p.text,
      surface: p.surface,
      border: p.border,
      background: p.background ?? DEFAULT_PALETTE.background,
      radius: p.radius,
    };
  });

  readonly borrador = signal<Borrador>(this.guardado());
  readonly paletaDeVista = computed<StoredPalette>(() => ({ ...this.borrador(), accent: this.borrador().primary }));
  readonly hayCambios = computed(() => JSON.stringify(this.borrador()) !== JSON.stringify(this.guardado()));
  readonly contrasteTexto = computed(() => contraste(this.borrador().text, this.borrador().surface));
  readonly contrasteBajo = computed(() => this.contrasteTexto() < 4.5);

  cambiarColor(key: ColorKey, valor: string): void {
    this.borrador.update((b) => ({ ...b, [key]: valor }));
  }

  cambiarNombre(valor: string): void {
    this.borrador.update((b) => ({ ...b, name: valor }));
  }

  cambiarRadio(valor: number | string): void {
    this.borrador.update((b) => ({ ...b, radius: Number(valor) }));
  }

  partirDe(id: string): void {
    const punto = PUNTOS_DE_PARTIDA.find((p) => p.id === id);
    if (punto) this.borrador.update((b) => ({ ...b, ...punto.paleta }));
  }

  descartar(): void {
    this.borrador.set(this.guardado());
  }

  guardarYAplicar(): void {
    if (!this.puedeEditar()) return;
    const tema = this.borrador();
    this.preferencesActions.usarTemaPropio(tema);
    this.store.toast.set(this.i18n.t('preferences.themeSavedLog', { name: tema.name }));
  }
}
