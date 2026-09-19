import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { beforeEach, describe, expect, it } from 'vitest';
import { UiOption, UiSelectComponent } from './select';

@Component({
  imports: [UiSelectComponent, FormsModule],
  template: `<fin-select ariaLabel="Cuenta" [options]="options" [(ngModel)]="value" />`,
})
class HostComponent {
  options: UiOption[] = [
    { value: 'all', label: 'Todas las cuentas' },
    { value: 'a1', label: 'Ahorros principal' },
    { value: '', label: 'Sin cuenta' },
  ];
  value = signal('a1');
}

describe('UiSelectComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  const trigger = (root: HTMLElement) => root.querySelector<HTMLButtonElement>('[data-slot="select-trigger"]')!;
  const items = () => [...document.querySelectorAll<HTMLElement>('[data-slot="select-item"]')];

  async function mount() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('el nombre accesible del disparador incluye la etiqueta y el valor visible', async () => {
    const fixture = await mount();

    expect(trigger(fixture.nativeElement).getAttribute('aria-label')).toBe('Cuenta: Ahorros principal');
  });

  it('elegir una opción actualiza el modelo y el nombre accesible', async () => {
    const fixture = await mount();

    trigger(fixture.nativeElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    items()
      .find((item) => item.textContent?.includes('Todas las cuentas'))!
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBe('all');
    expect(trigger(fixture.nativeElement).getAttribute('aria-label')).toBe('Cuenta: Todas las cuentas');
  });

  it('una opción con valor vacío se puede elegir y se lee como valor vacío', async () => {
    const fixture = await mount();

    trigger(fixture.nativeElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    items()
      .find((item) => item.textContent?.includes('Sin cuenta'))!
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBe('');
    expect(trigger(fixture.nativeElement).getAttribute('aria-label')).toBe('Cuenta: Sin cuenta');
  });
});
