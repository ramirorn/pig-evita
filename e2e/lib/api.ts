import { APIRequestContext, APIResponse, request as pwRequest } from '@playwright/test';
import { ADMIN_EMAIL, API, BASE, PASSWORD } from './env';

export type RoleName =
  | 'SUPER_ADMIN'
  | 'ADMIN_PROVINCIAL'
  | 'ADMIN_DEPARTAMENTAL'
  | 'ADMIN_ZONAL'
  | 'COORDINADOR'
  | 'DELEGADO'
  | 'ENTRENADOR'
  | 'ARBITRO'
  | 'OPERADOR_MESA';

export const ROLES: RoleName[] = [
  'SUPER_ADMIN',
  'ADMIN_PROVINCIAL',
  'ADMIN_DEPARTAMENTAL',
  'ADMIN_ZONAL',
  'COORDINADOR',
  'DELEGADO',
  'ENTRENADOR',
  'ARBITRO',
  'OPERADOR_MESA',
];

/** Departamento / zona con los que se crean los usuarios territoriales. */
export const DEPTO = 'Formosa';
export const ZONA = 'E2E-ZONA';
export const roleEmail = (r: RoleName) =>
  r === 'SUPER_ADMIN' ? ADMIN_EMAIL : `e2e.${r.toLowerCase()}@evita-e2e.test`;

const RUN_OCT = 1 + Math.floor(Math.random() * 250); // distinto en cada corrida: los límites por IP persisten 15 min
let ipSeq = 10;
/** IP de cliente única por llamada: evita compartir los límites por IP (login 5/15 min, lecturas 20/min). */
export const freshIp = () => `10.${RUN_OCT}.${Math.floor(++ipSeq / 250)}.${(ipSeq % 250) + 1}`;

export type Session = { api: Api; token: string; user: any; ip: string };

export class Api {
  constructor(
    public ctx: APIRequestContext,
    public token?: string,
    public ip: string = freshIp(),
    /** Una IP distinta en cada request (sesiones de rol: no deben compartir los límites por IP). */
    public rotate = false,
  ) {}
  private h(extra: Record<string, string> = {}) {
    return {
      'x-test-ip': this.rotate ? freshIp() : this.ip,
      ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      ...extra,
    };
  }
  get(p: string, o: any = {}) {
    return this.ctx.get(API + p, { ...o, headers: this.h(o.headers) });
  }
  post(p: string, data?: any, o: any = {}) {
    return this.ctx.post(API + p, { data, ...o, headers: this.h(o.headers) });
  }
  patch(p: string, data?: any, o: any = {}) {
    return this.ctx.patch(API + p, { data, ...o, headers: this.h(o.headers) });
  }
  put(p: string, data?: any, o: any = {}) {
    return this.ctx.put(API + p, { data, ...o, headers: this.h(o.headers) });
  }
  del(p: string, o: any = {}) {
    return this.ctx.delete(API + p, { ...o, headers: this.h(o.headers) });
  }
  upload(
    p: string,
    file: { name: string; mimeType: string; buffer: Buffer },
    fields: Record<string, string> = {},
    method: 'POST' | 'PATCH' = 'POST',
  ) {
    return this.ctx.fetch(API + p, { method, multipart: { ...fields, file }, headers: this.h() });
  }
}

export async function newCtx() {
  return pwRequest.newContext({ baseURL: BASE });
}

export async function body(r: APIResponse): Promise<any> {
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}
/** Desenvuelve `{ success, data }` y falla con detalle si el estado no es el esperado. */
export async function data<T = any>(r: APIResponse, okStatus?: number | number[]): Promise<T> {
  const b = await body(r);
  const ok = okStatus === undefined ? r.ok() : [okStatus].flat().includes(r.status());
  if (!ok) throw new Error(`HTTP ${r.status()} ${r.url()} → ${JSON.stringify(b).slice(0, 400)}`);
  return (b && typeof b === 'object' && 'data' in b ? b.data : b) as T;
}

const cache = new Map<string, Session & { at: number }>();
/** Login con una IP propia por rol (no consume el límite de otros). Cachea el token. */
export async function as(role: RoleName): Promise<Session> {
  const hit = cache.get(role);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit; // el access token dura 15 min
  const ctx = await newCtx();
  const api = new Api(ctx, undefined, freshIp());
  const d = await data(await api.post('/auth/login', { email: roleEmail(role), password: PASSWORD }));
  api.token = d.accessToken;
  api.rotate = true;
  const s = { api, token: d.accessToken, user: d.user, ip: api.ip, at: Date.now() };
  cache.set(role, s);
  return s;
}
export async function anon(): Promise<Api> {
  return new Api(await newCtx());
}

/** Sufijo único por corrida para los datos creados (evita choques entre corridas). */
export const uniq = (p = 'E2E') => `${p}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
let dniSeq = Math.floor(Math.random() * 9_000_000) + 20_000_000;
export const nextDni = () => String(++dniSeq);

export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
export const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
export const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64, 0x90)]);
