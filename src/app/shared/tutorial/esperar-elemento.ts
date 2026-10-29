const INTERVALO_DE_SONDEO = 100;

export function esVisible(elemento: Element | null): elemento is HTMLElement {
  return elemento instanceof HTMLElement && elemento.getClientRects().length > 0;
}

export function esperarElemento(selector: string, milisegundos: number): Promise<boolean> {
  const listo = () => esVisible(document.querySelector(selector));
  if (listo()) return Promise.resolve(true);
  return new Promise((resolver) => {
    const observador = new MutationObserver(() => listo() && terminar(true));
    const sondeo = setInterval(() => listo() && terminar(true), INTERVALO_DE_SONDEO);
    const limite = setTimeout(() => terminar(listo()), milisegundos);
    function terminar(valor: boolean): void {
      observador.disconnect();
      clearInterval(sondeo);
      clearTimeout(limite);
      resolver(valor);
    }
    observador.observe(document.body, { childList: true, subtree: true, attributes: true });
  });
}
