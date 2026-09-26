import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RUNTIME_CONFIG } from '../session/runtime';

export const CABECERA_CIFRADO = 'X-Finanzas-Cifrado';
export const TIPO_CIFRADO = 'application/vnd.finanzas.cifrado+json';
export const RUTA_LLAVE_PUBLICA = '/api/v1/crypto/public-key';
export const CODIGO_LLAVE_VIEJA = 'security.cifrado_llave';

export interface Sobre {
  readonly iv: string;
  readonly datos: string;
}

interface LlavePublica {
  readonly id: string;
  readonly clave: CryptoKey;
}

export interface PeticionCifrada {
  readonly cabecera: string;
  readonly cuerpo: string | null;
  readonly llave: CryptoKey;
}

const aBase64 = (bytes: ArrayBuffer | Uint8Array) => {
  const lista = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let texto = '';
  for (const byte of lista) texto += String.fromCharCode(byte);
  return btoa(texto);
};

const deBase64 = (texto: string) => Uint8Array.from(atob(texto), (caracter) => caracter.charCodeAt(0));

export function esSobre(valor: unknown): valor is Sobre {
  const sobre = valor as Sobre;
  return !!sobre && typeof sobre.iv === 'string' && typeof sobre.datos === 'string';
}

export async function sellar(llave: CryptoKey, texto: string, sutil: SubtleCrypto = crypto.subtle): Promise<Sobre> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = await sutil.encrypt({ name: 'AES-GCM', iv }, llave, new TextEncoder().encode(texto));
  return { iv: aBase64(iv), datos: aBase64(cifrado) };
}

export async function abrir(llave: CryptoKey, sobre: Sobre, sutil: SubtleCrypto = crypto.subtle): Promise<unknown> {
  const plano = await sutil.decrypt({ name: 'AES-GCM', iv: deBase64(sobre.iv) }, llave, deBase64(sobre.datos));
  const texto = new TextDecoder().decode(plano);
  return texto ? JSON.parse(texto) : null;
}

@Injectable({ providedIn: 'root' })
export class CifradoService {
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly config = inject(RUNTIME_CONFIG);
  private llave: Promise<LlavePublica> | null = null;

  private llavePublica(renovar: boolean): Promise<LlavePublica> {
    if (renovar || !this.llave)
      this.llave = firstValueFrom(
        this.http.get<{ keyId: string; spki: string }>(`${this.config.apiBaseUrl}${RUTA_LLAVE_PUBLICA}`),
      ).then(async (respuesta) => ({
        id: respuesta.keyId,
        clave: await crypto.subtle.importKey(
          'spki',
          deBase64(respuesta.spki),
          { name: 'RSA-OAEP', hash: 'SHA-256' },
          false,
          ['encrypt'],
        ),
      }));
    const pendiente = this.llave;
    pendiente.catch(() => {
      if (this.llave === pendiente) this.llave = null;
    });
    return pendiente;
  }

  async preparar(cuerpo: unknown, renovar = false): Promise<PeticionCifrada> {
    const publica = await this.llavePublica(renovar);
    const llave = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const cruda = await crypto.subtle.exportKey('raw', llave);
    const envuelta = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publica.clave, cruda);
    const texto =
      cuerpo === null || cuerpo === undefined ? null : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
    return {
      cabecera: `${publica.id}.${aBase64(envuelta)}`,
      cuerpo: texto === null ? null : JSON.stringify(await sellar(llave, texto)),
      llave,
    };
  }

  abrir(sobre: Sobre, llave: CryptoKey): Promise<unknown> {
    return abrir(llave, sobre);
  }
}
