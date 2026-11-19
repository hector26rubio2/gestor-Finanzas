import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, FinanceApiClient } from '@core/api';
import { RemoteBootstrap, RUNTIME_CONFIG } from '@core/session';
import { AppStore } from '@core/state';
import { PrivacySectionComponent } from './privacy-section';

const problema = (code: string, status = 409) =>
  new ApiRequestError(status, { type: 'x', title: 't', status, code } as never);

describe('Privacidad: casos de borrar y exportar mis datos', () => {
  const api = { exportMyData: vi.fn(), deleteMyAccount: vi.fn() };
  const arranque = { cerrarSesion: vi.fn(() => Promise.resolve()) };
  const contexto = { close: vi.fn() };

  beforeEach(() => {
    TestBed.resetTestingModule();
    api.exportMyData.mockReset();
    api.deleteMyAccount.mockReset();
    arranque.cerrarSesion.mockClear();
    contexto.close.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: FinanceApiClient, useValue: api },
        { provide: RemoteBootstrap, useValue: arranque },
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } },
      ],
    });
    TestBed.inject(AppStore).user.set({ id: 'u1', name: 'Ana', email: 'ana@correo.test', capabilities: [] });
  });

  const montar = () => TestBed.runInInjectionContext(() => new PrivacySectionComponent());

  it.each([
    ['account.delete.sole_owner', 'privacy.delete.error.soleOwner'],
    ['account.delete.super_admin', 'privacy.delete.error.superAdmin'],
    ['account.delete.confirmation_mismatch', 'privacy.delete.error.mismatch'],
  ])('el rechazo %s muestra su propio mensaje y no cierra la sesión', async (codigo, clave) => {
    const componente = montar();
    componente.typedEmail.set('ana@correo.test');
    api.deleteMyAccount.mockReturnValue(throwError(() => problema(codigo)));

    await componente.deleteAccount(contexto);

    expect(componente.errorMessage()).toBe(componente.i18n.t(clave));
    expect(componente.errorMessage()).not.toBe(componente.i18n.t('privacy.delete.error.generic'));
    expect(arranque.cerrarSesion).not.toHaveBeenCalled();
    expect(contexto.close).not.toHaveBeenCalled();
  });

  it('un error desconocido muestra el mensaje genérico', async () => {
    const componente = montar();
    componente.typedEmail.set('ana@correo.test');
    api.deleteMyAccount.mockReturnValue(throwError(() => new Error('boom')));

    await componente.deleteAccount(contexto);

    expect(componente.errorMessage()).toBe(componente.i18n.t('privacy.delete.error.generic'));
  });

  it('envía el correo ya recortado y después cierra el diálogo y la sesión', async () => {
    const componente = montar();
    componente.typedEmail.set('  ANA@correo.test ');
    api.deleteMyAccount.mockReturnValue(of(undefined));

    await componente.deleteAccount(contexto);

    expect(api.deleteMyAccount).toHaveBeenCalledWith('ANA@correo.test');
    expect(contexto.close).toHaveBeenCalledOnce();
    expect(arranque.cerrarSesion).toHaveBeenCalledOnce();
  });

  it('sin el correo confirmado no llama a la API', async () => {
    const componente = montar();
    componente.typedEmail.set('otra@persona.test');

    await componente.deleteAccount(contexto);

    expect(api.deleteMyAccount).not.toHaveBeenCalled();
  });

  it('mientras se borra, un segundo intento no repite la petición', async () => {
    const componente = montar();
    componente.typedEmail.set('ana@correo.test');
    let terminar: () => void = () => undefined;
    api.deleteMyAccount.mockReturnValue(
      new (await import('rxjs')).Observable<void>((suscriptor) => {
        terminar = () => {
          suscriptor.next();
          suscriptor.complete();
        };
      }),
    );

    const primero = componente.deleteAccount(contexto);
    await componente.deleteAccount(contexto);
    terminar();
    await primero;

    expect(api.deleteMyAccount).toHaveBeenCalledOnce();
  });

  it('volver a abrir el diálogo limpia el correo escrito y el error anterior', () => {
    const componente = montar();
    componente.typedEmail.set('ana@correo.test');
    componente.errorMessage.set('Algo falló');

    componente.openDialog();

    expect(componente.typedEmail()).toBe('');
    expect(componente.errorMessage()).toBe('');
    expect(componente.dialogOpen()).toBe(true);
  });

  it('si exportar falla avisa y deja de mostrar «exportando»', async () => {
    const componente = montar();
    api.exportMyData.mockReturnValue(throwError(() => new Error('sin red')));

    await componente.exportData();

    expect(componente.exporting()).toBe(false);
    expect(TestBed.inject(AppStore).toast.texto()).toBe(componente.i18n.t('privacy.export.error'));
  });

  it('el correo se compara sin distinguir mayúsculas ni espacios en los bordes', () => {
    const componente = montar();

    componente.typedEmail.set(' ANA@CORREO.TEST ');
    expect(componente.confirmationMatches()).toBe(true);
    componente.typedEmail.set('ana@correo.tes');
    expect(componente.confirmationMatches()).toBe(false);
  });
});
