import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { NumericInputDirective } from './numeric-input.directive';

@Component({
  imports: [NumericInputDirective],
  template: `<input type="number" />`,
})
class HostComponent {}

function keydown(input: HTMLInputElement, key: string): boolean {
  const event = new KeyboardEvent('keydown', { key, cancelable: true });
  input.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('NumericInputDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let input: HTMLInputElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    input = fixture.nativeElement.querySelector('input');
  });

  it('bloquea el signo y la notación científica', () => {
    expect(keydown(input, '-')).toBe(true);
    expect(keydown(input, '+')).toBe(true);
    expect(keydown(input, 'e')).toBe(true);
    expect(keydown(input, 'E')).toBe(true);
  });

  it('deja pasar dígitos, punto decimal y teclas de navegación', () => {
    expect(keydown(input, '5')).toBe(false);
    expect(keydown(input, '.')).toBe(false);
    expect(keydown(input, 'Backspace')).toBe(false);
    expect(keydown(input, 'ArrowLeft')).toBe(false);
  });

  /**
   * jsdom no implementa `ClipboardEvent`: se arma un `Event` normal y se le cuelga
   * `clipboardData` a mano, que es lo único que la directiva llega a leer.
   */
  function paste(text: string): boolean {
    const event = new Event('paste', { cancelable: true }) as Event & { clipboardData: DataTransfer };
    event.clipboardData = { getData: () => text } as unknown as DataTransfer;
    input.dispatchEvent(event);
    return event.defaultPrevented;
  }

  it('sanea el pegado que trae letras o signo', () => {
    expect(paste('-5e3')).toBe(true);
  });

  it('deja pasar un pegado de solo dígitos y punto', () => {
    expect(paste('1234.56')).toBe(false);
  });
});
