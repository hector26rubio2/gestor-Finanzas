import { firstValueFrom } from 'rxjs';
import type { FinanceApiClient } from '@core/api';
import type { I18nService } from '@core/i18n';
import { toMovement } from '@core/session';
import type { MovementKindCatalog } from '@core/utils';
import type { Movement } from '@core/state';

const TAMANO_DE_PAGINA = 100;
const PAGINAS_MAXIMAS = 20;

export async function traerMovimientosDeTarjetas(
  api: FinanceApiClient,
  i18n: I18nService,
  catalogo: MovementKindCatalog,
  tarjetas: readonly string[],
): Promise<Movement[]> {
  if (!tarjetas.length) return [];
  const movimientos: Movement[] = [];
  for (let pagina = 1; pagina <= PAGINAS_MAXIMAS; pagina++) {
    const respuesta = await firstValueFrom(
      api.movements({ page: pagina, pageSize: TAMANO_DE_PAGINA, filter: { cards: [...tarjetas] } }),
    );
    movimientos.push(...respuesta.items.map((m) => toMovement(i18n, catalogo, m)));
    if (!respuesta.hasNext) break;
  }
  return movimientos;
}
