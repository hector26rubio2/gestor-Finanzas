import { ChangeDetectionStrategy, Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { P } from './core/permissions';
import { I18nService } from './core/i18n';
import { RemoteBootstrap } from './core/remote-bootstrap';
import { IconComponent } from './ui/icon';
import { CAPABILITIES, DemoStore, FEATURES, navigation } from './core/store';
import { MovementFormComponent } from './forms';

/**
 * Kinds de `store.form()` que abren su propio formulario (cuenta, categoría, persona,
 * inversión, recurrencia) y no deben mostrar además el formulario de movimiento.
 *
 * Antes esta condición solo excluía 'account': crear una categoría, persona, inversión
 * o recurrencia abría a la vez su formulario correcto (en workspace.ts) y este
 * formulario de movimiento por encima, tapándolo. El campo `kind` es el mismo string
 * que workspace.ts usa para decidir su propio formulario (`['category', 'person',
 * 'investment', 'recurrence']`); se repite aquí en vez de importarlo para no acoplar
 * el armazón a esa página.
 */
const FORM_KINDS_SIN_MOVIMIENTO: readonly string[] = ['account', 'category', 'person', 'investment', 'recurrence'];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MovementFormComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent {
  readonly store = inject(DemoStore);
  readonly caps = inject(CAPABILITIES);
  private readonly features = inject(FEATURES);
  readonly P = P;
  private router = inject(Router);
  private readonly arranque = inject(RemoteBootstrap);
  readonly i18n = inject(I18nService);
  private readonly cargarIdioma = effect(() => void this.i18n.load(this.store.preferences().locale));
  /** Nombre del espacio activo; la sesion lo trae y antes estaba escrito a mano. */
  readonly espacioActivo = computed(() => this.store.organization()?.name ?? this.i18n.t('shell.personal'));
  readonly collapsed = signal(false);
  readonly mobileOpen = signal(false);

  /**
   * El menú se abre y se cierra con un solo control, el de la barra superior.
   *
   * Antes eran dos botones separados con dos significados: el «☰» solo abría —cerrar
   * exigía tocar el velo— y dentro del panel había otro que colapsaba. Ahora hay uno, y
   * el ancho decide qué es «abrir»: en pantalla estrecha el panel se superpone, en ancha
   * se contrae a su carril de iconos.
   */
  /**
   * `matchMedia` puede no existir: no basta con comprobar que hay `window`. Falta en
   * renderizado de servidor, en algunos entornos de prueba y en webviews viejas. Sin
   * esta comprobación el armazón entero reventaba al construirse.
   */
  private readonly consultaEstrecha =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 780px)')
      : null;
  private readonly estrecha = signal(this.consultaEstrecha?.matches ?? false);
  readonly menuAbierto = computed(() => (this.estrecha() ? this.mobileOpen() : !this.collapsed()));

  constructor() {
    this.router.events.subscribe((evento) => {
      if (evento instanceof NavigationEnd)
        this.enLogin.set(evento.urlAfterRedirects.split(/[?#]/)[0].replace(/\/$/, '').endsWith('/login'));
    });
    this.consultaEstrecha?.addEventListener('change', (evento) => {
      this.estrecha.set(evento.matches);
      // Al pasar a pantalla ancha el panel vuelve a su sitio: dejar abierta la
      // superposición mostraría el velo sobre un menú que ya no lo necesita.
      if (!evento.matches) this.mobileOpen.set(false);
    });
  }

  alternarMenu(): void {
    if (this.estrecha()) this.mobileOpen.update((v) => !v);
    else this.collapsed.update((v) => !v);
  }

  /**
   * Si la ruta activa es la de entrada. El armazón se decidía solo con `store.user()`, y
   * eso pintaba el login dentro del layout: al recargar contra la API la sesión tarda,
   * el guard te manda a `/login` mientras no hay usuario, y cuando la sesión resuelve el
   * armazón aparece alrededor de una pantalla de entrada que ya no hace falta.
   */
  readonly enLogin = signal(false);

  /**
   * Mientras el servidor resuelve la sesion y trae los datos.
   *
   * Al volver de Google la aplicacion aterrizaba sin usuario todavia, el guard la mandaba
   * a la pantalla de acceso, y se pintaba entera —con su panel de portada y sus
   * selectores— solo para desaparecer un instante despues. Con una instancia fria del
   * servidor eso son segundos de una pantalla que no corresponde, y luego un salto al
   * dashboard.
   *
   * `remoteState` pasa a «ready» cuando ya estan cargados movimientos, cuentas, personas,
   * preferencias y banderas, asi que esta ventana cubre justo lo que hay que esperar.
   */
  readonly cargandoSesion = computed(() => this.store.runtime.mode === 'api' && this.store.remoteState() === 'loading');

  /**
   * A dónde ir tras entrar. No a `/dashboard` a ciegas: quien no tenga `dashboard.ver`
   * sería devuelto por el guard a esa misma ruta. Se va a la primera que sí tenga.
   */
  private readonly primeraRutaPermitida = computed(() => this.allowed()[0]?.path ?? 'dashboard');

  private readonly salirDeLaEntrada = effect(() => {
    if (this.store.user() && this.enLogin()) void this.router.navigateByUrl('/' + this.primeraRutaPermitida());
  });
  readonly profileOpen = signal(false);
  /**
   * Si lo que hay abierto es un movimiento.
   *
   * La plantilla no ve las constantes del modulo -Angular resuelve los nombres contra la
   * instancia del componente-, asi que la decision vive aqui; de paso la condicion deja
   * de leer la señal tres veces en la misma linea.
   */
  readonly abreFormularioDeMovimiento = computed(() => {
    const formulario = this.store.form();
    return !!formulario && !FORM_KINDS_SIN_MOVIMIENTO.includes(formulario.kind ?? '');
  });
  readonly allowed = computed(() =>
    navigation.filter((n) => this.caps.allows(n.capability) && this.features.enabled(n.path)),
  );
  readonly groups = computed(() => [...new Set(this.allowed().map((n) => n.group))]);
  items(group: string) {
    return this.allowed().filter((i) => i.group === group);
  }
  userInitials(): string {
    return (this.store.user()?.name ?? 'Usuario')
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }
  openSearch(): void {
    void this.router.navigate(['/movements'], { queryParams: { focus: 'search' } });
  }
  @HostListener('document:keydown.escape')
  closeMobileMenu(): void {
    this.mobileOpen.set(false);
    this.profileOpen.set(false);
  }
  async logout(): Promise<void> {
    this.profileOpen.set(false);
    await this.arranque.cerrarSesion();
  }
}
