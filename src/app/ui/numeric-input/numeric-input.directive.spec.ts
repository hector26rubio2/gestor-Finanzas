import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { NumericInputDirective } from './numeric-input.directive';

@Component({
  imports: [NumericInputDirective],
  template: `
    <input id="monto" type="number" />
    <input id="dias" type="number" min="1" max="31" step="1" />
    <input id="rango" type="number" finConSigno />
    <input id="digitos" type="text" finDigitos maxlength="4" />
  `,
})
class HostComponent {}

function keydown(input: HTMLInputElement, key: string): boolean {
  const event = new KeyboardEvent('keydown', { key, cancelable: true });
  input.dispatchEvent(event);
  return event.defaultPrevented;
}

function paste(input: HTMLInputElement, text: string): boolean {
  const event = new Event('paste', { cancelable: true }) as Event & { clipboardData: DataTransfer };
  event.clipboardData = { getData: () => text } as unknown as DataTransfer;
  input.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('NumericInputDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  const campo = (id: string) => fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('bloquea el signo, la notación científica y las letras', () => {
    for (const tecla of ['-', '+', 'e', 'E', 'a', ',', ' ']) expect(keydown(campo('monto'), tecla)).toBe(true);
  });

  it('deja pasar dígitos, punto decimal y teclas de navegación', () => {
    for (const tecla of ['5', '.', 'Backspace', 'ArrowLeft', 'Tab']) expect(keydown(campo('monto'), tecla)).toBe(false);
  });

  it('pone mínimo 0 cuando el campo no dice otro', () => {
    expect(campo('monto').min).toBe('0');
    expect(campo('dias').min).toBe('1');
    expect(campo('rango').min).toBe('');
  });

  it('un campo de enteros no acepta punto', () => {
    expect(keydown(campo('dias'), '.')).toBe(true);
  });

  it('un campo con signo acepta el menos al inicio', () => {
    expect(keydown(campo('rango'), '-')).toBe(false);
  });

  it('un campo de dígitos no acepta letras, punto ni signo', () => {
    for (const tecla of ['a', '.', '-']) expect(keydown(campo('digitos'), tecla)).toBe(true);
    expect(keydown(campo('digitos'), '7')).toBe(false);
  });

  it('rechaza el pegado con letras o signo y acepta el de solo números', () => {
    expect(paste(campo('monto'), '-5e3')).toBe(true);
    expect(paste(campo('monto'), '1234.56')).toBe(false);
    expect(paste(campo('digitos'), '12a4')).toBe(true);
  });

  it('al salir del campo lleva el valor a sus límites', () => {
    const dias = campo('dias');
    dias.value = '45';
    dias.dispatchEvent(new Event('blur'));
    expect(dias.value).toBe('31');
    const monto = campo('monto');
    monto.value = '-20';
    monto.dispatchEvent(new Event('blur'));
    expect(monto.value).toBe('0');
  });

  it('al salir de un campo de dígitos quita lo que no es número', () => {
    const digitos = campo('digitos');
    digitos.value = '1a2b';
    digitos.dispatchEvent(new Event('blur'));
    expect(digitos.value).toBe('12');
  });
});
