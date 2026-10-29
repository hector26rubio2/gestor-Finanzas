import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { DataTableComponent } from './data-table';
import { FinTableRowDetailDirective } from './table-row-detail.directive';
import { TableColumn } from './data-table.model';

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

@Component({
  imports: [DataTableComponent, FinTableRowDetailDirective],
  template: `<fin-table
    [columns]="columns"
    [rows]="data"
    [rowHasDetail]="tieneDetalle"
    (rowSelected)="selected.push($event)"
  >
    <ng-template finTableRowDetail let-row
      ><p class="detalle">Detalle de {{ row.name }}</p></ng-template
    >
  </fin-table>`,
})
class DetailHostComponent {
  columns = columns;
  data = rows;
  selected: unknown[] = [];
  tieneDetalle = (row: Record<string, unknown>) => row['id'] !== 'b';
}

@Component({
  imports: [DataTableComponent, FinTableRowDetailDirective],
  template: `<fin-table [columns]="columns" [rows]="data" [rowDetailLabel]="etiqueta">
    <ng-template finTableRowDetail let-row
      ><p>{{ row.name }}</p></ng-template
    >
  </fin-table>`,
})
class LabeledDetailHostComponent {
  columns = columns;
  data = rows;
  etiqueta = (row: Record<string, unknown>, abierto: boolean) => `${abierto ? 'Cerrar' : 'Abrir'} ${row['name']}`;
}

@Component({
  imports: [DataTableComponent],
  template: `<fin-table [columns]="columns" [rows]="data" />`,
})
class PlainHostComponent {
  columns = columns;
  data = rows;
}

describe('tabla de datos con detalle de fila', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  const toggles = (root: HTMLElement) =>
    [...root.querySelectorAll('tbody button[aria-expanded]')].filter((b) =>
      /Ver detalle|Ocultar detalle|Show details|Hide details/.test(b.textContent ?? ''),
    ) as HTMLButtonElement[];

  it('abre y cierra el detalle de la fila sin emitir la selección', () => {
    const fixture = TestBed.createComponent(DetailHostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const boton = toggles(root)[0];
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('.detalle')).toBeNull();
    boton.click();
    fixture.detectChanges();
    expect(root.querySelector('.detalle')?.textContent).toContain('Detalle de Café');
    expect(toggles(root)[0].getAttribute('aria-expanded')).toBe('true');
    expect(boton.getAttribute('aria-controls')).toBe(root.querySelector('.detalle')!.closest('tr')!.id);
    expect(fixture.componentInstance.selected).toEqual([]);
    toggles(root)[0].click();
    fixture.detectChanges();
    expect(root.querySelector('.detalle')).toBeNull();
    expect(toggles(root)[0].getAttribute('aria-expanded')).toBe('false');
  });

  it('oculta el botón en las filas sin detalle', () => {
    const fixture = TestBed.createComponent(DetailHostComponent);
    fixture.detectChanges();
    expect(toggles(fixture.nativeElement as HTMLElement)).toHaveLength(3);
  });

  it('usa la etiqueta del botón que le pasa la pantalla según esté abierto o cerrado', () => {
    const fixture = TestBed.createComponent(LabeledDetailHostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const boton = [...root.querySelectorAll('tbody button[aria-expanded]')].find((b) =>
      /Abrir/.test(b.textContent ?? ''),
    ) as HTMLButtonElement;
    expect(boton.textContent?.trim()).toBe('Abrir Café');
    boton.click();
    fixture.detectChanges();
    expect(boton.textContent?.trim()).toBe('Cerrar Café');
  });

  it('no muestra botón si no hay plantilla de detalle', () => {
    const fixture = TestBed.createComponent(PlainHostComponent);
    fixture.detectChanges();
    expect(toggles(fixture.nativeElement as HTMLElement)).toHaveLength(0);
  });
});
