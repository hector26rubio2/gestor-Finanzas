import { DestroyRef, Injectable, inject } from '@angular/core';
import { Observable, catchError, firstValueFrom, forkJoin, map, of } from 'rxjs';
import { ApiCurrency, ApiRequestError, ApiSession, FinanceApiClient } from '@core/api/api-client';
import { MovementKindCatalog } from '@core/utils/movement-kinds';
import { Router } from '@angular/router';
import { Rebanada, SLICES, PERMISO_DE, RawData, emptyRaw, identidadDe, mismaLista } from './remote-slices';
import { toViewData } from './mappers/view-data.mapper';
import { toViewUser } from './mappers/session.mapper';
import { AppStore } from '@core/state/store';
import { applyStoredAppearance, clearAppearanceOverrides, parsePalette } from '@core/state/theme';
import { setCurrencyCatalog } from '@core/utils/money';
import { P } from './permissions';
import { I18nService } from '@core/i18n/i18n.service';
import { SaldosService } from './saldos.service';

@Injectable({ providedIn: 'root' })
export class RemoteBootstrap {
  private readonly api = inject(FinanceApiClient);
  private readonly store = inject(AppStore);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly saldos = inject(SaldosService);
  private readonly destroyRef = inject(DestroyRef);
  private started = false;

  private canal: EventSource | null = null;

  private cerradaAProposito = false;

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.initialize();
    if (this.destroyRef.destroyed) return;
    const timer = window.setInterval(() => void this.pollSession(), 60_000);
    const onFocus = () => void this.pollSession();
    window.addEventListener('focus', onFocus);
    this.destroyRef.onDestroy(() => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      this.canal?.close();
      this.canal = null;
    });
    this.escucharCambiosDeAcceso();
  }

  private identidad: string | null = null;
  private permisos = new Set<string>();
  private refrescando = false;
  private raw: RawData = emptyRaw();

  async initialize(): Promise<void> {
    this.cerradaAProposito = false;
    this.store.remoteState.set('loading');
    try {
      const session = await firstValueFrom(this.api.session());

      if (!session.permissions?.length) {
        this.store.remoteError.set(this.i18n.t('session.error.noPermissions'));
        this.store.remoteState.set('error');
        this.store.user.set(null);
        return;
      }

      this.identidad = identidadDe(session);
      this.permisos = new Set(session.permissions);

      const claves = SLICES.filter((clave) => this.permisos.has(PERMISO_DE[clave]));
      const sinCatalogo = of<readonly ApiCurrency[] | null>(null);
      const result = await firstValueFrom(
        forkJoin({
          datos: this.pedirRebanadas(claves),
          featureFlags: this.api.featureFlags(),
          notifications: this.api.notifications().pipe(catchError(() => of([]))),
          monedas: this.permisos.has(P.sesion.monedas.listar)
            ? this.api.currencies().pipe(catchError(() => sinCatalogo))
            : sinCatalogo,
        }),
      );
      this.raw = { ...emptyRaw(), ...result.datos, notifications: result.notifications };
      if (result.monedas?.length) setCurrencyCatalog(result.monedas);
      this.aplicarDatos();
      this.aplicarSesion(session, result.featureFlags);
      this.store.remoteState.set('ready');
      this.escucharCambiosDeAcceso();
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        const authError = this.consumeAuthError();
        this.store.remoteError.set(authError ?? '');
        this.store.user.set(null);
        this.store.remoteState.set(authError ? 'error' : 'anonymous');
        return;
      }
      this.store.remoteError.set(error instanceof Error ? error.message : 'No fue posible cargar la API.');
      this.store.remoteState.set('error');
      this.store.user.set(null);
    }
  }

  private pedirRebanadas(claves: readonly Rebanada[]): Observable<Partial<RawData>> {
    if (!claves.length) return of({});
    let fallos = 0;
    const pedidas: Record<string, Observable<unknown>> = {};
    for (const clave of claves) {
      pedidas[clave] = this.pedir(clave).pipe(
        catchError(() => {
          fallos++;
          return of(emptyRaw()[clave]);
        }),
      );
    }
    return forkJoin(pedidas).pipe(
      map((datos) => {
        if (fallos) this.store.toast.set(this.i18n.t('shell.partialLoad'));
        return datos as Partial<RawData>;
      }),
    );
  }

  private pedir(clave: Rebanada): Observable<unknown> {
    switch (clave) {
      case 'movementKinds':
        return this.api.movementKinds();
      case 'accounts':
        return this.api.accounts();
      case 'cards':
        return this.api.cards();
      case 'categories':
        return this.api.categories();
      case 'people':
        return this.api.people();
      case 'debts':
        return this.api.debts();
      case 'investments':
        return this.api.investments();
      case 'movements':
        return this.api.movements({ page: 1, pageSize: 25 });
      case 'preferences':
        return this.api.preferences();
    }
  }

  private aplicarDatos(): void {
    const raw = this.raw;
    const catalog = new MovementKindCatalog(raw.movementKinds);
    this.store.kindCatalog.set(catalog);
    this.store.data.set(
      toViewData(this.i18n, catalog, {
        accounts: raw.accounts,
        cards: raw.cards,
        movements: raw.movements.items,
        people: raw.people,
        debts: raw.debts,
        investments: raw.investments,
        notifications: raw.notifications,
      }),
    );
    this.store.remoteMovementPage.set(raw.movements.page);
    this.store.remoteMovementSize.set(raw.movements.size);
    this.store.remoteMovementTotal.set(raw.movements.total);
    this.store.categories.set(raw.categories);
    if (raw.preferences) {
      const preferences = raw.preferences;
      const custom = parsePalette(preferences.customThemeJson);
      this.store.preferences.update((value) => ({
        ...value,
        locale: preferences.language,
        theme: preferences.theme as typeof value.theme,
        font: preferences.font,
        density: preferences.density as typeof value.density,
        name: custom?.name ?? value.name,
        accent: custom?.accent ?? value.accent,
        primary: custom?.primary ?? custom?.accent ?? value.primary,
        secondary: custom?.secondary ?? value.secondary,
        text: custom?.text ?? value.text,
        surface: custom?.surface ?? value.surface,
        border: custom?.border ?? value.border,
        background: custom?.background ?? value.background,
        custom: custom?.custom === true,
        customSaved: custom?.saved ?? value.customSaved,
        radius: custom?.radius ?? value.radius,
      }));
      applyStoredAppearance(preferences, custom);
      this.store.disenoDelServidor.set({ json: preferences.dashboardLayoutJson ?? null });
    }
  }

  private aplicarSesion(session: ApiSession, flags: readonly { key: string; isEnabled: boolean }[]): void {
    const user = toViewUser(session);
    const actual = this.store.user();
    const igual =
      !!actual &&
      actual.id === user.id &&
      actual.name === user.name &&
      actual.email === user.email &&
      actual.photoUrl === user.photoUrl &&
      mismaLista(actual.capabilities, user.capabilities);
    if (!igual) this.store.user.set(user);

    const monedaBase = session.organization.baseCurrency?.trim().toUpperCase();
    if (monedaBase?.length === 3 && monedaBase !== this.store.baseCurrency()) this.store.baseCurrency.set(monedaBase);

    const organization = { id: session.organization.id, name: session.organization.name };
    const org = this.store.organization();
    if (!org || org.id !== organization.id || org.name !== organization.name) this.store.organization.set(organization);

    const organizations = (session.organizations ?? []).map((x) => ({ id: x.id, name: x.name }));
    if (JSON.stringify(organizations) !== JSON.stringify(this.store.organizations()))
      this.store.organizations.set(organizations);

    const banderas = Object.fromEntries(flags.map((flag) => [flag.key, flag.isEnabled]));
    if (JSON.stringify(banderas) !== JSON.stringify(this.store.featureFlags())) this.store.featureFlags.set(banderas);
    this.store.featureFlagsLoaded.set(true);
  }

  private async cargarSesion(): Promise<void> {
    if (this.cerradaAProposito) return;
    if (this.store.remoteState() === 'loading' || this.refrescando) return;
    this.refrescando = true;
    try {
      const [session, flags] = await firstValueFrom(forkJoin([this.api.session(), this.api.featureFlags()]));
      if (this.identidad !== null && identidadDe(session) !== this.identidad) {
        this.refrescando = false;
        await this.initialize();
        return;
      }

      const ahora = new Set(session.permissions ?? []);
      const concedidas = SLICES.filter((c) => ahora.has(PERMISO_DE[c]) && !this.permisos.has(PERMISO_DE[c]));
      const retiradas = SLICES.filter((c) => !ahora.has(PERMISO_DE[c]) && this.permisos.has(PERMISO_DE[c]));
      const vacio = emptyRaw();
      for (const clave of retiradas) this.raw = { ...this.raw, [clave]: vacio[clave] };
      if (concedidas.length) {
        const nuevas = await firstValueFrom(this.pedirRebanadas(concedidas));
        this.raw = { ...this.raw, ...nuevas };
      }
      this.permisos = ahora;
      if (concedidas.length || retiradas.length) this.aplicarDatos();
      this.aplicarSesion(session, flags);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        this.store.user.set(null);
        this.store.remoteState.set('anonymous');
        return;
      }
    } finally {
      this.refrescando = false;
    }
  }

  private consumeAuthError(): string | null {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('authError')) return null;
    params.delete('authError');
    const query = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : ''));
    return this.i18n.t('login.authError');
  }

  private escucharCambiosDeAcceso(): void {
    if (typeof EventSource === 'undefined') return;
    if (this.canal) return;
    try {
      this.canal = new EventSource(`${this.store.runtime.apiBaseUrl}/api/v1/events`, {
        withCredentials: true,
      });
      this.canal.addEventListener('permisos', () => {
        if (!this.cerradaAProposito) void this.cargarSesion();
      });
    } catch {
      this.canal = null;
    }
  }

  async cerrarSesion(): Promise<void> {
    this.cerradaAProposito = true;
    this.identidad = null;
    this.permisos = new Set();
    this.raw = emptyRaw();
    this.canal?.close();
    this.canal = null;

    try {
      await firstValueFrom(this.api.logout());
    } catch {}

    this.store.remoteState.set('anonymous');
    clearAppearanceOverrides();
    this.store.user.set(null);
    this.store.form.set(null);
    this.store.inspector.set(null);
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  async pollSession(): Promise<void> {
    await this.cargarSesion();
  }
}
