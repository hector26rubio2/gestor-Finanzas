import { ApiNotification } from '@core/api/api-client';
import { tasaAnual } from './accounts.mapper';
import { notificationDetail } from './notifications.mapper';
import { cuotaEnCurso } from './movements.mapper';

function notificacion(payloadJson: string): ApiNotification {
  return { id: 'n1', kind: 'aviso', title: 'Aviso', payloadJson, readAt: null, createdAt: '2026-01-01' };
}

describe('mappers por dominio', () => {
  it('tasaAnual distingue tasa ausente de tasa cero', () => {
    expect(tasaAnual(null)).toBeUndefined();
    expect(tasaAnual('0')).toBe(0);
    expect(tasaAnual('0.285')).toBe(28.5);
    expect(tasaAnual('no-numero')).toBeUndefined();
  });

  it('notificationDetail usa detail, luego description y cae al tipo', () => {
    expect(notificationDetail(notificacion('{"detail":"Pago recibido"}'))).toBe('Pago recibido');
    expect(notificationDetail(notificacion('{"description":"Corte"}'))).toBe('Corte');
    expect(notificationDetail(notificacion('no es json'))).toBe('aviso');
  });

  it('cuotaEnCurso avanza por mes y no pasa del total', () => {
    expect(cuotaEnCurso('2026-01-15', 6, '2026-01-20')).toBe(1);
    expect(cuotaEnCurso('2026-01-15', 6, '2026-03-01')).toBe(3);
    expect(cuotaEnCurso('2025-01-15', 6, '2026-03-01')).toBe(6);
  });
});
