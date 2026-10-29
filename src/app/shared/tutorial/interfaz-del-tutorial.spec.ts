import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '@core/i18n';
import { RUNTIME_CONFIG, P } from '@core/session';
import { AppStore, PreferencesActions } from '@core/state';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';
import { CentroDeTutorialesComponent, agruparGuias } from './centro-de-tutoriales';
import { OfertaDelTutorialComponent } from './oferta-del-tutorial';
import { SelectorDeIdiomaComponent } from './selector-de-idioma';
import { TutorialService } from './tutorial.service';
import type { Guia } from './catalogo-de-guias';

function montar(capacidades: string[] = []) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'http://api.test' } }],
  });
  const store = TestBed.inject(AppStore);
  store.user.set({ ...USUARIO_DE_PRUEBA, capabilities: capacidades });
  store.featureFlags.set({ movements: true, dashboard: true, settings: true });
  store.featureFlagsLoaded.set(true);
  const i18n = TestBed.inject(I18nService);
  const cargar = vi.spyOn(i18n, 'load').mockResolvedValue();
  const persistir = vi.spyOn(TestBed.inject(PreferencesActions), 'persistPreferences').mockResolvedValue(undefined);
  return { store, cargar, persistir, tutorial: TestBed.inject(TutorialService) };
}

const crear = <T>(clase: new () => T): T => TestBed.runInInjectionContext(() => new clase());

describe('selector de idioma del tutorial', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('preselecciona el idioma actual de las preferencias', () => {
    const { store } = montar();
    const selector = crear(SelectorDeIdiomaComponent);
    expect(selector.actual()).toBe('es-CO');
    store.preferences.update((valor) => ({ ...valor, locale: 'pt-BR' }));
    expect(selector.actual()).toBe('pt-BR');
  });

  it('ofrece cada idioma con su propio nombre', () => {
    montar();
    expect(crear(SelectorDeIdiomaComponent).opciones.map((opcion) => opcion.label)).toEqual([
      'Español',
      'English',
      'Français',
      'Português',
    ]);
  });

  it('cambiar el idioma recarga i18n, lo guarda en las preferencias y lo persiste', async () => {
    const { store, cargar, persistir } = montar();
    await crear(SelectorDeIdiomaComponent).elegir('en-US');
    expect(store.preferences().locale).toBe('en-US');
    expect(cargar).toHaveBeenCalledWith('en-US');
    expect(persistir).toHaveBeenCalledTimes(1);
  });

  it('si no se puede persistir el idioma avisa y mantiene el cambio local', async () => {
    const { store, persistir } = montar();
    persistir.mockRejectedValue(new Error('sin red'));
    await crear(SelectorDeIdiomaComponent).elegir('fr-FR');
    expect(store.preferences().locale).toBe('fr-FR');
    expect(store.toast.texto()).toBe('sin red');
  });
});

describe('oferta del tutorial', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('rechazar la oferta la marca como vista sin iniciar nada', () => {
    const { tutorial } = montar();
    const iniciar = vi.spyOn(tutorial, 'iniciarGuia').mockResolvedValue();
    tutorial.ofrecerSiEsPrimeraVez();
    crear(OfertaDelTutorialComponent).descartar();
    expect(tutorial.oferta()).toBe(false);
    expect(iniciar).not.toHaveBeenCalled();
  });

  it('aceptar la oferta inicia la guía de primeros pasos', () => {
    vi.useFakeTimers();
    const { tutorial } = montar();
    const iniciar = vi.spyOn(tutorial, 'iniciarGuia').mockResolvedValue();
    crear(OfertaDelTutorialComponent).aceptar();
    vi.runAllTimers();
    vi.useRealTimers();
    expect(iniciar).toHaveBeenCalledWith('primeros-pasos');
  });
});

describe('centro de tutoriales', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('solo lista las guías permitidas por los permisos de la persona', () => {
    montar([P.movimientos.ver]);
    const ids = crear(CentroDeTutorialesComponent)
      .guias()
      .map((guia) => guia.id);
    expect(ids).toContain('buscar-filtrar');
    expect(ids).toContain('primeros-pasos');
    expect(ids).not.toContain('gasto');
    expect(ids).not.toContain('administracion');
  });

  it('agrupa por categoría y busca por título o resumen', () => {
    montar([P.movimientos.ver, P.movimientos.crear, P.cuentas.categorias.crear]);
    const centro = crear(CentroDeTutorialesComponent);
    expect(centro.grupos().length).toBeGreaterThan(1);
    centro.busqueda.set('xyz-no-existe');
    expect(centro.grupos()).toEqual([]);
    centro.busqueda.set('gasto');
    const ids = centro.grupos().flatMap((grupo) => grupo.guias.map((guia) => guia.id));
    expect(ids).toContain('gasto');
    expect(ids).not.toContain('primeros-pasos');
  });

  it('marca las guías ya completadas y cuenta el avance', () => {
    const { tutorial } = montar();
    const centro = crear(CentroDeTutorialesComponent);
    expect(centro.completada('primeros-pasos')).toBe(false);
    tutorial.marcarCompletada('primeros-pasos');
    expect(centro.completada('primeros-pasos')).toBe(true);
    expect(centro.hechas()).toBe(1);
  });

  it('empezar cierra el centro y lanza la guía', () => {
    vi.useFakeTimers();
    const { tutorial } = montar();
    const iniciar = vi.spyOn(tutorial, 'iniciarGuia').mockResolvedValue();
    tutorial.abrirCentro();
    crear(CentroDeTutorialesComponent).empezar('crear-widget');
    expect(tutorial.centroAbierto()).toBe(false);
    vi.runAllTimers();
    vi.useRealTimers();
    expect(iniciar).toHaveBeenCalledWith('crear-widget');
  });

  it('agruparGuias conserva el orden y descarta categorías vacías', () => {
    const guia = (id: string, categoria: string, titulo: string): Guia => ({
      id,
      categoria,
      titulo,
      resumen: '',
      ruta: 'x',
      pasos: [],
    });
    const lista = [guia('a', 'Uno', 'Alfa'), guia('b', 'Dos', 'Beta'), guia('c', 'Uno', 'Gamma')];
    expect(agruparGuias(lista, '').map((grupo) => grupo.categoria)).toEqual(['Uno', 'Dos']);
    expect(agruparGuias(lista, 'gam')).toEqual([{ categoria: 'Uno', guias: [lista[2]] }]);
  });
});
