import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConfirmDialogComponent } from './confirm-dialog';

@Component({
  imports: [ConfirmDialogComponent],
  template: `
    <fin-confirm-dialog
      [open]="open()"
      title="¿Reversar?"
      description="Se registrará una reversión."
      confirmLabel="Reversar"
      cancelLabel="Cancelar"
      (confirmed)="confirmed = confirmed + 1"
      (dismissed)="dismissed = dismissed + 1"
    />
  `,
})
class HostComponent {
  readonly open = signal(false);
  confirmed = 0;
  dismissed = 0;
}

describe('ConfirmDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  async function abrir() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const boton = (selector: string) => document.querySelector<HTMLButtonElement>(selector);

  it('muestra el título, la descripción y las dos acciones al abrirse', async () => {
    await abrir();

    expect(document.querySelector('[hlmAlertDialogTitle]')?.textContent).toContain('¿Reversar?');
    expect(document.querySelector('[hlmAlertDialogDescription]')?.textContent).toContain('reversión');
    expect(boton('button[hlmAlertDialogCancel]')?.textContent).toContain('Cancelar');
    expect(boton('button[hlmAlertDialogAction]')?.textContent).toContain('Reversar');
  });

  it('emite confirmed, y no dismissed, al aceptar', async () => {
    const fixture = await abrir();

    boton('button[hlmAlertDialogAction]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.confirmed).toBe(1);
    expect(fixture.componentInstance.dismissed).toBe(0);
  });

  it('emite dismissed, y no confirmed, al cancelar', async () => {
    const fixture = await abrir();

    boton('button[hlmAlertDialogCancel]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.dismissed).toBe(1);
    expect(fixture.componentInstance.confirmed).toBe(0);
  });
});
