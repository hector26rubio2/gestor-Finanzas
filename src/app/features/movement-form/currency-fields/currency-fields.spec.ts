import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { TasaDeCambio } from '@core/state/tasa-de-cambio';
import { beforeEach, describe, expect, it } from 'vitest';
import { MovementCurrencyFieldsComponent } from './currency-fields';

@Component({
  imports: [FormsModule, MovementCurrencyFieldsComponent],
  template: `<form><fin-movement-currency-fields [model]="model" /></form>`,
})
class HostComponent {
  readonly model: Record<string, unknown> = { originalAmount: null, exchangeRate: null };
}

function escribir(campo: HTMLInputElement, texto: string): void {
  campo.value = texto;
  campo.dispatchEvent(new Event('input'));
}

describe('campos de moneda del movimiento', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: TasaDeCambio, useValue: { vigente: signal(null), cargando: signal(false), solicitar: () => {} } },
      ],
    });
  });

  it('el monto original y la tasa muestran el separador y guardan el número exacto', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const raiz: HTMLElement = fixture.nativeElement;
    const original = raiz.querySelector<HTMLInputElement>('input[name=originalAmount]')!;
    const tasa = raiz.querySelector<HTMLInputElement>('input[name=exchangeRate]')!;

    escribir(original, '1250000,5');
    escribir(tasa, '4123,75');
    fixture.detectChanges();

    expect(original.value).toBe('1.250.000,5');
    expect(tasa.value).toBe('4.123,75');
    expect(fixture.componentInstance.model['originalAmount']).toBe(1_250_000.5);
    expect(fixture.componentInstance.model['exchangeRate']).toBe(4123.75);
  });

  it('la tasa vigente se muestra con separador de miles', async () => {
    TestBed.overrideProvider(TasaDeCambio, {
      useValue: { vigente: signal(4012.5), cargando: signal(false), solicitar: () => {} },
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const tasa = fixture.nativeElement.querySelector('input[name=exchangeRate]') as HTMLInputElement;
    expect(tasa.value).toBe('4.012,5');
  });

  it('no permite un monto negativo', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const original = fixture.nativeElement.querySelector('input[name=originalAmount]') as HTMLInputElement;

    escribir(original, '-5');

    expect(original.value).toBe('5');
  });
});
