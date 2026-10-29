export const crearUltimaPeticion = () => {
  let actual = 0;
  return {
    iniciar: (): (() => boolean) => {
      const propia = ++actual;
      return () => propia === actual;
    },
  };
};

export const aplicarSiVigente = <T>(
  promesa: Promise<T>,
  esVigente: () => boolean,
  alExito: (valor: T) => void,
  alError: () => void,
): Promise<void> =>
  promesa
    .then((valor) => {
      if (esVigente()) alExito(valor);
    })
    .catch(() => {
      if (esVigente()) alError();
    });
