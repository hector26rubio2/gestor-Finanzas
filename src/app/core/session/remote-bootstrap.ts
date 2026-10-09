import { DestroyRef, Injectable, effect, inject, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiBootstrap, ApiRequestError, ApiSession, FinanceApiClient } from '@core/api/api-client';
import { MovementKindCatalog } from '@core/utils/movement-kinds';
import { Router } from '@angular/router';
import {
  Carga,
  PERMISO_DE_CARGA,
  RawData,
  avisosDe,
  emptyRaw,
  fusionarCatalogos,
  huellaDeCatalogos,
  identidadDe,
  mismaLista,
} from './remote-slices';
import { toViewData } from './mappers/view-data.mapper';
import { toViewUser } from './mappers/session.mapper';
import { AppStore } from '@core/state/store';
import { applyStoredAppearance, clearAppearanceOverrides, parsePalette } from '@core/state/theme';
import { parseMoney, setCurrencyCatalog } from '@core/utils/money';
import { todayIso } from '@core/utils/dates';
import { I18nService } from '@core/i18n/i18n.service';
import { Movement } from '@core/state/view-model';
import { SaldosService } from './saldos.service';

const INTERVALO_MINIMO_AL_ENFOCAR_MS = 60_000;
const PARTES_SIN_AVISO = new Set(['currencies', 'notifications', 'balances']);

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

  private identidad: string | null = null;
  private permisos = new Set<string>();
  private refrescando = false;
  private raw: RawData = emptyRaw();
  private huella = '';
  private ultimaRevision = 0;
  private generacion = 0;
  private readonly cargadas = new Set<Carga>();
  private readonly enCurso = new Map<Carga, Promise<void>>();

  constructor() {
    effect(() => {
      const tipo = this.store.inspector()?.type;
      untracked(() => {
        if (tipo === 'person') void this.asegurar('debts');
        if (tipo === 'investment') void this.asegurar('investments');
      });
    });
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.initialize();
    if (this.destroyRef.destroyed) return;
    const alEnfocar = () => {
      if (Date.now() - this.ultimaRevision >= INTERVALO_MINIMO_AL_ENFOCAR_MS) void this.cargarSesion();
    };
    window.addEventListener('focus', alEnfocar);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('focus', alEnfocar);
      this.canal?.close();
      this.canal = null;
    });
    this.escucharCambiosDeAcceso();
  }

  async initialize(): Promise<void> {
    this.cerradaAProposito = false;
    this.generacion++;
    this.store.remoteState.set('loading');
    try {
      const boot = await firstValueFrom(this.api.bootstrap(todayIso()));
      const session = boot.session;

      if (!session.permissions?.length) {
        this.store.remoteError.set(this.i18n.t('session.error.noPermissions'));
        this.store.remoteState.set('error');
        this.store.user.set(null);
        return;
      }
      if (!boot.featureFlags) throw new Error('No fue posible cargar la API.');

      this.identidad = identidadDe(session);
      this.permisos = new Set(session.permissions);
      this.cargadas.clear();
      this.enCurso.clear();
      this.huella = huellaDeCatalogos(boot);
      this.ultimaRevision = Date.now();
      this.raw = fusionarCatalogos(emptyRaw(), boot);
      this.reiniciarMovimientos();
      if (boot.currencies?.length) setCurrencyCatalog(boot.currencies);
      this.aplicarAvisos(boot);
      this.aplicarDatos([]);
      this.aplicarSaldos(boot);
      this.aplicarSesion(session, boot.featureFlags);
      if (boot.omitted.some((omision) => omision.reason === 'failed' && !PARTES_SIN_AVISO.has(omision.part)))
        this.store.toast.set(this.i18n.t('shell.partialLoad'));
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

  async asegurar(...claves: Carga[]): Promise<void> {
    await Promise.all(claves.map((clave) => this.cargarBajoDemanda(clave)));
  }

  private cargarBajoDemanda(clave: Carga): Promise<void> {
    if (this.store.remoteState() !== 'ready' || this.cargadas.has(clave)) return Promise.resolve();
    const permiso = PERMISO_DE_CARGA[clave];
    if (permiso && !this.permisos.has(permiso)) return Promise.resolve();
    const pendiente = this.enCurso.get(clave);
    if (pendiente) return pendiente;
    const generacion = this.generacion;
    const carga = this.traer(clave)
      .then((datos) => {
        if (generacion !== this.generacion) return;
        this.raw = { ...this.raw, ...datos };
        this.cargadas.add(clave);
        if (clave === 'notifications') this.store.sinLeerFueraDeLista.set(0);
        this.aplicarDatos(this.store.data().movements);
      })
      .catch(() => {
        if (generacion === this.generacion) this.store.toast.set(this.i18n.t('shell.partialLoad'));
      })
      .finally(() => {
        if (this.enCurso.get(clave) === carga) this.enCurso.delete(clave);
      });
    this.enCurso.set(clave, carga);
    return carga;
  }

  private async traer(clave: Carga): Promise<Partial<RawData>> {
    switch (clave) {
      case 'debts':
        return { debts: await firstValueFrom(this.api.debts()) };
      case 'investments':
        return { investments: await firstValueFrom(this.api.investments()) };
      case 'notifications':
        return { notifications: await firstValueFrom(this.api.notifications()) };
    }
  }

  private reiniciarMovimientos(): void {
    this.store.movimientosCargados.set(new Map());
    this.store.movimientosListos.set(false);
    this.store.remoteMovementPage.set(1);
    this.store.remoteMovementTotal.set(0);
    this.store.remoteMovementCursor.set(null);
    this.store.remoteMovementTotals.set(null);
  }

  private aplicarDatos(movimientos: Movement[]): void {
    const raw = this.raw;
    this.store.kindCatalog.set(new MovementKindCatalog(raw.movementKinds));
    this.store.data.set(toViewData(this.i18n, raw, movimientos));
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

  private aplicarAvisos(boot: ApiBootstrap): void {
    const { recientes, sinLeerFueraDeLista } = avisosDe(boot);
    this.raw = { ...this.raw, notifications: recientes };
    this.store.sinLeerFueraDeLista.set(sinLeerFueraDeLista);
  }

  private aplicarSaldos(boot: ApiBootstrap): void {
    const balances = boot.balances;
    if (!balances) {
      this.store.saldosDelServidor.set(null);
      return;
    }
    const saldos = new Map<string, number>();
    for (const cuenta of balances.accounts ?? []) saldos.set(cuenta.account.id, parseMoney(cuenta.balance));
    for (const tarjeta of balances.cards ?? []) saldos.set(tarjeta.cardId, -parseMoney(tarjeta.debt));
    this.store.saldosDelServidor.set(saldos);
  }

  private aplicarSesion(session: ApiSession, flags: readonly { key: string; isEnabled: boolean }[] | null): void {
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

    if (!flags) return;
    const banderas = Object.fromEntries(flags.map((flag) => [flag.key, flag.isEnabled]));
    if (JSON.stringify(banderas) !== JSON.stringify(this.store.featureFlags())) this.store.featureFlags.set(banderas);
    this.store.featureFlagsLoaded.set(true);
  }

  private async cargarSesion(): Promise<void> {
    if (this.cerradaAProposito) return;
    if (this.store.remoteState() === 'loading' || this.refrescando) return;
    this.refrescando = true;
    this.ultimaRevision = Date.now();
    try {
      const boot = await firstValueFrom(this.api.bootstrap(todayIso()));
      const session = boot.session;
      if (this.identidad !== null && identidadDe(session) !== this.identidad) {
        this.refrescando = false;
        await this.initialize();
        return;
      }

      const ahora = new Set(session.permissions ?? []);
      const retiradas = [...this.cargadas].filter((clave) => {
        const permiso = PERMISO_DE_CARGA[clave];
        return permiso !== null && !ahora.has(permiso);
      });
      const vacio = emptyRaw();
      for (const clave of retiradas) {
        this.cargadas.delete(clave);
        this.raw = { ...this.raw, [clave]: vacio[clave] };
      }
      this.permisos = ahora;

      const huella = huellaDeCatalogos(boot);
      if (huella !== this.huella || retiradas.length) {
        this.huella = huella;
        const avisosCompletos = this.cargadas.has('notifications') ? this.raw.notifications : null;
        this.raw = fusionarCatalogos(this.raw, boot);
        this.aplicarAvisos(boot);
        if (avisosCompletos) {
          this.raw = { ...this.raw, notifications: avisosCompletos };
          this.store.sinLeerFueraDeLista.set(0);
          this.cargadas.delete('notifications');
        }
        this.aplicarDatos(this.store.data().movements);
        this.aplicarSaldos(boot);
        if (avisosCompletos) void this.asegurar('notifications');
      }
      this.aplicarSesion(session, boot.featureFlags);
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
    this.generacion++;
    this.identidad = null;
    this.permisos = new Set();
    this.raw = emptyRaw();
    this.cargadas.clear();
    this.enCurso.clear();
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
    this.reiniciarMovimientos();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  async pollSession(): Promise<void> {
    await this.cargarSesion();
  }
}
