import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  OnDestroy,
  Output,
  ViewChild,
  computed,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { sincronizarPaginaConLaUrl } from '../core/url-state';
import { IconComponent } from './icon';
import { UiOption, UiSelectComponent } from './select';
import { ChartComponent } from './chart';
import { ChartThemeService } from './chart-theme';

export interface TableColumn {
  key: string;
  label: string;
}

@Component({
  selector: 'demo-table',
  standalone: true,
  imports: [FormsModule, IconComponent, UiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './data-table.html',
  styleUrl: './data-table.css',
})
export class DataTableComponent {
  private static nextId = 0;
  readonly rangeId = `table-range-${DataTableComponent.nextId++}`;
  readonly tableLabel = input('Registros');
  readonly columns = input<TableColumn[]>([]);
  readonly rows = input<Record<string, any>[]>([]);
  readonly pageSize = input(10);
  /** Set by remote consumers to avoid slicing an already paged response. */
  readonly totalRows = input<number | null>(null);
  readonly remotePage = input(1);
  readonly selectable = input(true);
  @Output() readonly rowSelected = new EventEmitter<Record<string, any>>();
  @Output() readonly pageSizeChange = new EventEmitter<number>();
  @Output() readonly pageChange = new EventEmitter<number>();
  readonly page = signal(0);

  /**
   * Clave del parámetro donde se guarda la página. Opcional a propósito: la tabla es un
   * componente genérico y tiene que poder montarse fuera de una ruta —en una prueba, por
   * ejemplo—, así que sin clave o sin enrutador simplemente no sincroniza.
   */
  readonly urlKey = input<string | null>(null);
  private readonly selectedSize = signal<number | null>(null);
  readonly size = computed(() => Math.max(1, this.selectedSize() ?? this.pageSize()));
  readonly totalCount = computed(() => this.totalRows() ?? this.rows().length);
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.size())));
  readonly currentPage = computed(() =>
    Math.min(this.totalRows() === null ? this.page() : Math.max(0, this.remotePage() - 1), this.pageCount() - 1),
  );
  readonly start = computed(() => (this.totalCount() ? this.currentPage() * this.size() + 1 : 0));
  readonly end = computed(() => Math.min((this.currentPage() + 1) * this.size(), this.totalCount()));
  readonly visibleRows = computed(() =>
    this.totalRows() === null ? this.rows().slice(this.currentPage() * this.size(), this.end()) : this.rows(),
  );
  readonly pageOptions = computed(() => Array.from({ length: this.pageCount() }, (_, index) => index));
  readonly sizeOptions: readonly UiOption[] = [
    { value: '5', label: '5' },
    { value: '10', label: '10' },
    { value: '25', label: '25' },
  ];
  readonly pageSelectOptions = computed<readonly UiOption[]>(() =>
    this.pageOptions().map((number) => ({ value: number.toString(), label: (number + 1).toString() })),
  );

  constructor() {
    // Fuera de una ruta la tabla sigue funcionando igual, sin tocar la URL. La clave se
    // pasa como funcion: es un input de señal y aun no tiene valor en el constructor.
    if (inject(Router, { optional: true })) {
      sincronizarPaginaConLaUrl(() => this.urlKey(), this.page);
    }
  }
  setSize(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);
    this.selectedSize.set(size);
    this.page.set(0);
    this.pageSizeChange.emit(size);
    if (this.totalRows() !== null) this.pageChange.emit(1);
  }
  setSizeValue(value: string): void {
    const size = Number(value);
    this.selectedSize.set(size);
    this.page.set(0);
    this.pageSizeChange.emit(size);
    if (this.totalRows() !== null) this.pageChange.emit(1);
  }
  setPage(zeroBasedPage: number): void {
    const next = Math.max(0, Math.min(zeroBasedPage, this.pageCount() - 1));
    if (this.totalRows() === null) this.page.set(next);
    else this.pageChange.emit(next + 1);
  }
  setPageFromEvent(event: Event): void {
    this.setPage(Number((event.target as HTMLSelectElement).value));
  }
  setPageValue(value: string): void {
    this.setPage(Number(value));
  }
  display(value: unknown): string {
    return value == null ? '—' : String(value);
  }
}

@Component({
  selector: 'demo-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './overlay.html',
  styleUrl: './overlay.css',
})
export class OverlayComponent implements AfterViewInit, OnDestroy {
  private static nextId = 0;
  readonly titleId = `overlay-title-${OverlayComponent.nextId++}`;
  readonly title = input('Detalle');
  readonly mode = input<'modal' | 'inspector'>('inspector');
  readonly wide = input(false);
  @Output() readonly closed = new EventEmitter<void>();
  @ViewChild('dialog', { static: true }) private dialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('closeButton', { static: true }) private closeButton!: ElementRef<HTMLButtonElement>;
  private previousFocus: HTMLElement | null = null;
  private pointerStartedOnBackdrop = false;
  private emittedClose = false;
  /**
   * Se recuerda quien tenia el foco al construirse, no al pintarse.
   *
   * Entre una cosa y otra cabe el desmontaje de otro panel, y al desmontarse ese devuelve
   * el foco a su propio disparador: el panel nuevo acababa recordando un boton que no era
   * el suyo y, al cerrarse, mandaba el foco a la otra punta de la pantalla. Solo se nota
   * al abrir un panel justo despues de cerrar otro, que es donde lo cazo la suite.
   */
  private readonly abridor = typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null);

  ngAfterViewInit(): void {
    this.previousFocus = this.abridor;
    this.dialog.nativeElement.showModal();
    this.closeButton.nativeElement.focus();
  }
  ngOnDestroy(): void {
    if (this.dialog.nativeElement.open) this.dialog.nativeElement.close();
    // Solo se devuelve el foco si nadie se lo ha llevado ya a otro sitio con sentido:
    // robarselo a la pantalla que acaba de recibirlo es peor que no devolverlo.
    const activo = document.activeElement;
    const nadieLoTiene = !activo || activo === document.body || this.dialog.nativeElement.contains(activo);
    if (nadieLoTiene && this.previousFocus?.isConnected) this.previousFocus.focus();
  }
  requestClose(): void {
    if (this.dialog.nativeElement.open) this.dialog.nativeElement.close();
    if (!this.emittedClose) {
      this.emittedClose = true;
      this.closed.emit();
    }
  }
  onCancel(event: Event): void {
    event.preventDefault();
    this.requestClose();
  }
  backdrop(event: MouseEvent): void {
    if (!this.pointerStartedOnBackdrop || event.target !== this.dialog.nativeElement) return;
    this.pointerStartedOnBackdrop = false;
    if (this.isOutsidePanel(event.clientX, event.clientY)) this.requestClose();
  }
  rememberPointerOrigin(event: PointerEvent): void {
    this.pointerStartedOnBackdrop =
      event.target === this.dialog.nativeElement && this.isOutsidePanel(event.clientX, event.clientY);
  }
  private isOutsidePanel(clientX: number, clientY: number): boolean {
    const rect = this.dialog.nativeElement.getBoundingClientRect();
    return clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom;
  }
}

@Component({
  selector: 'demo-kpi',
  standalone: true,
  imports: [ChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kpi.html',
  styleUrl: './kpi.css',
})
export class KpiComponent {
  readonly label = input('');
  readonly value = input('');
  readonly hint = input('');
  /** Serie del periodo para la minigrafica; con menos de dos puntos no se dibuja. */
  readonly series = input<readonly number[]>([]);
  /** Variacion en tanto por ciento frente al intervalo anterior; `null` la oculta. */
  readonly delta = input<number | null>(null);
  /**
   * Si subir es una buena noticia. En ingresos si; en gastos, no. Sin esto la tarjeta
   * pintaria de verde un mes en el que se gasto un tercio mas.
   */
  readonly subirEsBueno = input(true);

  private readonly tema = inject(ChartThemeService);

  readonly mejora = computed(() => {
    const valor = this.delta();
    return valor !== null && valor !== 0 && valor > 0 === this.subirEsBueno();
  });
  readonly empeora = computed(() => {
    const valor = this.delta();
    return valor !== null && valor !== 0 && !(valor > 0 === this.subirEsBueno());
  });
  /**
   * La flecha dice hacia donde se movio la cifra; el color, si eso es buena noticia.
   *
   * Mezclar las dos cosas en la flecha hacia ilegible la tarjeta de gastos: un gasto que
   * bajaba se pintaba con flecha hacia arriba «porque mejora», y junto al numero en
   * valor absoluto se leia exactamente como lo contrario de lo que habia pasado.
   */
  readonly flecha = computed(() => {
    const valor = this.delta();
    if (valor === null || valor === 0) return '▬';
    return valor > 0 ? '▲' : '▼';
  });
  readonly deltaTitulo = computed(() => {
    const valor = this.delta();
    if (valor === null) return '';
    const sentido = valor > 0 ? 'mas' : 'menos';
    return `${this.deltaTexto()} ${sentido} que el intervalo anterior`;
  });
  readonly deltaTexto = computed(() => {
    const valor = this.delta();
    if (valor === null) return '';
    return `${Math.abs(valor).toFixed(Math.abs(valor) >= 10 ? 0 : 1)}%`;
  });

  readonly chispaOption = computed(() => {
    const palette = this.tema.palette();
    const color = this.empeora() ? palette.danger : palette.accent;
    const valores = [...this.series()];
    return {
      grid: { top: 4, right: 2, bottom: 2, left: 2 },
      xAxis: {
        type: 'category' as const,
        show: true,
        boundaryGap: false,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        data: valores.map((_, i) => i),
      },
      yAxis: { type: 'value' as const, show: false, min: Math.min(...valores), max: Math.max(...valores, 1) },
      tooltip: { show: false },
      series: [
        {
          type: 'line' as const,
          data: valores,
          smooth: 0.3,
          showSymbol: false,
          lineStyle: { width: 1.8, color },
          areaStyle: { color: `color-mix(in srgb, ${color} 16%, transparent)` },
          silent: true,
        },
      ],
    };
  });
}

@Component({
  selector: 'demo-empty',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.css',
})
export class EmptyStateComponent {
  readonly title = input('Todavía no hay registros');
  readonly detail = input('Agrega un movimiento para comenzar.');
}

@Component({
  selector: 'demo-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './skeleton.html',
  styleUrl: './skeleton.css',
})
export class SkeletonComponent {}
