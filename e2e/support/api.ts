import { apiUrl } from './entorno';

export interface EstadoDeAlmacenamiento {
  cookies: {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Lax';
  }[];
  origins: [];
}

export interface Respuesta<T = any> {
  estado: number;
  datos: T;
}

export class ClienteApi {
  private readonly galletas = new Map<string, string>();
  private csrf: string | null = null;

  async llamar<T = any>(metodo: string, ruta: string, cuerpo?: unknown): Promise<Respuesta<T>> {
    for (let intento = 0; intento < 8; intento += 1) {
      const respuesta = await fetch(`${apiUrl}${ruta}`, {
        method: metodo,
        headers: this.cabeceras(metodo, cuerpo !== undefined),
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      });
      this.guardarGalletas(respuesta);
      if (respuesta.status === 429) {
        const espera = Number(respuesta.headers.get('retry-after') ?? '10');
        await new Promise((listo) => setTimeout(listo, Math.max(1, espera) * 1000));
        continue;
      }
      const texto = await respuesta.text();
      return { estado: respuesta.status, datos: texto ? JSON.parse(texto) : null };
    }
    throw new Error(`${metodo} ${ruta} sigue limitado por tasa tras varios intentos`);
  }

  async exigir<T = any>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
    const { estado, datos } = await this.llamar<T>(metodo, ruta, cuerpo);
    if (estado >= 400) throw new Error(`${metodo} ${ruta} respondió ${estado}: ${JSON.stringify(datos).slice(0, 300)}`);
    return datos;
  }

  async iniciarSesion(usuario: string, clave: string): Promise<void> {
    await this.renovarCsrf();
    await this.exigir('POST', '/api/v1/auth/login', { userName: usuario, password: clave });
    await this.renovarCsrf();
  }

  estadoDeAlmacenamiento(): EstadoDeAlmacenamiento {
    const dominio = new URL(apiUrl).hostname;
    const cookies = [...this.galletas]
      .filter(([nombre]) => !nombre.startsWith('__Host-'))
      .map(([name, value]) => ({
        name,
        value,
        domain: dominio,
        path: '/',
        expires: -1,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax' as const,
      }));
    return { cookies, origins: [] };
  }

  private async renovarCsrf(): Promise<void> {
    const { datos } = await this.llamar<{ token: string }>('GET', '/api/v1/auth/csrf');
    this.csrf = datos.token;
  }

  private cabeceras(metodo: string, conCuerpo: boolean): Record<string, string> {
    const cabeceras: Record<string, string> = {
      Accept: 'application/json',
      Cookie: [...this.galletas].map(([nombre, valor]) => `${nombre}=${valor}`).join('; '),
    };
    if (conCuerpo) cabeceras['Content-Type'] = 'application/json';
    if (metodo !== 'GET' && this.csrf) cabeceras['X-CSRF-Token'] = this.csrf;
    return cabeceras;
  }

  private guardarGalletas(respuesta: Response): void {
    for (const linea of respuesta.headers.getSetCookie()) {
      const [par] = linea.split(';');
      const [nombre, ...resto] = par.split('=');
      this.galletas.set(nombre.trim(), resto.join('='));
    }
  }
}
