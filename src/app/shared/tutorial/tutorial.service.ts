import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '@core/i18n';
import { PreferencesActions } from '@core/state/preferences-actions';
import { AppStore, CAPABILITIES, FEATURES } from '@core/state/store';
import type { EntidadDeGuia, FormularioDeGuia, Guia } from './catalogo-de-guias';
import { esVisible, esperarElemento } from './esperar-elemento';
import type { EntornoDelMotor, SesionDeGuia } from './motor-de-guias';

export interface PasoDelRecorrido {
  element: string;
  interactivo?: boolean;
  popover: { title: string; description: string };
}

export interface NavegacionDelRecorrido {
  primero(): Promise<number | null>;
  siguiente(indice: number): Promise<number | null>;
  anterior(indice: number): Promise<number | null>;
}

export interface TextosDelRecorrido {
  siguiente: string;
  anterior: string;
  terminar: string;
  progreso: string;
}

export interface Recorrido {
  arrancar(): void | Promise<void>;
}

export type CrearRecorrido = (
  pasos: PasoDelRecorrido[],
  textos: TextosDelRecorrido,
  alCerrar: () => void,
  navegacion?: NavegacionDelRecorrido,
) => Promise<Recorrido>;

export const CREAR_RECORRIDO = new InjectionToken<CrearRecorrido>('CREAR_RECORRIDO', {
  providedIn: 'root',
  factory: () => async (pasos, textos, alCerrar, navegacion) =>
    (await import('./recorrido-con-driver')).crearRecorridoConDriver(pasos, textos, alCerrar, navegacion),
});

const PREFIJO_VISTO = 'finanzas.tutorial.visto.';
const PREFIJO_COMPLETADAS = 'finanzas.tutorial.completadas.';
const CLAVE_AL_ENTRAR = 'finanzas.tutorial.al-entrar';
const DESTINO_DEL_FOCO_RESPALDO = '#contenido-principal';
const PAUSA_ENTRE_FORMULARIOS = 60;

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    return;
  }
}

function leerCompletadas(usuario: string | undefined): ReadonlySet<string> {
  if (!usuario) return new Set();
  try {
    const guardadas: unknown = JSON.parse(leer(PREFIJO_COMPLETADAS + usuario) ?? '[]');
    return new Set(Array.isArray(guardadas) ? guardadas.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

const pausa = (milisegundos: number) => new Promise<void>((resolver) => setTimeout(resolver, milisegundos));

@Injectable({ providedIn: 'root' })
export class TutorialService {
  private readonly router = inject(Router);
  private readonly store = inject(AppStore);
  private readonly caps = inject(CAPABILITIES);
  private readonly features = inject(FEATURES);
  private readonly i18n = inject(I18nService);
  private readonly preferencias = inject(PreferencesActions);
  private readonly crear = inject(CREAR_RECORRIDO);
  private readonly ofrecidos = new Set<string>();
  private readonly versionDeCompletadas = signal(0);
  private corriendo = false;
  private origenDelFoco: HTMLElement | null = null;
  private sesion: SesionDeGuia | null = null;

  private readonly alEntrarEscribible = signal(leer(CLAVE_AL_ENTRAR) !== 'false');
  readonly alEntrar = this.alEntrarEscribible.asReadonly();
  readonly oferta = signal(false);
  readonly centroAbierto = signal(false);
  readonly completadas = computed(() => {
    this.versionDeCompletadas();
    return leerCompletadas(this.store.user()?.id);
  });

  cambiarAlEntrar(valor: boolean): void {
    this.alEntrarEscribible.set(valor);
    escribir(CLAVE_AL_ENTRAR, String(valor));
  }

  abrirCentro(): void {
    this.centroAbierto.set(true);
  }

  cerrarCentro(): void {
    this.centroAbierto.set(false);
  }

  marcarCompletada(id: string): void {
    const usuario = this.store.user()?.id;
    if (!usuario) return;
    escribir(PREFIJO_COMPLETADAS + usuario, JSON.stringify([...leerCompletadas(usuario), id]));
    this.versionDeCompletadas.update((version) => version + 1);
  }

  async cambiarIdioma(locale: string): Promise<void> {
    this.store.preferences.update((valor) => ({ ...valor, locale }));
    await this.i18n.load(locale);
    try {
      await this.preferencias.persistPreferences();
    } catch (error) {
      this.store.toast.set(error instanceof Error ? error.message : this.i18n.t('preferences.saveError'));
    }
  }

  ofrecerSiEsPrimeraVez(): void {
    const usuario = this.store.user()?.id;
    if (!usuario || !this.alEntrarEscribible() || this.ofrecidos.has(usuario)) return;
    if (leer(PREFIJO_VISTO + usuario) !== null) return;
    this.ofrecidos.add(usuario);
    this.oferta.set(true);
  }

  marcarVisto(): void {
    const usuario = this.store.user()?.id;
    if (usuario) {
      this.ofrecidos.add(usuario);
      escribir(PREFIJO_VISTO + usuario, '1');
    }
    this.oferta.set(false);
  }

  async iniciar(seccion: string = this.seccionActual(), origen?: HTMLElement): Promise<void> {
    if (this.corriendo) return;
    const { pasosDe } = await import('./pasos-del-tutorial');
    const pasos = pasosDe(seccion, {
      t: (clave) => this.i18n.t(clave),
      puede: (permiso) => this.caps.allows(permiso),
    }).filter((paso) => document.querySelector(paso.selector));
    if (!pasos.length) return;
    const guia: Guia = {
      id: 'esta-pagina',
      categoria: '',
      titulo: this.i18n.t('tutorial.guia.esta-pagina.title'),
      resumen: this.i18n.t('tutorial.guia.esta-pagina.summary'),
      ruta: this.seccionActual(),
      pasos: pasos.map((paso) => ({ selector: paso.selector, titulo: paso.titulo, texto: paso.texto, esperar: false })),
    };
    await this.ejecutar(guia, origen);
  }

  async iniciarGuia(id: string, origen?: HTMLElement): Promise<void> {
    if (this.corriendo) return;
    const { guiasDisponibles } = await import('./catalogo-de-guias');
    const guia = guiasDisponibles({
      t: (clave) => this.i18n.t(clave),
      puede: (permiso) => this.caps.allows(permiso),
      activa: (bandera) => this.features.enabled(bandera),
    }).find((candidata) => candidata.id === id);
    if (guia) await this.ejecutar(guia, origen);
  }

  private async ejecutar(guia: Guia, origen?: HTMLElement): Promise<void> {
    if (this.corriendo) return;
    this.corriendo = true;
    this.origenDelFoco = origen ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    try {
      const { crearSesionDeGuia } = await import('./motor-de-guias');
      const sesion = crearSesionDeGuia(guia, this.entorno());
      this.sesion = sesion;
      const recorrido = await this.crear(
        guia.pasos.map((paso) => ({
          element: paso.selector,
          interactivo: paso.interactivo,
          popover: { title: paso.titulo, description: paso.texto },
        })),
        {
          siguiente: this.i18n.t('tutorial.next'),
          anterior: this.i18n.t('tutorial.previous'),
          terminar: this.i18n.t('tutorial.done'),
          progreso: this.i18n.t('tutorial.progress'),
        },
        () => this.alCerrar(guia.id),
        sesion,
      );
      await recorrido.arrancar();
    } catch {
      this.alCerrar(guia.id);
    }
  }

  private entorno(): EntornoDelMotor {
    return {
      seccionActual: () => this.seccionActual(),
      navegar: async (ruta, params) => {
        await this.router.navigate(['/' + ruta], params ? { queryParams: params } : {});
      },
      abrirFormulario: async (accion) => {
        const formulario = this.resolverFormulario(accion.form, accion.con);
        if (!formulario) return false;
        if (this.store.form()) {
          this.store.form.set(null);
          await pausa(PAUSA_ENTRE_FORMULARIOS);
        }
        this.store.form.set(formulario);
        return true;
      },
      inspeccionar: (entidad) => {
        const objetivo = this.resolverEntidad(entidad);
        if (!objetivo) return false;
        this.store.inspect(objetivo.tipo, objetivo.id);
        return true;
      },
      cerrarFormulario: async () => {
        if (!this.store.form()) return;
        this.store.form.set(null);
        await pausa(PAUSA_ENTRE_FORMULARIOS);
      },
      cerrarInspector: () => {
        this.store.inspector.set(null);
        this.store.cardPaymentMode.set(false);
      },
      clic: (selector) => {
        const elemento = document.querySelector<HTMLElement>(selector);
        if (!elemento) return false;
        elemento.click();
        return true;
      },
      escape: () => {
        const destino = document.activeElement ?? document.body;
        destino.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      },
      existe: (selector) => esVisible(document.querySelector(selector)),
      esperar: esperarElemento,
    };
  }

  private resolverFormulario(
    formulario: FormularioDeGuia,
    con: 'tarjeta' | 'inversion' | undefined,
  ): FormularioDeGuia | null {
    const datos = this.store.data();
    if (con === 'tarjeta') {
      const tarjeta = datos.accounts.find((cuenta) => cuenta.type === 'credit');
      return tarjeta ? { ...formulario, accountId: tarjeta.id } : formulario;
    }
    if (con === 'inversion') {
      const inversion = datos.investments[0];
      return inversion ? { ...formulario, targetId: inversion.id } : null;
    }
    return formulario;
  }

  private resolverEntidad(entidad: EntidadDeGuia): { tipo: string; id: string } | null {
    const datos = this.store.data();
    const candidato =
      entidad === 'movimiento'
        ? { tipo: 'movement', id: datos.movements[0]?.id }
        : entidad === 'tarjeta'
          ? { tipo: 'card', id: datos.accounts.find((cuenta) => cuenta.type === 'credit')?.id }
          : entidad === 'cuenta'
            ? { tipo: 'account', id: datos.accounts.find((cuenta) => cuenta.type !== 'credit')?.id }
            : entidad === 'persona'
              ? { tipo: 'person', id: datos.people[0]?.id }
              : { tipo: 'investment', id: datos.investments[0]?.id };
    return candidato.id ? { tipo: candidato.tipo, id: candidato.id } : null;
  }

  private alCerrar(id: string): void {
    const sesion = this.sesion;
    this.sesion = null;
    sesion?.cerrar();
    if (sesion?.terminada) this.marcarCompletada(id);
    this.corriendo = false;
    const origen = this.origenDelFoco;
    this.origenDelFoco = null;
    const destino = origen?.isConnected ? origen : document.querySelector<HTMLElement>(DESTINO_DEL_FOCO_RESPALDO);
    destino?.focus();
  }

  private seccionActual(): string {
    return this.router.url.split(/[?#]/)[0].split('/')[1] ?? '';
  }
}
