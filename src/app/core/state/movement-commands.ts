import { inject, Injectable, Injector } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Movement } from './view-model';
import { FinanceApiClient } from '@core/api/api-client';
import { P } from '@core/session/permissions';
import { toMovement } from '@core/session/mappers/movements.mapper';
import { I18nService } from '@core/i18n';
import { AppStore, CAPABILITIES } from './store';
import type { IntencionDeMovimiento } from './operacion/intencion';
import {
  CLAVE_DE_ERROR,
  type EntornoDeOperacion,
  type OpcionesDeMapeo,
  type SolicitudDeOperacion,
  operar,
  repartoCompleto,
} from './operacion/operar';
import { puedeReversar, solicitudDeReverso } from './operacion/reverso';
import type { ApiMovement } from '@core/api/ledger.api';

const CATEGORIA_DE_OPERACION = 'Transferencias';

@Injectable({ providedIn: 'root' })
export class MovementCommands {
  private readonly store = inject(AppStore);
  private readonly injector = inject(Injector);
  private readonly i18n = inject(I18nService);
  private readonly capabilities = inject(CAPABILITIES);

  async asentar(intencion: IntencionDeMovimiento): Promise<void> {
    const resultado = operar(intencion, this.entorno());
    if (!resultado.ok) throw new Error(this.i18n.t(CLAVE_DE_ERROR[resultado.error.codigo]));
    await this.ejecutar(resultado.solicitud);
    this.store.invalidarListadoDeMovimientos();
    this.store.form.set(null);
  }

  async reversar(movimiento: Movement): Promise<void> {
    const tipoDeCuenta = this.store.account(movimiento.accountId)?.type;
    if (!puedeReversar(movimiento, tipoDeCuenta, (permiso) => this.capabilities.allows(permiso)))
      throw new Error(this.i18n.t(CLAVE_DE_ERROR.sin_permiso));
    await firstValueFrom(this.client().reverseMovement(movimiento.id, solicitudDeReverso(movimiento)));
  }

  async compartir(movimiento: Movement): Promise<void> {
    if (!this.capabilities.allows(P.personas.compras.crear)) throw new Error(this.i18n.t(CLAVE_DE_ERROR.sin_permiso));
    const tercero = this.store.data().people.find((persona) => persona.name === movimiento.person);
    if (!tercero) throw new Error(this.i18n.t(CLAVE_DE_ERROR.contraparte_requerida));
    await firstValueFrom(
      this.client().createSharedPurchase(
        repartoCompleto(movimiento.id, { terceroId: tercero.id, descripcion: movimiento.description }),
      ),
    );
  }

  private client(): FinanceApiClient {
    return this.injector.get(FinanceApiClient);
  }

  private entorno(): EntornoDeOperacion {
    return {
      cuenta: (id) => this.store.account(id),
      persona: (id) => this.store.data().people.find((persona) => persona.id === id),
      categoria: (nombre) => this.store.categories().find((categoria) => categoria.name === nombre),
      movimiento: (id) => this.store.movimiento(id),
      permite: (permiso) => this.capabilities.allows(permiso),
      monedaBase: this.store.baseCurrency(),
      nuevaClave: () => crypto.randomUUID(),
    };
  }

  private aMovimiento(origen: ApiMovement, opciones: OpcionesDeMapeo): Movement {
    return toMovement(this.i18n, this.store.kindCatalog(), origen, opciones);
  }

  private agregar(movimientos: readonly Movement[], quitar?: string): void {
    this.store.data.update((data) => ({
      ...data,
      movements: [...movimientos, ...data.movements.filter((item) => item.id !== quitar)],
    }));
  }

  private async ejecutar(solicitud: SolicitudDeOperacion): Promise<void> {
    const client = this.client();
    switch (solicitud.via) {
      case 'movimiento': {
        const creado = await firstValueFrom(client.createMovement(solicitud.cuerpo));
        if (solicitud.reparto)
          await firstValueFrom(client.createSharedPurchase(repartoCompleto(creado.id, solicitud.reparto)));
        this.agregar([this.aMovimiento(creado, solicitud.presentacion)]);
        return;
      }
      case 'correccion': {
        const creado = await firstValueFrom(
          client.correctMovement(solicitud.originalId, { replacement: solicitud.cuerpo }),
        );
        this.agregar([this.aMovimiento(creado, solicitud.presentacion)], solicitud.originalId);
        const abierto = this.store.inspector();
        if (abierto?.id === solicitud.originalId) this.store.inspector.set({ ...abierto, id: creado.id });
        return;
      }
      case 'reclasificacion': {
        const actualizado = await firstValueFrom(client.reclassifyMovement(solicitud.movimientoId, solicitud.cuerpo));
        this.store.data.update((data) => ({
          ...data,
          movements: data.movements.map((item) =>
            item.id === solicitud.movimientoId
              ? {
                  ...item,
                  description: actualizado.description ?? solicitud.presentacion.descripcion ?? item.description,
                  category: solicitud.presentacion.categoria ?? item.category,
                }
              : item,
          ),
        }));
        return;
      }
      case 'transferencia':
      case 'avance':
      case 'pagoDeTarjeta': {
        const operacion = await firstValueFrom(
          solicitud.via === 'transferencia'
            ? client.createTransfer(solicitud.cuerpo)
            : solicitud.via === 'avance'
              ? client.createCashAdvance(solicitud.cuerpo)
              : client.createCardPayment(solicitud.cuerpo),
        );
        const opciones = { descripcion: solicitud.cuerpo.description, categoria: CATEGORIA_DE_OPERACION };
        this.agregar(operacion.legs.map((pata) => this.aMovimiento(pata, opciones)));
        return;
      }
      case 'prestamo': {
        const prestamo = await firstValueFrom(client.createLoan(solicitud.cuerpo));
        this.agregar(prestamo.movements.map((pata) => this.aMovimiento(pata, solicitud.presentacion)));
        return;
      }
      case 'tarjetaPrestada':
        await firstValueFrom(client.createLoan(solicitud.cuerpo));
        return;
    }
  }
}
