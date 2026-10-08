import { PrecargaBajoDemanda } from '@core/routing/precarga';
import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, afterNextRender, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { P } from '@core/session/permissions';
import { safeReturnPath } from '@core/session/return-url';
import { I18nService } from '@core/i18n';
import { RemoteBootstrap } from '@core/session/remote-bootstrap';
import { IconComponent } from '@ui/icon/icon';
import { CAPABILITIES, AppStore, FEATURES, navigation } from '@core/state/store';
import { TablerosService } from '@pages/dashboard/tableros/tableros.service';
import { BugReportButtonComponent } from '@features/bug-report/bug-report';
import { CommandPaletteComponent } from '@shared/command-palette/command-palette';
import { CommandPaletteService } from '@shared/command-palette/command-palette.service';
import { MovementFormComponent } from '@features/movement-form/movement-form';
import { HlmToaster } from '@spartan-ng/helm/sonner';
import { HlmKbdImports } from '@spartan-ng/helm/kbd';
import {
  HlmDropdownMenu,
  HlmDropdownMenuItem,
  HlmDropdownMenuLabel,
  HlmDropdownMenuTrigger,
} from '@spartan-ng/helm/dropdown-menu';
import {
  HlmSidebar,
  HlmSidebarGroup,
  HlmSidebarGroupContent,
  HlmSidebarGroupLabel,
  HlmSidebarWrapper,
  HlmSidebarMenu,
  HlmSidebarMenuAction,
  HlmSidebarMenuBadge,
  HlmSidebarMenuButton,
  HlmSidebarMenuItem,
  HlmSidebarMenuSub,
  HlmSidebarMenuSubButton,
  HlmSidebarMenuSubItem,
} from '@spartan-ng/helm/sidebar';
import { ADMIN_TABS } from '@pages/admin/admin-tabs';
import { HlmAvatar, HlmAvatarFallback, HlmAvatarImage } from '@spartan-ng/helm/avatar';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSkeleton } from '@spartan-ng/helm/skeleton';
import { SkeletonComponent } from '@ui/skeleton';
import { HlmSidebarService } from './ui/helm/sidebar/src/lib/hlm-sidebar.service';

const FORM_KINDS_SIN_MOVIMIENTO: readonly string[] = ['account', 'category', 'person', 'investment', 'recurrence'];

const GRUPOS_CERRADOS_KEY = 'finanzas.sidebar.grupos-cerrados';
const RANGO_DE_TABLETA = '(min-width: 768px) and (max-width: 1199px)';

function leerGruposCerrados(): ReadonlySet<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(GRUPOS_CERRADOS_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function guardarGruposCerrados(grupos: ReadonlySet<string>): void {
  try {
    localStorage.setItem(GRUPOS_CERRADOS_KEY, JSON.stringify([...grupos]));
  } catch {
    return;
  }
}

@Component({
  selector: 'app-root',
  host: {
    '(document:keydown)': 'atajoDeBusqueda($event)',
    '(document:keydown.escape)': 'closeMobileMenu()',
  },
  imports: [
    CommandPaletteComponent,
    NgTemplateOutlet,
    HlmAvatar,
    HlmAvatarFallback,
    HlmAvatarImage,
    HlmButton,
    HlmSkeleton,
    SkeletonComponent,
    HlmSidebarGroup,
    HlmSidebarGroupContent,
    HlmSidebarGroupLabel,
    HlmSidebarMenu,
    HlmSidebarMenuAction,
    HlmSidebarMenuBadge,
    HlmSidebarMenuItem,
    HlmSidebarMenuSub,
    HlmSidebarMenuSubButton,
    HlmSidebarMenuSubItem,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MovementFormComponent,
    IconComponent,
    BugReportButtonComponent,
    HlmToaster,
    HlmKbdImports,
    HlmSidebar,
    HlmSidebarWrapper,
    HlmSidebarMenuButton,
    HlmDropdownMenu,
    HlmDropdownMenuItem,
    HlmDropdownMenuLabel,
    HlmDropdownMenuTrigger,
  ],
  templateUrl: './app.html',
})
export class AppComponent {
  readonly store = inject(AppStore);
  readonly caps = inject(CAPABILITIES);
  private readonly features = inject(FEATURES);
  readonly paleta = inject(CommandPaletteService);
  readonly precarga = inject(PrecargaBajoDemanda);
  readonly P = P;
  private router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly arranque = inject(RemoteBootstrap);
  readonly i18n = inject(I18nService);
  private readonly cargarIdioma = effect(() => void this.i18n.load(this.store.preferences().locale));
  readonly espacioActivo = computed(() => this.store.organization()?.name ?? this.i18n.t('shell.personal'));
  readonly sidebar = inject(HlmSidebarService);
  readonly collapsed = computed(() => !this.sidebar.isMobile() && !this.sidebar.open());
  readonly mobileOpen = this.sidebar.openMobile;

  readonly menuAbierto = computed(() => (this.sidebar.isMobile() ? this.mobileOpen() : this.sidebar.open()));

  constructor() {
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((evento) => {
      if (evento instanceof NavigationEnd) {
        const ruta = evento.urlAfterRedirects.split(/[?#]/)[0].replace(/\/$/, '');
        this.enLogin.set(ruta.endsWith('/login'));
        this.rutaActual.set(ruta);
        this.pestanaAdmin.set(this.router.parseUrl(evento.urlAfterRedirects).queryParams['tab'] ?? 'summary');
        if (ruta === '/admin') this.adminAbierto.set(true);
      }
    });
    afterNextRender(() => this.usarRielEnTableta());
  }

  private usarRielEnTableta(): void {
    if (typeof window.matchMedia !== 'function') return;
    const tableta = window.matchMedia(RANGO_DE_TABLETA);
    const preferida = this.sidebar.open();
    const aplicar = () => this.sidebar.setOpen(tableta.matches ? false : preferida);
    if (tableta.matches) aplicar();
    tableta.addEventListener('change', aplicar);
    this.destroyRef.onDestroy(() => tableta.removeEventListener('change', aplicar));
  }

  readonly pestanaAdmin = signal('summary');
  readonly adminAbierto = signal(false);
  readonly pestanasAdmin = computed(() => ADMIN_TABS.filter((tab) => this.caps.allows(tab.capability)));
  private readonly gruposCerrados = signal<ReadonlySet<string>>(leerGruposCerrados());

  grupoCerrado(group: string): boolean {
    return !this.collapsed() && this.gruposCerrados().has(group);
  }

  alternarGrupo(group: string): void {
    this.gruposCerrados.update((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(group)) siguiente.delete(group);
      else siguiente.add(group);
      guardarGruposCerrados(siguiente);
      return siguiente;
    });
  }

  enAdmin(pestana: string): boolean {
    return this.rutaActual() === '/admin' && this.pestanaAdmin() === pestana;
  }

  alternarMenu(): void {
    this.sidebar.toggleSidebar();
  }

  readonly enLogin = signal(false);
  private readonly rutaActual = signal('');

  readonly esqueletoDelMenu = [1, 2, 3, 4, 5, 6, 7, 8];
  readonly cargandoSesion = computed(() => this.store.remoteState() === 'loading');

  private readonly primeraRutaPermitida = computed(() => this.allowed()[0]?.path ?? 'dashboard');

  private readonly salirDeLaEntrada = effect(() => {
    if (!this.store.user() || !this.enLogin()) return;
    const volver = safeReturnPath(this.router.parseUrl(this.router.url).queryParams['returnUrl']);
    void this.router.navigateByUrl(volver ?? '/' + this.primeraRutaPermitida());
  });

  private readonly reubicarSiSeCierraLaRuta = effect(() => {
    if (this.store.remoteState() !== 'ready' || !this.store.user() || this.enLogin()) return;
    const abiertas = this.allowed().map((entrada) => entrada.path);
    const seccion = this.rutaActual().split('/')[1];
    if (!seccion || seccion === 'sin-acceso') return;
    if (!navigation.some((entrada) => entrada.path === seccion) || abiertas.includes(seccion)) return;
    void this.router.navigateByUrl(abiertas[0] ? '/' + abiertas[0] : '/sin-acceso');
  });
  readonly abreFormularioDeMovimiento = computed(() => {
    const formulario = this.store.form();
    return !!formulario && !FORM_KINDS_SIN_MOVIMIENTO.includes(formulario.kind ?? '');
  });
  readonly tableros = inject(TablerosService);
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
  atajoDeBusqueda(evento: KeyboardEvent): void {
    if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
      evento.preventDefault();
      this.paleta.alternar();
    }
  }
  closeMobileMenu(): void {
    this.sidebar.setOpenMobile(false);
  }
  async logout(): Promise<void> {
    await this.arranque.cerrarSesion();
  }
}
