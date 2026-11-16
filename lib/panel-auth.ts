import { NextResponse } from "next/server";
import { ForbiddenError, SuspendedError } from "./errors";
import { handle } from "./http";
import { requireSuperadmin, requireTenantUser } from "./session";

export type PanelCtx = Awaited<ReturnType<typeof requireTenantUser>>;
export type AdminCtx = Awaited<ReturnType<typeof requireSuperadmin>>;

/** Yazma işlemleri yalnız salon sahibine açıktır (staff → 403). Kontrol servis katmanındadır, route'a güvenilmez. */
export function assertOwner(ctx: Pick<PanelCtx, "user">): void {
  if (ctx.user.role !== "owner") throw new ForbiddenError();
}

/** Askıdaki salonda yazma işlemi yok (423 suspended); okuma serbest. */
export function assertWritable(ctx: Pick<PanelCtx, "tenantStatus">): void {
  if (ctx.tenantStatus === "suspended") throw new SuspendedError();
}

type Params = Record<string, string>;
type RouteCtx = { params: Promise<Params> };
type Out = Response | unknown;

const toResponse = (r: Out): Response => (r instanceof Response ? r : NextResponse.json(r));

/** Panel route sarmalayıcısı: oturum (owner/staff) → ctx; hatalar JSON'a çevrilir. */
export function panelRoute(fn: (ctx: PanelCtx, req: Request, params: Params) => Out) {
  return (req: Request, rc: RouteCtx): Promise<Response> =>
    handle(async () => {
      const ctx = await requireTenantUser();
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) assertWritable(ctx);
      return toResponse(await fn(ctx, req, await rc.params));
    });
}

/** Süper-admin route sarmalayıcısı. */
export function adminRoute(fn: (ctx: AdminCtx, req: Request, params: Params) => Out) {
  return (req: Request, rc: RouteCtx): Promise<Response> =>
    handle(async () => toResponse(await fn(await requireSuperadmin(), req, await rc.params)));
}

export const created = (body: unknown) => NextResponse.json(body, { status: 201 });

/** Sorgu dizgesini düz nesneye çevirir. */
export function queryOf(req: Request): Record<string, string> {
  return Object.fromEntries(new URL(req.url).searchParams.entries());
}
