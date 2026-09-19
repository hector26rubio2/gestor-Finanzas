import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { P } from './core/permissions';
import { safeReturnPath } from './core/return-url';
import { I18nService } from './core/i18n';
import { RemoteBootstrap } from './core/remote-bootstrap';
import { IconComponent } from './ui/icon';
import { CAPABILITIES, AppStore, FEATURES, navigation } from './core/store';
import { BugReportButtonComponent } from './features/bug-report/bug-report';
import { MovementFormComponent } from './features/movement-form/movement-form';
import { NgxSonnerToaster } from 'ngx-sonner';
import {
  HlmDropdownMenu,
  HlmDropdownMenuItem,
  HlmDropdownMenuLabel,
  HlmDropdownMenuTrigger,
} from '@spartan-ng/helm/dropdown-menu';
import { HlmSidebar, HlmSidebarWrapper, HlmSidebarMenuButton } from '@spartan-ng/helm/sidebar';
import { HlmSidebarService } from './ui/helm/sidebar/src/lib/hlm-sidebar.service';

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
  imports: [
    NgTemplateOutlet,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MovementFormComponent,
    IconComponent,
    BugReportButtonComponent,
    NgxSonnerToaster,
    HlmSidebar,
    HlmSidebarWrapper,
    HlmSidebarMenuButton,
    HlmDropdownMenu,
    HlmDropdownMenuItem,
    HlmDropdownMenuLabel,
    HlmDropdownMenuTrigger,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent {
  readonly store = inject(AppStore);
  readonly caps = inject(CAPABILITIES);
  private readonly features = inject(FEATURES);
  readonly P = P;
  private router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly arranque = inject(RemoteBootstrap);
  readonly i18n = inject(I18nService);
  private readonly cargarIdioma = effect(() => void this.i18n.load(this.store.preferences().locale));
  /** Nombre del espacio activo; la sesion lo trae y antes estaba escrito a mano. */
  readonly espacioActivo = computed(() => this.store.organization()?.name ?? this.i18n.t('shell.personal'));
  readonly sidebar = inject(HlmSidebarService);
  readonly collapsed = computed(() => !this.sidebar.isMobile() && !this.sidebar.open());
  readonly mobileOpen = this.sidebar.openMobile;

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
  readonly menuAbierto = computed(() => (this.sidebar.isMobile() ? this.mobileOpen() : this.sidebar.open()));

  constructor() {
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((evento) => {
      if (evento instanceof NavigationEnd) {
        const ruta = evento.urlAfterRedirects.split(/[?#]/)[0].replace(/\/$/, '');
        this.enLogin.set(ruta.endsWith('/login'));
        this.rutaActual.set(ruta);
      }
    });
  }

  alternarMenu(): void {
    this.sidebar.toggleSidebar();
  }

  /**
   * Si la ruta activa es la de entrada. El armazón se decidía solo con `store.user()`, y
   * eso pintaba el login dentro del layout: al recargar contra la API la sesión tarda,
   * el guard te manda a `/login` mientras no hay usuario, y cuando la sesión resuelve el
   * armazón aparece alrededor de una pantalla de entrada que ya no hace falta.
   */
  readonly enLogin = signal(false);
  /** Ruta activa sin consulta, para reubicar a la persona si esa sección se le cierra. */
  private readonly rutaActual = signal('');

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
    if (!this.store.user() || !this.enLogin()) return;
    // Si la persona venía de una vista concreta (recarga, enlace o sesión caducada), se
    // vuelve a ella; el guard la redirige si no la tiene abierta.
    const volver = safeReturnPath(this.router.parseUrl(this.router.url).queryParams['returnUrl']);
    void this.router.navigateByUrl(volver ?? '/' + this.primeraRutaPermitida());
  });

  /**
   * Si un cambio de permisos o de banderas cierra la sección en la que está, se la
   * reubica en la primera abierta. El guard solo corre al navegar: sin esto la persona se
   * quedaba viendo una pantalla que ya no le corresponde hasta que cambiara de ruta.
   */
  private readonly reubicarSiSeCierraLaRuta = effect(() => {
    if (this.store.remoteState() !== 'ready' || !this.store.user() || this.enLogin()) return;
    const abiertas = this.allowed().map((entrada) => entrada.path);
    const seccion = this.rutaActual().split('/')[1];
    if (!seccion || seccion === 'sin-acceso') return;
    if (!navigation.some((entrada) => entrada.path === seccion) || abiertas.includes(seccion)) return;
    void this.router.navigateByUrl(abiertas[0] ? '/' + abiertas[0] : '/sin-acceso');
  });
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
    this.sidebar.setOpenMobile(false);
  }
  async logout(): Promise<void> {
    await this.arranque.cerrarSesion();
  }
}
