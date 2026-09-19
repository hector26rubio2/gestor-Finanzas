import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { PermissionPickerComponent } from './permission-picker';

const groups = [
  {
    name: 'cuentas',
    items: [
      { code: 'cuentas.ver', resource: 'cuentas', action: 1, level: 1, description: 'Ver cuentas' },
      { code: 'cuentas.crear', resource: 'cuentas', action: 3, level: 1, description: 'Crear cuentas' },
    ],
  },
  {
    name: 'dashboard',
    items: [{ code: 'dashboard.ver', resource: 'dashboard', action: 1, level: 1, description: 'Ver dashboard' }],
  },
];

describe('selector de permisos', () => {
  beforeEach(() => TestBed.resetTestingModule());

  function montar(granted: string[]) {
    const fixture = TestBed.createComponent(PermissionPickerComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('checked', (code: string) => granted.includes(code));
    fixture.componentRef.setInput('bulk', true);
    fixture.detectChanges();
    const toggled: string[] = [];
    fixture.componentInstance.toggled.subscribe((code) => toggled.push(code));
    return { fixture, component: fixture.componentInstance, toggled };
  }

  it('muestra como seleccionados los permisos concedidos', () => {
    const { component } = montar(['cuentas.ver', 'dashboard.ver']);
    expect(component.selected()).toEqual(['cuentas.ver', 'dashboard.ver']);
    expect(component.total()).toBe(3);
  });

  it('agregar y quitar en el combobox emite solo lo que cambió', () => {
    const { component, toggled } = montar(['cuentas.ver']);
    component.selectionChanged(['cuentas.ver', 'cuentas.crear']);
    component.selectionChanged([]);
    expect(toggled).toEqual(['cuentas.crear', 'cuentas.ver']);
  });

  it('las acciones por grupo emiten los permisos del grupo elegido', () => {
    const { component } = montar([]);
    let received: unknown;
    component.bulkChange.subscribe((change) => (received = change));
    component.bulkGroup.set('dashboard');
    component.applyBulk(true);
    expect(received).toEqual({ items: groups[1].items, value: true });
  });

  it('la búsqueda encuentra por descripción y por código', () => {
    const { component } = montar([]);
    expect(component.searchText('cuentas.crear')).toContain('Crear cuentas');
    expect(component.searchText('cuentas.crear')).toContain('cuentas.crear');
  });
});
