import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiAdminRole, ApiOrganizationMember, FinanceApiClient } from '../../core/api-client';
import { IconComponent } from '../../ui/icon';
import { UiOption, UiSelectComponent } from '../../ui/select';
import { P } from '../../core/permissions';
import { RemoteBootstrap } from '../../core/remote-bootstrap';
import { applyTheme, CAPABILITIES, DemoStore } from '../../core/store';
import { I18nService } from '../../core/i18n';

@Component({
  selector: 'app-preferences-tab',
  standalone: true,
  imports: [FormsModule, IconComponent, UiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './preferences-tab.html',
  styleUrl: './preferences-tab.css',
})
export class PreferencesTabComponent implements OnInit {
  readonly store = inject(DemoStore);
  private readonly capabilities = inject(CAPABILITIES);
  private readonly arranque = inject(RemoteBootstrap);
  private api = inject(FinanceApiClient);
  readonly i18n = inject(I18nService);
  readonly P = P;
  can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }
  /** Reactivo: el sondeo de sesion cambia permisos y la interfaz debe seguirlo. */
  readonly canCustomize = computed(() => this.capabilities.allows(P.preferencias.tema.editar));

  readonly miembros = signal<readonly ApiOrganizationMember[]>([]);
  readonly rolesDisponibles = signal<readonly ApiAdminRole[]>([]);
  readonly roleOptions = computed<readonly UiOption[]>(() =>
    this.rolesDisponibles().map((role) => ({ value: role.id, label: role.name })),
  );
  readonly errorDeInvitacion = signal('');
  correoInvitado = '';
  nombreInvitado = '';
  rolInvitado = '';

  private readonly themeDefs = [
    { id: 'system', key: 'preferences.theme.system', preview: 'linear-gradient(135deg,#fff 50%,#191d33 50%)' },
    { id: 'light', key: 'preferences.theme.light', preview: 'linear-gradient(135deg,#fff 50%,#4f46e5 50%)' },
    { id: 'dark', key: 'preferences.theme.dark', preview: 'linear-gradient(135deg,#14172a 50%,#818cf8 50%)' },
    { id: 'ocean', key: 'preferences.theme.ocean', preview: 'linear-gradient(135deg,#0a2033 50%,#38bdf8 50%)' },
    { id: 'sand', key: 'preferences.theme.sand', preview: 'linear-gradient(135deg,#fffaf2 50%,#a24f2a 50%)' },
    { id: 'berry', key: 'preferences.theme.berry', preview: 'linear-gradient(135deg,#301a37 50%,#f0abfc 50%)' },
  ] as const;
  readonly themes = computed(() =>
    this.themeDefs.map((theme) => ({ id: theme.id, label: this.i18n.t(theme.key), preview: theme.preview })),
  );
  readonly fonts = [
    { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
    { label: 'DM Sans', value: "'DM Sans', system-ui, sans-serif" },
    { label: 'Manrope', value: 'Manrope, system-ui, sans-serif' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
    { label: 'Trebuchet', value: "'Trebuchet MS', sans-serif" },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Palatino', value: "'Palatino Linotype', serif" },
    { label: 'Courier', value: "'Courier New', monospace" },
    { label: 'System UI', value: 'system-ui, sans-serif' },
  ];
  readonly fontOptions: readonly UiOption[] = this.fonts.map((font) => ({ value: font.value, label: font.label }));
  readonly languageOptions: readonly UiOption[] = [
    { value: 'es-CO', label: 'Español (Colombia)' },
    { value: 'en-US', label: 'English (United States)' },
    { value: 'pt-BR', label: 'Português (Brasil)' },
    { value: 'fr-FR', label: 'Français' },
  ];
  readonly densityOptions = computed<readonly UiOption[]>(() => [
    { value: 'comfortable', label: this.i18n.t('preferences.density.comfortable') },
    { value: 'compact', label: this.i18n.t('preferences.density.compact') },
  ]);

  ngOnInit(): void {
    void this.cargarMiembros();
  }

  /**
   * Suma a alguien al espacio.
   *
   * No se manda correo: la invitacion deja la membresia pendiente y la persona entra la
   * primera vez que inicia sesion con esa direccion. Montar envio de correo es otro
   * problema —servidor, dominio verificado, rebotes— y fingirlo seria peor que no tenerlo.
   */
  async invitar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.errorDeInvitacion.set('');
    const email = this.correoInvitado.trim();
    if (!email || !this.rolInvitado) return;
    try {
      const miembro = await firstValueFrom(
        this.api.inviteOrganizationMember({
          email,
          displayName: this.nombreInvitado.trim() || undefined,
          roleIds: [this.rolInvitado],
        }),
      );
      this.miembros.update((xs) => [...xs, miembro]);
      this.correoInvitado = '';
      this.nombreInvitado = '';
      this.store.toast.set(this.i18n.t('preferences.invite.successToast', { email: miembro.email }));
    } catch (error) {
      this.errorDeInvitacion.set(error instanceof Error ? error.message : this.i18n.t('preferences.invite.error'));
    }
  }

  private async cargarMiembros(): Promise<void> {
    if (this.store.runtime.mode !== 'api' || !this.can(P.organizacion.miembros.listar)) return;
    try {
      const [gente, roles] = await Promise.all([
        firstValueFrom(this.api.organizationMembers()),
        this.can(P.administracion.roles.listar) ? firstValueFrom(this.api.adminRoles()) : Promise.resolve([]),
      ]);
      this.miembros.set(gente);
      this.rolesDisponibles.set(roles);
      if (!this.rolInvitado && roles.length) this.rolInvitado = roles[0].id;
    } catch {
      /* sin lista: la seccion queda vacia y el resto de Preferencias sigue */
    }
  }

  setTheme(theme: (typeof this.themeDefs)[number]['id']): void {
    this.store.preferences.update((p) => ({ ...p, theme }));
    applyTheme(theme);
    this.persistPreferences();
  }
  setFont(font: string): void {
    this.store.preferences.update((p) => ({ ...p, font }));
    document.documentElement.style.setProperty('--font', font);
    this.persistPreferences();
  }
  async setLocale(locale: string): Promise<void> {
    this.store.preferences.update((value) => ({ ...value, locale }));
    // Espera el catálogo del idioma nuevo: pedirlo antes de que cargue mostraba el
    // aviso de "cambiado" todavía en el idioma anterior.
    await this.i18n.load(locale);
    this.store.log(this.i18n.t('preferences.localeUpdatedLog'));
    this.persistPreferences();
  }
  setAccent(accent: string): void {
    this.store.preferences.update((value) => ({ ...value, accent }));
    document.documentElement.style.setProperty('--accent', accent);
    this.persistPreferences();
  }
  setThemeValue(key: 'name' | 'primary' | 'secondary' | 'text' | 'surface' | 'border', value: string): void {
    this.store.preferences.update((preferences) => ({ ...preferences, [key]: value }));
    const cssKey = (
      {
        primary: '--accent',
        secondary: '--secondary',
        text: '--text',
        surface: '--surface',
        border: '--line',
      } as Record<string, string>
    )[key];
    if (cssKey) document.documentElement.style.setProperty(cssKey, value);
  }
  saveCustomTheme(): void {
    this.persistPreferences();
    this.store.log(this.i18n.t('preferences.themeSavedLog', { name: this.store.preferences().name }));
  }
  setDensity(density: 'comfortable' | 'compact'): void {
    this.store.preferences.update((value) => ({ ...value, density }));
    document.documentElement.dataset['density'] = density;
    this.persistPreferences();
  }
  setRadius(radius: number | string): void {
    const value = Number(radius);
    this.store.preferences.update((preferences) => ({ ...preferences, radius: value }));
    document.documentElement.style.setProperty('--radius', `${value}px`);
    this.persistPreferences();
  }
  private persistPreferences(): void {
    void this.store
      .persistPreferences()
      .catch((error) =>
        this.store.toast.set(error instanceof Error ? error.message : this.i18n.t('preferences.saveError')),
      );
  }
  async logout(): Promise<void> {
    await this.arranque.cerrarSesion();
  }
}
