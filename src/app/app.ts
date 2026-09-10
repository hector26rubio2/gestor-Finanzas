import { ChangeDetectionStrategy, Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { P } from './core/permissions';
import { RemoteBootstrap } from './core/remote-bootstrap';
import { IconComponent } from './ui/icon';
import { CAPABILITIES, DemoStore, navigation } from './core/store';
import { MovementFormComponent } from './forms';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MovementFormComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (cargandoSesion()) {
      <div class="cargando" role="status" aria-live="polite">
        <demo-icon name="dashboard" class="cargando-marca" />
        <b>Finanzas</b>
        <p>Cargando tu informacion…</p>
        <span class="cargando-barra"><i></i></span>
      </div>
    } @else if (!store.user() || enLogin()) {
      <router-outlet />
    } @else {
      <a class="saltar-al-contenido" href="#contenido-principal">Saltar al contenido</a>
      <div class="app" [class.collapsed]="collapsed()">
        <aside [class.mobile-open]="mobileOpen()">
          <div class="brand-row">
            <a routerLink="/dashboard" class="brand" aria-label="Finanzas, ir al inicio"
              ><demo-icon name="dashboard" class="brand-mark" /><b class="aside-label">Finanzas</b></a
            >
          </div>
          <div class="profile" [class.open]="profileOpen()">
            <button
              class="profile-trigger"
              type="button"
              (click)="profileOpen.update((v) => !v)"
              [attr.aria-expanded]="profileOpen()"
            >
              <span class="avatar">{{ userInitials() }}</span>
              <span class="profile-copy aside-label"
                ><strong>{{ store.user()?.name }}</strong
                ><small>Espacio personal</small></span
              >
              <demo-icon name="more" class="profile-more aside-label" />
            </button>
            @if (profileOpen()) {
              <div class="profile-menu">
                <div class="profile-menu-head">
                  <strong>{{ store.user()?.name }}</strong
                  ><small>{{ store.user()?.email }}</small>
                </div>
                <a routerLink="/settings" (click)="profileOpen.set(false)">Perfil y preferencias</a>
                <button type="button" (click)="logout()">Cerrar sesión</button>
              </div>
            }
          </div>
          <div class="workspace aside-label" aria-label="Espacio activo: Personal">
            <span>Personal</span><demo-icon name="chevronDown" class="workspace-caret" />
          </div>
          <nav id="primary-navigation" aria-label="Navegación principal">
            @for (group of groups(); track group) {
              <small class="aside-label">{{ group }}</small>
              @for (item of items(group); track item.path) {
                <a
                  [routerLink]="'/' + item.path"
                  routerLinkActive="active"
                  [attr.aria-label]="item.label"
                  (click)="mobileOpen.set(false)"
                  ><demo-icon class="nav-icon" [name]="item.icon" /><span class="aside-label">{{ item.label }}</span>
                  @if (item.path === 'notifications' && store.unread()) {
                    <i>{{ store.unread() }}</i>
                  }
                </a>
              }
            }
          </nav>
        </aside>
        @if (mobileOpen()) {
          <button class="scrim" aria-label="Cerrar menú" (click)="mobileOpen.set(false)"></button>
        }
        <section class="stage">
          <header class="topbar">
            <button
              class="menu-toggle"
              type="button"
              [attr.aria-expanded]="menuAbierto()"
              aria-controls="primary-navigation"
              [attr.aria-label]="menuAbierto() ? 'Cerrar menú' : 'Abrir menú'"
              (click)="alternarMenu()"
            >
              <demo-icon [name]="mobileOpen() ? 'close' : 'menu'" /></button
            ><span class="org"><demo-icon name="organization" /> Personal</span>
            <div class="top-actions">
              <button aria-label="Buscar movimientos" (click)="openSearch()"><demo-icon name="search" /></button
              ><a routerLink="/notifications" class="bell" aria-label="Notificaciones"
                ><demo-icon name="notifications" />
                @if (store.unread()) {
                  <i>{{ store.unread() }}</i>
                }
              </a>
              @if (caps.allows(P.movimientos.crear)) {
                <button class="primary" (click)="store.open()"><demo-icon name="plus" /> Nuevo movimiento</button>
              }
            </div>
          </header>
          <main id="contenido-principal" tabindex="-1"><router-outlet /></main>
        </section>
      </div>
      @if (store.form() && store.form()?.kind !== 'account') {
        <demo-movement-form />
      }
      @if (store.toast()) {
        <div class="toast" role="status">
          {{ store.toast() }}<button aria-label="Cerrar aviso" (click)="store.toast.set('')">×</button>
        </div>
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100dvh;
      }
      /*
       * Un unico momento, al entrar. Al pasar de la pantalla de acceso al armazon el
       * documento crece de golpe —de 986 a 3076 px medidos— y el corte se ve como un
       * tiron. Solo opacidad: nada de deslizamiento, que es el efecto por defecto de
       * cualquier plantilla y aqui no aporta.
       */
      @keyframes entrada-del-armazon {
        from {
          opacity: 0;
        }
      }
      .app {
        animation: entrada-del-armazon 0.26s ease-out both;
      }
      .cargando {
        min-height: 100dvh;
        display: grid;
        align-content: center;
        justify-items: center;
        gap: 10px;
        background: var(--bg);
        color: var(--text);
        padding: 24px;
      }
      .cargando-marca {
        --icon-size: 34px;
        color: var(--accent);
      }
      .cargando b {
        font: 700 1.3rem/1.1 var(--display);
        letter-spacing: -0.02em;
      }
      .cargando p {
        margin: 0;
        color: var(--muted);
        font-size: 0.86rem;
      }
      /* Una linea que se traza: indeterminada, porque no sabemos cuanto falta. */
      .cargando-barra {
        margin-top: 8px;
        width: min(220px, 60vw);
        height: 2px;
        border-radius: 2px;
        background: var(--line);
        overflow: hidden;
      }
      .cargando-barra i {
        display: block;
        width: 40%;
        height: 100%;
        border-radius: 2px;
        background: var(--accent);
        animation: recorrido-de-carga 1.1s ease-in-out infinite;
      }
      @keyframes recorrido-de-carga {
        from {
          transform: translateX(-100%);
        }
        to {
          transform: translateX(350%);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .cargando-barra i {
          animation: none;
          width: 100%;
          opacity: 0.55;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .app {
          animation: none;
        }
      }
      .app {
        display: grid;
        grid-template-columns: 238px minmax(0, 1fr);
        min-height: 100dvh;
      }
      .app.collapsed {
        grid-template-columns: 70px minmax(0, 1fr);
      }
      aside {
        position: sticky;
        top: 0;
        height: 100dvh;
        background: var(--nav);
        border-right: 1px solid var(--line);
        display: flex;
        flex-direction: column;
        padding: 18px 12px;
        z-index: 20;
        /*
         * Excepcion consciente: contraer el carril cambia el ancho del documento y el
         * contenido tiene que reacomodarse, asi que no hay equivalente en transform.
         * Es un solo elemento y una accion ocasional; se iguala a la duracion del resto.
         */
        transition: width 0.16s ease-out;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 1.14rem;
        color: var(--text);
        text-decoration: none;
        padding: 4px 6px;
        min-width: 0;
      }
      .brand-row {
        display: flex;
        align-items: center;
        min-height: 40px;
        margin: 0 2px 12px;
      }
      .brand span {
        color: var(--accent);
        font-size: 1.5rem;
      }
      .workspace {
        display: flex;
        align-items: center;
        gap: 10px;
        border: 1px solid var(--line);
        background: var(--surface);
        color: var(--text);
        padding: 7px 10px;
        border-radius: 11px;
        width: 100%;
        margin: 5px 4px 12px;
        justify-content: space-between;
        font-size: 0.72rem;
        color: var(--muted);
      }
      .avatar {
        display: grid;
        place-items: center;
        width: 29px;
        height: 29px;
        border-radius: 9px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 0.72rem;
        font-weight: 700;
      }
      .collapsed .aside-label {
        display: none;
      }
      .collapsed .brand {
        justify-content: center;
        padding-inline: 0;
      }
      .collapsed .brand-row {
        flex-direction: column;
        gap: 6px;
        margin-bottom: 10px;
      }
      .collapsed nav a {
        justify-content: center;
      }
      .collapsed nav a i {
        position: absolute;
        right: 5px;
      }
      nav {
        min-height: 0;
        overflow: auto;
        scrollbar-width: none;
      }
      nav small {
        display: block;
        color: var(--muted);
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        padding: 14px 10px 7px;
      }
      nav a {
        position: relative;
        display: flex;
        gap: 12px;
        align-items: center;
        color: var(--muted);
        text-decoration: none;
        padding: 9px 10px;
        border-radius: 10px;
        margin: 2px 0;
        font-size: 0.82rem;
        font-weight: 550;
      }
      @media (hover: hover) and (pointer: fine) {
        nav a:hover {
          background: var(--accent-soft);
        }
        nav a:hover .nav-icon,
        .profile-trigger:hover,
        .profile-menu a:hover,
        .profile-menu button:hover {
          color: inherit;
        }
      }
      nav a:hover,
      nav a.active {
        background: var(--accent-soft);
        color: var(--accent);
      }
      nav a i,
      .bell i {
        background: var(--accent);
        color: var(--accent-contrast);
        font-style: normal;
        font-size: 0.72rem;
        border-radius: 20px;
        padding: 2px 5px;
        margin-left: auto;
      }
      .nav-icon {
        --icon-size: 19px;
        color: var(--muted);
      }
      nav a[aria-current='page'] .nav-icon,
      nav a:hover .nav-icon {
        color: inherit;
      }
      .brand-mark {
        --icon-size: 22px;
        color: var(--accent);
      }
      .org demo-icon,
      .menu-toggle demo-icon,
      .top-actions demo-icon {
        --icon-size: 18px;
      }
      .org {
        display: inline-flex;
        align-items: center;
        gap: 7px;
      }
      .top-actions .primary {
        display: inline-flex;
        align-items: center;
        gap: 7px;
      }
      .menu-toggle,
      .top-actions button,
      .bell {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .profile-more {
        --icon-size: 16px;
      }
      .profile {
        position: relative;
        margin: 0 2px 7px;
      }
      .profile-trigger {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 9px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--text);
        padding: 7px;
        border-radius: 11px;
        text-align: left;
      }
      .profile-trigger:hover {
        background: var(--accent-soft);
      }
      .profile-trigger .avatar {
        flex: 0 0 29px;
      }
      .profile-copy {
        min-width: 0;
        display: grid;
        line-height: 1.15;
      }
      .profile-copy strong {
        font-size: 0.75rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .profile-copy small {
        color: var(--muted);
        font-size: 0.72rem;
        margin-top: 3px;
      }
      .profile-more {
        margin-left: auto;
        color: var(--muted);
        letter-spacing: 1px;
      }
      .profile-menu {
        position: absolute;
        z-index: 30;
        left: 0;
        top: calc(100% + 6px);
        width: 218px;
        padding: 6px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--surface);
        box-shadow: var(--shadow);
        display: grid;
      }
      .profile-menu-head {
        display: grid;
        gap: 2px;
        padding: 8px 10px 10px;
        border-bottom: 1px solid var(--line);
        margin-bottom: 4px;
      }
      .profile-menu-head small {
        color: var(--muted);
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .profile-menu a,
      .profile-menu button {
        text-align: left;
        border: 0;
        background: transparent;
        color: var(--text);
        text-decoration: none;
        padding: 10px;
        border-radius: 8px;
      }
      .profile-menu a:hover,
      .profile-menu button:hover {
        background: var(--accent-soft);
      }
      .collapsed .profile {
        order: 2;
      }
      .collapsed .profile-trigger {
        justify-content: center;
        padding: 6px 0;
      }
      .collapsed .profile-menu {
        left: 52px;
        top: 0;
      }
      .stage {
        display: flex;
        min-width: 0;
        min-height: 100dvh;
        flex-direction: column;
      }
      .topbar {
        position: sticky;
        top: 0;
        z-index: 10;
        height: 64px;
        display: flex;
        align-items: center;
        padding: 0 28px;
        border-bottom: 1px solid var(--line);
        background: color-mix(in srgb, var(--bg) 90%, transparent);
        backdrop-filter: blur(14px);
      }
      .org {
        font-size: 0.82rem;
      }
      .top-actions {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 9px;
      }
      .top-actions button,
      .bell,
      .menu-toggle {
        border: 1px solid var(--line);
        background: var(--surface);
        color: var(--text);
        min-height: 36px;
        padding: 8px 11px;
        border-radius: 9px;
        text-decoration: none;
      }
      /*
       * El mínimo táctil de 44px vive en styles.css, pero como regla sobre \`button\` la
       * vence cualquier selector de componente por especificidad. Se repite aquí con el
       * mismo alcance para que no se pierda en el dedo del usuario.
       */
      @media (pointer: coarse) {
        .menu-toggle,
        .top-actions button,
        .top-actions .primary,
        .bell {
          min-height: 44px;
        }
      }
      .top-actions .primary {
        background: var(--accent);
        color: var(--accent-contrast);
        border-color: var(--accent);
        font-weight: 650;
      }
      .bell {
        position: relative;
      }
      .bell i {
        position: absolute;
        right: -5px;
        top: -6px;
      }
      .menu-toggle {
        margin-right: 10px;
      }
      main {
        min-width: 0;
        flex: 1;
        padding: 24px 28px;
      }
      .toast {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 100;
        background: var(--text);
        color: var(--bg);
        padding: 13px 16px;
        border-radius: 12px;
        box-shadow: var(--shadow);
        max-width: 420px;
      }
      .toast button {
        border: 0;
        background: transparent;
        color: inherit;
        margin-left: 14px;
      }
      .scrim {
        display: none;
      }
      @media (max-width: 780px) {
        .app,
        .app.collapsed {
          display: block;
        }
        .stage {
          min-height: 100dvh;
        }
        aside {
          position: fixed;
          left: 0;
          transform: translateX(-102%);
          width: min(286px, 85vw);
          box-shadow: var(--shadow);
        }
        aside.mobile-open {
          transform: none;
        }
        .scrim {
          display: block;
          position: fixed;
          inset: 0;
          border: 0;
          background: #001c1788;
          z-index: 19;
        }

        .topbar {
          padding: 0 14px;
        }
        .org {
          display: none;
        }
        .primary {
          font-size: 0;
        }
        .primary::after {
          content: '＋';
          font-size: 1rem;
        }
        main {
          padding: 18px 14px;
        }
      }
    `,
  ],
})
export class AppComponent {
  readonly store = inject(DemoStore);
  readonly caps = inject(CAPABILITIES);
  readonly P = P;
  private router = inject(Router);
  private readonly arranque = inject(RemoteBootstrap);
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
  readonly allowed = computed(() => navigation.filter((n) => this.caps.allows(n.capability)));
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
