import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../../core/i18n';
import { IconComponent } from '../../../ui/icon';
import { NumericInputDirective } from '../../../ui/numeric-input.directive';
import { UiOption, UiSelectComponent } from '../../../ui/select';

export type GoalKey = 'goalMin' | 'goalTarget' | 'goalMax';

/**
 * Barra de controles de un widget en modo "personalizar": mover, cambiar tipo,
 * dimensión/medida/serie, metas, ocultar. Antes vivía entera dentro del `@for` de
 * widgets en dashboard.html — quién puede hacer qué lo decide el padre (los
 * permisos no cambian por widget), esto solo dibuja lo que ya se le concedió.
 */
@Component({
  selector: 'demo-widget-controls',
  standalone: true,
  imports: [FormsModule, IconComponent, UiSelectComponent, NumericInputDirective],
  templateUrl: './widget-controls.html',
  styleUrl: './widget-controls.css',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetControlsComponent {
  readonly i18n = inject(I18nService);
  readonly type = input.required<string>();
  readonly dimension = input('category');
  readonly measure = input('expense');
  readonly dimension2 = input('kind');
  readonly goalMin = input(0);
  readonly goalTarget = input(0);
  readonly goalMax = input(0);

  readonly typeOptions = input<readonly UiOption[]>([]);
  readonly dimensionOptions = input<readonly UiOption[]>([]);
  readonly measureOptions = input<readonly UiOption[]>([]);

  readonly showDimensionMeasure = input(false);
  readonly showSeries = input(false);
  readonly showGoal = input(false);

  readonly canReorder = input(false);
  readonly canChangeType = input(false);
  readonly canHide = input(false);

  @Output() readonly moveUp = new EventEmitter<void>();
  @Output() readonly moveDown = new EventEmitter<void>();
  @Output() readonly typeChange = new EventEmitter<string>();
  @Output() readonly dimensionChange = new EventEmitter<string>();
  @Output() readonly measureChange = new EventEmitter<string>();
  @Output() readonly dimension2Change = new EventEmitter<string>();
  @Output() readonly goalChange = new EventEmitter<{ key: GoalKey; value: string }>();
  @Output() readonly hide = new EventEmitter<void>();
}
