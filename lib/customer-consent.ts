import {z} from 'zod';
import {withTenant} from './db';
import {NotFoundError} from './booking';
import {lockTenant} from './ledger';
import {writeAudit} from './audit';
import {assertOwner,type PanelCtx} from './panel-auth';
import {getCustomer} from './panel/customers';
export const consentSchema=z.object({marketingConsent:z.boolean()}).strict();
export const optOutSchema=z.object({marketingConsent:z.literal(false)}).strict();
export async function getVerifiedConsent(tenantId:string,phone:string){
 const c=await withTenant(tenantId).customer.findFirst({where:{phone},select:{marketingConsent:true}});
 if(!c)throw new NotFoundError('Müşteri');return c;
}
async function change(tenantId:string,where:{id:string}|{phone:string},enabled:boolean,actor:{id?:string;role:string}){
 await withTenant(tenantId).$transaction(async tx=>{
  await lockTenant(tx,tenantId);
  const c=await tx.customer.findFirst({where});if(!c)throw new NotFoundError('Müşteri');
  if(c.marketingConsent===enabled)return;
  await tx.customer.update({where:{id:c.id},data:{marketingConsent:enabled,marketingConsentAt:new Date()}});
  await writeAudit(tx,{tenantId,actorId:actor.id,actorRole:actor.role,action:'customer.marketing_consent',details:{customerId:c.id,enabled,source:actor.role==='customer'?'verified_phone':'owner_opt_out'}});
 });
}
/** Only call after verifying a tenant-bound, unexpired customer cookie at the HTTP boundary. */
export async function updateVerifiedConsent(tenantId:string,phone:string,enabled:boolean){
 await change(tenantId,{phone},enabled,{role:'customer'});return getVerifiedConsent(tenantId,phone);
}
/** Salon owner may withdraw consent but cannot manufacture an opt-in. No paid-plan gate. */
export async function optOutCustomer(ctx:PanelCtx,id:string){
 assertOwner(ctx);await change(ctx.tenantId,{id},false,{id:ctx.user.id,role:'owner'});return getCustomer(ctx,id);
}
