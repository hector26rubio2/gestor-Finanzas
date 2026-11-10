import { Component, signal } from '@angular/core';
import { FormField, form, min, required } from '@angular/forms/signals';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { PREFERENCES } from '@core/state/theme';
import { beforeEach, describe, expect, it } from 'vitest';
import { MontoInputDirective } from './monto-input.directive';

@Component({
  imports: [FormsModule, MontoInputDirective],
  template: `
    <form>
      <input id="monto" name="monto" finMonto min="1" [(ngModel)]="valor" required />
      <input id="enteros" name="enteros" finMonto step="1" [(ngModel)]="entero" />
      <input id="tope" name="tope" finMonto min="1" max="100" [(ngModel)]="limitado" />
    </form>
  `,
})
class HostComponent {
  readonly valor = signal<number | null>(null);
  entero: number | null = null;
  limitado: number | null = null;
}

@Component({
  imports: [FormField, MontoInputDirective],
  template: `<input id="signal" finMonto [formField]="formulario.valor" />`,
})
class SignalHostComponent {
  readonly modelo = signal<{ valor: number | null }>({ valor: null });
  readonly formulario = form(this.modelo, (campo) => {
    required(campo.valor);
    min(campo.valor, 1, { message: 'mínimo' });
  });
}

function tecla(input: HTMLInputElement, key: string): boolean {
  const event = new KeyboardEvent('keydown', { key, cancelable: true });
  input.dispatchEvent(event);
  return event.defaultPrevented;
}

function escribir(input: HTMLInputElement, texto: string): void {
  for (const caracter of texto) {
    if (tecla(input, caracter)) continue;
    const inicio = input.selectionStart ?? input.value.length;
    const fin = input.selectionEnd ?? inicio;
    input.setRangeText(caracter, inicio, fin, 'end');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function vaciar(input: HTMLInputElement): void {
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function pegar(input: HTMLInputElement, texto: string): boolean {
  const event = new Event('paste', { cancelable: true }) as Event & { clipboardData: DataTransfer };
  event.clipboardData = { getData: () => texto } as unknown as DataTransfer;
  input.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('MontoInputDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  const campo = (id = 'monto') => fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;

  async function montar(locale: string): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HostComponent] });
    TestBed.inject(PREFERENCES).update((p) => ({ ...p, locale }));
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  describe('idioma es', () => {
    beforeEach(() => montar('es-CO'));

    it('es un campo de texto con teclado decimal', () => {
      expect(campo().type).toBe('text');
      expect(campo().inputMode).toBe('decimal');
    });

    it('al escribir 1500000 muestra 1.500.000 y el modelo guarda 1500000', () => {
      escribir(campo(), '1500000');
      expect(campo().value).toBe('1.500.000');
      expect(fixture.componentInstance.valor()).toBe(1_500_000);
    });

    it('acepta decimales con coma y con punto como separador decimal', () => {
      escribir(campo(), '1234,5');
      expect(campo().value).toBe('1.234,5');
      expect(fixture.componentInstance.valor()).toBe(1234.5);
      vaciar(campo());
      escribir(campo(), '10.25');
      expect(campo().value).toBe('10,25');
      expect(fixture.componentInstance.valor()).toBe(10.25);
    });

    it('no admite un segundo separador decimal ni letras ni signo', () => {
      escribir(campo(), '1,5,3');
      expect(campo().value).toBe('1,53');
      for (const t of ['a', 'e', '-', '+', ' ']) expect(tecla(campo(), t)).toBe(true);
      expect(tecla(campo(), '5')).toBe(false);
      expect(tecla(campo(), 'Home')).toBe(false);
    });

    it('un campo de enteros no acepta separador decimal', () => {
      escribir(campo('enteros'), '12,5');
      expect(campo('enteros').value).toBe('125');
      expect(fixture.componentInstance.entero).toBe(125);
    });

    it('pega 1500000 y 1.500.000 con el mismo resultado', () => {
      expect(pegar(campo(), '1500000')).toBe(true);
      expect(campo().value).toBe('1.500.000');
      expect(fixture.componentInstance.valor()).toBe(1_500_000);
      vaciar(campo());
      pegar(campo(), '1.500.000');
      expect(campo().value).toBe('1.500.000');
      expect(fixture.componentInstance.valor()).toBe(1_500_000);
    });

    it('pega 1.500 como miles y 1,5 como decimal', () => {
      pegar(campo(), '1.500');
      expect(fixture.componentInstance.valor()).toBe(1500);
      campo().select();
      pegar(campo(), '1,5');
      expect(campo().value).toBe('1,5');
      expect(fixture.componentInstance.valor()).toBe(1.5);
    });

    it('rechaza el pegado con letras o signo', () => {
      expect(pegar(campo(), '12abc')).toBe(true);
      expect(pegar(campo(), '-5')).toBe(true);
      expect(campo().value).toBe('');
    });

    it('al borrar deja el campo vacío y el modelo en null', () => {
      escribir(campo(), '15');
      vaciar(campo());
      expect(campo().value).toBe('');
      expect(fixture.componentInstance.valor()).toBeNull();
    });

    it('el cursor no salta al insertar un dígito en medio', () => {
      escribir(campo(), '1500000');
      campo().setSelectionRange(3, 3);
      escribir(campo(), '9');
      expect(campo().value).toBe('15.900.000');
      expect(campo().selectionStart).toBe(4);
    });

    it('Backspace sobre un separador de miles salta al dígito anterior', () => {
      escribir(campo(), '1500');
      campo().setSelectionRange(2, 2);
      expect(tecla(campo(), 'Backspace')).toBe(true);
      expect(campo().selectionStart).toBe(1);
      expect(campo().value).toBe('1.500');
    });

    it('Delete sobre un separador de miles salta al dígito siguiente', () => {
      escribir(campo(), '1500');
      campo().setSelectionRange(1, 1);
      expect(tecla(campo(), 'Delete')).toBe(true);
      expect(campo().selectionStart).toBe(2);
    });

    it('cargar el modelo muestra el valor con separador', async () => {
      fixture.componentInstance.valor.set(2_500_000.5);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(campo().value).toBe('2.500.000,5');
    });

    it('required y min siguen validando', () => {
      fixture.detectChanges();
      expect(campo().classList.contains('ng-invalid')).toBe(true);
      escribir(campo(), '0');
      fixture.detectChanges();
      expect(campo().classList.contains('ng-invalid')).toBe(true);
      vaciar(campo());
      escribir(campo(), '5');
      fixture.detectChanges();
      expect(campo().classList.contains('ng-valid')).toBe(true);
    });

    it('al salir lleva el valor a sus límites', () => {
      escribir(campo('tope'), '250');
      expect(fixture.componentInstance.limitado).toBe(250);
      campo('tope').dispatchEvent(new Event('blur'));
      expect(campo('tope').value).toBe('100');
      expect(fixture.componentInstance.limitado).toBe(100);
    });

    it('al salir quita la coma decimal sobrante', () => {
      escribir(campo(), '12,');
      expect(campo().value).toBe('12,');
      campo().dispatchEvent(new Event('blur'));
      expect(campo().value).toBe('12');
    });
  });

  describe('idioma en', () => {
    beforeEach(() => montar('en-US'));

    it('escribe 1500000 como 1,500,000', () => {
      escribir(campo(), '1500000');
      expect(campo().value).toBe('1,500,000');
      expect(fixture.componentInstance.valor()).toBe(1_500_000);
    });

    it('usa el punto como decimal', () => {
      escribir(campo(), '1234.5');
      expect(campo().value).toBe('1,234.5');
      expect(fixture.componentInstance.valor()).toBe(1234.5);
    });

    it('pega 1,500,000 y 1500000', () => {
      pegar(campo(), '1,500,000');
      expect(fixture.componentInstance.valor()).toBe(1_500_000);
      campo().select();
      pegar(campo(), '1500000');
      expect(campo().value).toBe('1,500,000');
    });

    it('pega 1.500 como decimal', () => {
      pegar(campo(), '1.500');
      expect(fixture.componentInstance.valor()).toBe(1.5);
    });
  });

  describe('Signal Forms', () => {
    let host: ComponentFixture<SignalHostComponent>;
    const entrada = () => host.nativeElement.querySelector('#signal') as HTMLInputElement;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [SignalHostComponent] });
      TestBed.inject(PREFERENCES).update((p) => ({ ...p, locale: 'es-CO' }));
      host = TestBed.createComponent(SignalHostComponent);
      host.detectChanges();
      await host.whenStable();
    });

    it('al escribir 1500000 muestra 1.500.000 y el modelo guarda 1500000', () => {
      escribir(entrada(), '1500000');
      expect(entrada().value).toBe('1.500.000');
      expect(host.componentInstance.modelo().valor).toBe(1_500_000);
    });

    it('muestra con separador el valor que llega del modelo', async () => {
      host.componentInstance.modelo.set({ valor: 2_500_000 });
      host.detectChanges();
      await host.whenStable();
      expect(entrada().value).toBe('2.500.000');
    });

    it('vaciar el campo deja el modelo en null y la validación required falla', () => {
      escribir(entrada(), '12');
      vaciar(entrada());
      expect(host.componentInstance.modelo().valor).toBeNull();
      expect(
        host.componentInstance.formulario
          .valor()
          .errors()
          .map((e) => e.kind),
      ).toContain('required');
    });

    it('la validación min del formulario ve el número exacto', () => {
      escribir(entrada(), '0');
      expect(
        host.componentInstance.formulario
          .valor()
          .errors()
          .map((e) => e.message),
      ).toEqual(['mínimo']);
      vaciar(entrada());
      escribir(entrada(), '1500000');
      expect(host.componentInstance.formulario.valor().errors()).toHaveLength(0);
    });

    it('el campo es de texto, no numérico', () => {
      expect(entrada().type).toBe('text');
    });
  });
});
