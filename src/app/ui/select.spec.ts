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
  ];
  value = signal('a1');
}

describe('UiSelectComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  const trigger = (root: HTMLElement) => root.querySelector<HTMLButtonElement>('button.trigger')!;

  it('el nombre accesible del disparador incluye la etiqueta y el valor visible', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const label = trigger(fixture.nativeElement).getAttribute('aria-label');
    expect(label).toContain('Cuenta');
    expect(label).toContain('Ahorros principal');
    expect(label).toBe('Cuenta: Ahorros principal');
  });

  it('el nombre accesible sigue al valor elegido', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    trigger(fixture.nativeElement).click();
    fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('[role="option"]')[0].click();
    fixture.detectChanges();

    expect(trigger(fixture.nativeElement).getAttribute('aria-label')).toBe('Cuenta: Todas las cuentas');
  });
});
