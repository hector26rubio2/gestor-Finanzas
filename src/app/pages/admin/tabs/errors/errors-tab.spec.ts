import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdministrationApi, ApiBugReportResult, ApiClientError, FinanceApiClient } from '@core/api';
import { RemoteBootstrap } from '@core/session';
import { AppStore, CAPABILITIES } from '@core/state';
import { ADMIN_STORE_PROVIDERS } from '@pages/admin/admin.providers';
import { AdminStore } from '@pages/admin/admin.store';
import { AdminAuditStore } from '@pages/admin/stores/admin-audit.store';
import { AdminErrorsStore } from '@pages/admin/stores/admin-errors.store';
import { ErrorsTabComponent } from './errors-tab';

const error = (id: string, parcial: Partial<ApiClientError> = {}): ApiClientError => ({
  id,
  fingerprint: id,
  message: `Falla ${id}`,
  source: 'web',
  status: 'new',
  occurrences: 2,
  affectedUsers: 1,
  version: '1.0',
  lastSeenAt: '2026-08-01T10:00:00Z',
  traceId: 'trace-1234567890',
  ...parcial,
});

const pagina = (items: ApiClientError[], total = items.length) => ({
  items,
  page: 1,
  size: 25,
  total,
  totalPages: 1,
  hasNext: false,
});

const api = {
  adminErrors: vi.fn(() => of(pagina([]))),
  updateAdminError: vi.fn(() => of(undefined)),
  createErrorGithubIssue: vi.fn(),
};
const toast = { set: vi.fn() };

function montar(permite: (c: string) => boolean = () => true) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      ...ADMIN_STORE_PROVIDERS,
      { provide: AdministrationApi, useValue: api },
      { provide: FinanceApiClient, useValue: {} },
      { provide: RemoteBootstrap, useValue: { pollSession: vi.fn() } },
      { provide: AppStore, useValue: { runtime: { mode: 'api' }, toast, preferences: () => ({ locale: 'es-CO' }) } },
      { provide: CAPABILITIES, useValue: { allows: permite } },
    ],
  });
  const errores = TestBed.inject(AdminErrorsStore);
  const pestana = TestBed.createComponent(ErrorsTabComponent).componentInstance;
  return { errores, pestana, store: TestBed.inject(AdminStore) };
}

describe('Administración: bandeja de errores', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('la lista', () => {
    it('cargar trae la página pedida y guarda el total', async () => {
      const { errores } = montar();
      api.adminErrors.mockReturnValueOnce(of(pagina([error('e1'), error('e2')], 40)));

      await errores.cargar(1);

      expect(errores.items().map((e) => e.id)).toEqual(['e1', 'e2']);
      expect(errores.total()).toBe(40);
    });

    it('el filtro «nuevo» se pide al servidor como «abierto» y la respuesta «abierto» vuelve como «nuevo»', async () => {
      const { errores } = montar();
      api.adminErrors.mockReturnValueOnce(
        of(pagina([{ ...error('e1'), status: 'open' as unknown as ApiClientError['status'] }])),
      );

      await errores.cargar(1, 'new');

      expect(api.adminErrors).toHaveBeenCalledWith(1, 25, 'open');
      expect(errores.items()[0].status).toBe('new');
      expect(errores.status()).toBe('new');
    });

    it('los otros estados se piden tal cual', async () => {
      const { errores } = montar();

      await errores.cargar(1, 'resolved');

      expect(api.adminErrors).toHaveBeenCalledWith(1, 25, 'resolved');
    });

    it('un error sin datos de resumen se completa con valores sensatos', async () => {
      const { errores } = montar();
      const crudo = { id: 'e1', message: 'x', source: 'api', status: 'new', createdAt: '2026-07-01T00:00:00Z' };
      api.adminErrors.mockReturnValueOnce(of(pagina([crudo as unknown as ApiClientError])));

      await errores.cargar(1);

      expect(errores.items()[0]).toMatchObject({
        occurrences: 1,
        affectedUsers: 1,
        version: 'api',
        traceId: null,
        lastSeenAt: '2026-07-01T00:00:00Z',
      });
    });

    it('sin permiso de listar no se pide nada', async () => {
      const { errores } = montar(() => false);

      await errores.cargar(1);

      expect(api.adminErrors).not.toHaveBeenCalled();
    });

    it('si el servidor falla avisa y la lista queda como estaba', async () => {
      const { errores } = montar();
      errores.items.set([error('e1')]);
      api.adminErrors.mockReturnValueOnce(throwError(() => new Error('caído')));

      await errores.cargar(1);

      expect(toast.set).toHaveBeenCalledTimes(1);
      expect(errores.items().map((e) => e.id)).toEqual(['e1']);
      expect(errores.cargando()).toBe(false);
    });

    it('las filas muestran las veces que ocurrió, el título y el estado', () => {
      const { errores, pestana } = montar();
      errores.items.set([error('e1', { title: 'No carga', occurrences: 5 })]);

      const [fila] = pestana.rows();

      expect(fila.occurrences).toBe('5×');
      expect(fila.message).toContain('No carga');
      expect(fila.message).toContain('Falla e1');
    });
  });

  describe('marcar resuelto', () => {
    it('actualiza el estado en el servidor y en la lista', async () => {
      const { errores, pestana } = montar();
      const e1 = error('e1');
      errores.items.set([e1, error('e2')]);

      await pestana.setStatus(e1, 'resolved');

      expect(api.updateAdminError).toHaveBeenCalledWith('e1', 'resolved');
      expect(errores.items().map((e) => e.status)).toEqual(['resolved', 'new']);
    });

    it('elegir el estado que ya tiene no llama al servidor', async () => {
      const { pestana } = montar();

      await pestana.setStatus(error('e1'), 'new');

      expect(api.updateAdminError).not.toHaveBeenCalled();
    });

    it('si el servidor falla avisa y el estado no cambia', async () => {
      const { errores, pestana } = montar();
      const e1 = error('e1');
      errores.items.set([e1]);
      api.updateAdminError.mockReturnValueOnce(throwError(() => new Error('no')));

      await pestana.setStatus(e1, 'resolved');

      expect(toast.set).toHaveBeenCalledTimes(1);
      expect(errores.items()[0].status).toBe('new');
    });

    it('la hoja abierta sigue al error cuando cambia en la lista', async () => {
      const { errores, pestana } = montar();
      const e1 = error('e1');
      errores.items.set([e1]);
      pestana.selected.set(e1);

      await pestana.setStatus(e1, 'investigating');

      expect(pestana.selectedError()?.status).toBe('investigating');
    });
  });

  describe('crear el issue de GitHub', () => {
    const resultado = (parcial: Partial<ApiBugReportResult>): ApiBugReportResult => ({
      error: error('e1'),
      githubIssueUrl: null,
      githubStatus: 'failed',
      githubDetail: null,
      ...parcial,
    });

    it('al crearlo guarda el enlace en el error y avisa que quedó', async () => {
      const { errores, pestana } = montar();
      const e1 = error('e1', { title: 'No carga' });
      errores.items.set([e1]);
      api.createErrorGithubIssue.mockReturnValueOnce(
        of(resultado({ githubStatus: 'created', githubIssueUrl: 'https://github.com/x/y/issues/9' })),
      );

      await pestana.createIssue(e1);

      expect(errores.items()[0].githubIssueUrl).toBe('https://github.com/x/y/issues/9');
      expect(toast.set).toHaveBeenCalledTimes(1);
      expect(pestana.creatingIssue()).toBe(false);
    });

    it('si GitHub lo rechaza avisa con el detalle y no guarda enlace', async () => {
      const { errores, pestana } = montar();
      const e1 = error('e1');
      errores.items.set([e1]);
      api.createErrorGithubIssue.mockReturnValueOnce(
        of(resultado({ githubStatus: 'rejected', githubDetail: 'Sin permisos' })),
      );

      await pestana.createIssue(e1);

      expect(toast.set.mock.calls[0][0]).toContain('Sin permisos');
      expect(errores.items()[0].githubIssueUrl).toBeUndefined();
    });

    it('si la llamada falla avisa y suelta el botón', async () => {
      const { pestana } = montar();
      api.createErrorGithubIssue.mockReturnValueOnce(throwError(() => new Error('red')));

      await pestana.createIssue(error('e1'));

      expect(toast.set).toHaveBeenCalledTimes(1);
      expect(pestana.creatingIssue()).toBe(false);
    });
  });

  describe('ver la acción en la auditoría', () => {
    it('abre la auditoría filtrada por la traza del error y cierra la hoja', () => {
      const { pestana, store } = montar();
      const cargar = vi.spyOn(TestBed.inject(AdminAuditStore), 'cargar').mockResolvedValue(undefined);
      pestana.selected.set(error('e1'));

      pestana.verAccion('trace-1234567890');

      expect(store.tab()).toBe('audit');
      expect(cargar).toHaveBeenCalledWith(1, { traceId: 'trace-1234567890' });
      expect(pestana.selected()).toBeNull();
    });
  });
});
