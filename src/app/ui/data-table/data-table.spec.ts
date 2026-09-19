import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { DataTableComponent, TableColumn } from './data-table';

const columns: TableColumn[] = [
  { key: 'name', label: 'Nombre' },
  { key: 'category', label: 'Categoría', facet: true },
  { key: 'amount', label: 'Importe' },
];

const rows = [
  { id: 'a', name: 'Café', category: 'Comida', amount: 3 },
  { id: 'b', name: 'Arriendo', category: 'Hogar', amount: 900 },
  { id: 'c', name: 'Mercado', category: 'Comida', amount: 120 },
  { id: 'd', name: 'Bus', category: 'Transporte', amount: 7 },
];

@Component({
  imports: [DataTableComponent],
  template: `<fin-table
    [columns]="columns"
    [rows]="data()"
    [multiSelect]="true"
    [pageSize]="3"
    (selectionChange)="picked = $event"
  />`,
})
class HostComponent {
  columns = columns;
  data = signal(rows);
  picked: unknown[] = [];
}

function montar() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const table = fixture.debugElement.children[0].componentInstance as DataTableComponent;
  const names = () =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')]
      .filter((row) => row.querySelectorAll('td').length > 1)
      .map((row) => row.querySelectorAll('td')[1].textContent?.trim());
  return { fixture, table, names, host: fixture.componentInstance };
}

describe('tabla de datos', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('pagina en el cliente', () => {
    const { table, names, fixture } = montar();
    expect(names()).toHaveLength(3);
    expect(table.pageCount()).toBe(2);
    table.setPage(1);
    fixture.detectChanges();
    expect(names()).toEqual(['Bus']);
  });

  it('ordena al pulsar el encabezado', () => {
    const { fixture, names } = montar();
    const boton = [...(fixture.nativeElement as HTMLElement).querySelectorAll('thead button')].find((b) =>
      b.textContent?.includes('Nombre'),
    ) as HTMLButtonElement;
    boton.click();
    fixture.detectChanges();
    expect(names()).toEqual(['Arriendo', 'Bus', 'Café']);
    boton.click();
    fixture.detectChanges();
    expect(names()).toEqual(['Mercado', 'Café', 'Bus']);
  });

  it('busca en todos los campos o en uno elegido', () => {
    const { fixture, table, names } = montar();
    table.setSearchText('comida');
    fixture.detectChanges();
    expect(names().sort()).toEqual(['Café', 'Mercado']);
    table.setSearchField('name');
    fixture.detectChanges();
    expect(names()).toEqual([]);
    table.setSearchText('bus');
    fixture.detectChanges();
    expect(names()).toEqual(['Bus']);
    table.clearFilters();
    fixture.detectChanges();
    expect(names()).toHaveLength(3);
  });

  it('filtra por valores de una columna con facetas', () => {
    const { fixture, table, names } = montar();
    expect(table.facetValues('category')).toEqual([
      { value: 'Comida', count: 2 },
      { value: 'Hogar', count: 1 },
      { value: 'Transporte', count: 1 },
    ]);
    table.toggleFacet('category', 'Comida');
    fixture.detectChanges();
    expect(names().sort()).toEqual(['Café', 'Mercado']);
    table.toggleFacet('category', 'Hogar');
    fixture.detectChanges();
    expect(names()).toHaveLength(3);
    table.toggleFacet('category', 'Comida');
    table.toggleFacet('category', 'Hogar');
    fixture.detectChanges();
    expect(table.hasFilters()).toBe(false);
  });

  it('oculta y muestra columnas', () => {
    const { fixture, table } = montar();
    table
      .hideableColumns()
      .find((column) => column.id === 'amount')!
      .toggleVisibility(false);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('thead th')).toHaveLength(3);
  });

  it('selecciona filas y avisa del conjunto', () => {
    const { fixture, table, host } = montar();
    table.toggleRowSelection(table.visibleRows()[0], true);
    fixture.detectChanges();
    expect(host.picked).toHaveLength(1);
    expect(table.selectedCount()).toBe(1);
    table.toggleAllRows(true);
    fixture.detectChanges();
    expect(table.selectedCount()).toBe(3);
  });
});
