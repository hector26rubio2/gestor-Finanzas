import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, FinanceApiClient } from '@core/api';
import { RemoteBootstrap, RUNTIME_CONFIG } from '@core/session';
import { AppStore } from '@core/state';
import { PrivacySectionComponent } from './privacy-section';

describe('PrivacySectionComponent', () => {
  const api = { exportMyData: vi.fn(), deleteMyAccount: vi.fn() };
  const arranque = { cerrarSesion: vi.fn(() => Promise.resolve()) };

  beforeEach(() => {
    TestBed.resetTestingModule();
    api.exportMyData.mockReset();
    api.deleteMyAccount.mockReset();
    arranque.cerrarSesion.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: FinanceApiClient, useValue: api },
        { provide: RemoteBootstrap, useValue: arranque },
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } },
      ],
    });
    TestBed.inject(AppStore).user.set({ id: 'u1', name: 'Ana', email: 'Ana@Correo.test', capabilities: [] });
  });

  async function abrirDialogo() {
    const fixture = TestBed.createComponent(PrivacySectionComponent);
    fixture.detectChanges();
    fixture.componentInstance.openDialog();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const accion = () => document.querySelector<HTMLButtonElement>('button[hlmAlertDialogAction]')!;
  const campo = () => document.querySelector<HTMLInputElement>('#privacy-delete-email')!;

  function escribir(texto: string) {
    campo().value = texto;
    campo().dispatchEvent(new Event('input'));
  }

  it('descarga el archivo exportado', async () => {
    api.exportMyData.mockReturnValue(of(new Blob(['{}'], { type: 'application/json' })));
    const crear = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prueba');
    const revocar = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(PrivacySectionComponent);

    await fixture.componentInstance.exportData();

    expect(api.exportMyData).toHaveBeenCalled();
    expect(clic).toHaveBeenCalled();
    expect(revocar).toHaveBeenCalledWith('blob:prueba');
    crear.mockRestore();
    revocar.mockRestore();
    clic.mockRestore();
  });

  it('solo habilita el borrado cuando se escribe el correo de la cuenta', async () => {
    await abrirDialogo();

    expect(accion().disabled).toBe(true);
    escribir('otro@correo.test');
    expect(accion().disabled).toBe(true);
  });

  it('borra la cuenta y cierra la sesión con el correo confirmado', async () => {
    api.deleteMyAccount.mockReturnValue(of(undefined));
    const fixture = await abrirDialogo();

    escribir(' ana@correo.test ');
    fixture.detectChanges();
    expect(accion().disabled).toBe(false);
    accion().click();
    await fixture.whenStable();

    expect(api.deleteMyAccount).toHaveBeenCalledWith('ana@correo.test');
    expect(arranque.cerrarSesion).toHaveBeenCalled();
  });

  it('muestra el motivo cuando la API responde 409 y no cierra la sesión', async () => {
    api.deleteMyAccount.mockReturnValue(
      throwError(() => new ApiRequestError(409, { code: 'account.delete.sole_owner' })),
    );
    const fixture = await abrirDialogo();

    escribir('ana@correo.test');
    fixture.detectChanges();
    accion().click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(document.querySelector('#privacy-delete-error')?.textContent).toContain('propietario');
    expect(arranque.cerrarSesion).not.toHaveBeenCalled();
  });
});
