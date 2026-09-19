import { describe, expect, it, vi } from 'vitest';
import { AsyncActionService } from './async-action.service';

const toastPromise = vi.hoisted(() => vi.fn());

vi.mock('ngx-sonner', () => ({
  toast: { promise: toastPromise },
}));

describe('AsyncActionService', () => {
  it('reuses the in-flight operation so a repeated submit cannot duplicate a write', async () => {
    let resolve!: (value: string) => void;
    const operation = new Promise<string>((done) => (resolve = done));
    const factory = vi.fn(() => operation);
    const service = new AsyncActionService();
    const messages = { loading: 'Guardando…', success: 'Guardado', error: 'No se pudo guardar' };

    const first = service.run('movement:create', factory, messages);
    const second = service.run('movement:create', factory, messages);

    await Promise.resolve();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    resolve('ok');
    await expect(first).resolves.toBe('ok');
  });

  it('allows a new operation after the previous one settles', async () => {
    const factory = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');
    const service = new AsyncActionService();
    const messages = { loading: 'Guardando…', success: 'Guardado', error: 'No se pudo guardar' };

    await service.run('card:create', factory, messages);
    await service.run('card:create', factory, messages);

    expect(factory).toHaveBeenCalledTimes(2);
  });
});
