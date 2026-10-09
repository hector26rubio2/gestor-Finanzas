import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ErroresDeFormulario } from './errores-de-formulario';
import { FieldComponent } from './field';

@Component({
  imports: [FieldComponent],
  providers: [ErroresDeFormulario],
  template: `<fin-field label="Monto" campo="amount" [error]="manual()"><input name="amount" /></fin-field>`,
})
class AnfitrionComponent {
  readonly manual = signal('');
}

describe('fin-field', () => {
  async function montar() {
    const fixture = TestBed.createComponent(AnfitrionComponent);
    const errores = fixture.debugElement.injector.get(ErroresDeFormulario);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, errores, entrada: fixture.nativeElement.querySelector('input') as HTMLInputElement };
  }

  it('sin error no marca el control', async () => {
    const { entrada } = await montar();
    expect(entrada.hasAttribute('aria-invalid')).toBe(false);
    expect(entrada.hasAttribute('aria-describedby')).toBe(false);
  });

  it('muestra el error del formulario junto al campo y lo enlaza al control', async () => {
    const { fixture, errores, entrada } = await montar();

    errores.definir({ amount: 'El monto debe ser mayor a 0.' });
    fixture.detectChanges();
    await fixture.whenStable();

    const mensaje = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(mensaje.textContent).toContain('El monto debe ser mayor a 0.');
    expect(entrada.getAttribute('aria-invalid')).toBe('true');
    expect(entrada.getAttribute('aria-describedby')).toBe(mensaje.id);
  });

  it('al limpiar el error quita las marcas', async () => {
    const { fixture, errores, entrada } = await montar();
    errores.definir({ amount: 'Mal' });
    fixture.detectChanges();
    await fixture.whenStable();

    errores.limpiar('amount');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(entrada.hasAttribute('aria-invalid')).toBe(false);
    expect(entrada.hasAttribute('aria-describedby')).toBe(false);
  });

  it('el error explícito tiene prioridad sobre el del formulario', async () => {
    const { fixture, errores } = await montar();
    errores.definir({ amount: 'del formulario' });
    fixture.componentInstance.manual.set('explícito');
    fixture.detectChanges();
    await fixture.whenStable();

    expect((fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement).textContent).toContain('explícito');
  });
});
