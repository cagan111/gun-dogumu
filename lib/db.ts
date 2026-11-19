import { PrismaClient, Prisma } from '@prisma/client';
import { scopeArgs } from './tenant';
const g=globalThis as unknown as {prisma?:PrismaClient};
export const prisma=g.prisma??new PrismaClient();
if(process.env.NODE_ENV!=='production')g.prisma=prisma;
// Raw access is private to the fixed-purpose helpers below, including inside transactions.
const bindings=new WeakMap<object,{target:object;tenantId:string}>();
const delegates=new Set(Prisma.dmmf.datamodel.models.map(m=>m.name.charAt(0).toLowerCase()+m.name.slice(1)));
function guardDelegate<T extends object>(target:T):T{return new Proxy(target,{get(obj,key){
 if(typeof key==='string' && (key.startsWith('$')||key.startsWith('_')))throw new Error('Tenant model istemcisi dışına erişim desteklenmiyor');
 const value=Reflect.get(obj,key);return typeof value==='function'?value.bind(obj):value;
}});}
function guard<T extends object>(target:T,tenantId:string):T{
 const proxy=new Proxy(target,{get(obj,key,receiver){
  if(typeof key==='string' && (key.startsWith('_') || key.includes('Raw') || ['$extends','$parent','$use'].includes(key)))throw new Error('Tenant istemcisinde ham SQL/istemci genişletme desteklenmiyor');
  if(key==='$transaction')return (fn:unknown,opts?:unknown)=>{
   if(typeof fn!=='function')throw new Error('Tenant transaction callback gerekli');
   return (Reflect.get(obj,key) as (fn:(tx:object)=>unknown,opts?:unknown)=>unknown).call(obj,(tx:object)=>fn(guard(tx,tenantId)),opts);
  };
  const value=Reflect.get(obj,key,receiver);
  if(typeof key==='string' && delegates.has(key))return guardDelegate(value as object);
  return value;
 }});
 bindings.set(proxy,{target,tenantId});return proxy;
}
export function withTenant(tenantId:string){
 if(!tenantId)throw new Error('tenantId gerekli');
 return guard(prisma.$extends({query:{$allModels:{async $allOperations({model,operation,args,query}){return query(scopeArgs(model,operation,args as never,tenantId) as never);}}}}),tenantId);
}
export type TenantDb=ReturnType<typeof withTenant>;
type SqlClient={ $queryRaw:Prisma.TransactionClient['$queryRaw'] };
function raw(client:SqlClient,tenantId?:string):SqlClient{
 const bound=bindings.get(client);
 if(bound && tenantId && bound.tenantId!==tenantId)throw new Error('Tenant kilidi uyuşmuyor');
 return (bound?.target??client) as SqlClient;
}
/** Fixed SQL only; callers cannot supply query text. Also usable by trusted system transactions. */
export async function lockTenantRow(client:SqlClient,tenantId:string){await raw(client,tenantId).$queryRaw`SELECT id FROM "Tenant" WHERE id = ${tenantId} FOR UPDATE`;}
export async function lockTenantKey(client:SqlClient,tenantId:string,key:string){await raw(client,tenantId).$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key==='monthly'?'monthly:'+tenantId:tenantId+':'+key}))::text`;}
/** Platform-wide safety budget: intentionally global; never returns recipient data. */
export async function lockSmsRecipient(client:SqlClient,phone:string){await raw(client).$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"kr-sms-safety:"+phone},0))::text`;}
export async function smsRecipientUsage(client:SqlClient,phone:string,start:Date,end:Date){return raw(client).$queryRaw<{used:number}[]>`SELECT COALESCE(SUM("smsSafetySegments"),0)::integer AS used FROM "MessageLog" WHERE "recipient" = ${phone} AND "createdAt" >= ${start} AND "createdAt" < ${end}`;}
