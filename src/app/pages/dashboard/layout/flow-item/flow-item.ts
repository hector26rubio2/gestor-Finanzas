import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output } from '@angular/core';
import { I18nService } from '../../../../core/i18n';
import { IconComponent } from '../../../../ui/icon/icon';
import {
  FlowItem,
  GRID_GAP,
  ROW_HEIGHT_STEP,
  clampCols,
  clampHeight,
  colsFromWidth,
  rowSpan,
} from '../dashboard-layout';
import { FlowResize } from '../dashboard-layout.service';

type Axis = 'x' | 'y' | 'xy';

interface ResizeSession {
  readonly axis: Axis;
  readonly pointerX: number;
  readonly pointerY: number;
  readonly width: number;
  readonly height: number;
  readonly containerWidth: number;
}

@Component({
  selector: 'fin-flow-item',
  imports: [CdkDragHandle, IconComponent],
  hostDirectives: [CdkDrag],
  templateUrl: './flow-item.html',
  host: {
    class:
      'relative block min-w-0 pb-5 [grid-row:span_var(--rows)] col-span-12 min-[701px]:[grid-column:span_var(--cols)]',
    '[style.--cols]': 'item().cols',
    '[style.--rows]': 'rows()',
    '[attr.data-flow-id]': 'item().id',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowItemComponent {
  protected readonly i18n = inject(I18nService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly drag = inject(CdkDrag);
  private session: ResizeSession | null = null;

  readonly item = input.required<FlowItem>();
  readonly editable = input(false);
  readonly minCols = input(2);
  readonly resized = output<FlowResize>();
  readonly moved = output<number>();

  protected readonly rows = computed(() => rowSpan(this.item().height));

  constructor() {
    effect(() => {
      this.drag.disabled = !this.editable();
    });
  }

  protected startResize(event: PointerEvent, axis: Axis): void {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    const element = this.host.nativeElement;
    this.session = {
      axis,
      pointerX: event.clientX,
      pointerY: event.clientY,
      width: element.getBoundingClientRect().width,
      height: this.item().height,
      containerWidth: element.parentElement?.clientWidth ?? element.offsetWidth,
    };
  }

  protected resize(event: PointerEvent): void {
    const session = this.session;
    if (!session) return;
    const change: { cols?: number; height?: number } = {};
    if (session.axis !== 'y') {
      const width = session.width + event.clientX - session.pointerX;
      change.cols = clampCols(colsFromWidth(width, session.containerWidth, GRID_GAP), this.minCols());
    }
    if (session.axis !== 'x') change.height = clampHeight(session.height + event.clientY - session.pointerY);
    this.resized.emit(change);
  }

  protected endResize(): void {
    this.session = null;
  }

  protected resizeByKey(event: KeyboardEvent, axis: Axis): void {
    const step = event.shiftKey ? ROW_HEIGHT_STEP * 5 : ROW_HEIGHT_STEP * 2;
    const { cols, height } = this.item();
    const horizontal = axis !== 'y';
    const vertical = axis !== 'x';
    if (horizontal && event.key === 'ArrowRight') this.resized.emit({ cols: cols + 1 });
    else if (horizontal && event.key === 'ArrowLeft') this.resized.emit({ cols: cols - 1 });
    else if (vertical && event.key === 'ArrowDown') this.resized.emit({ height: height + step });
    else if (vertical && event.key === 'ArrowUp') this.resized.emit({ height: height - step });
    else return;
    event.preventDefault();
  }

  protected moveByKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') this.moved.emit(-1);
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') this.moved.emit(1);
    else return;
    event.preventDefault();
  }
}
