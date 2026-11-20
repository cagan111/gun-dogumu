/** Explicit supported operations; nested writes are not scoped by Prisma query extensions. */
import { Prisma } from '@prisma/client';
export const TENANT_MODELS = new Set([
 'ReviewInvitation','Campaign','CampaignRecipient','Staff','Service','ServiceStaff','WorkingHours','TimeOff','Customer','Appointment',
 'SmsLedger','MessageLog','Invoice','Payment','SmsPackageRequest','Otp','AuditLog',
]);
const READ = new Set(['findUnique','findUniqueOrThrow','findFirst','findFirstOrThrow','findMany','count','aggregate','groupBy']);
const WHERE = new Set([...READ,'update','updateMany','updateManyAndReturn','delete','deleteMany','upsert']);
const WRITE = new Set(['create','createMany','createManyAndReturn','update','updateMany','updateManyAndReturn','delete','deleteMany','upsert']);
const relations = new Map(Prisma.dmmf.datamodel.models.map(m=>[m.name,new Set(m.fields.filter(f=>f.kind==='object').map(f=>f.name))]));
type Args = Record<string, unknown> & {where?:Record<string,unknown>;data?:unknown;create?:Record<string,unknown>;update?:Record<string,unknown>};
export function scopeArgs(model:string|undefined,operation:string,args:Args|undefined,tenantId:string):Args {
 if(!tenantId)throw new Error('tenantId gerekli');
 if(!model || (!TENANT_MODELS.has(model)&&model!=='Tenant') || (!READ.has(operation)&&!WRITE.has(operation)))throw new Error('Desteklenmeyen tenant işlemi');
 if(model==='User' && !READ.has(operation))throw new Error('Tenant istemcisinde kullanıcı mutasyonu desteklenmiyor');
 if(model==='AuditLog' && !READ.has(operation) && operation!=='create')throw new Error('Tenant istemcisinde denetim mutasyonu desteklenmiyor');
 function checkRead(m:string,selection:unknown):void{
  if(!selection || typeof selection!=='object')return;
  const fields=Prisma.dmmf.datamodel.models.find(x=>x.name===m)?.fields??[];
  for(const [key,value] of Object.entries(selection)){
   if(!value)continue;
   if(key==='_count'){if(typeof value==='object')checkRead(m,(value as {select?:unknown}).select);continue;}
   const field=fields.find(f=>f.name===key && f.kind==='object');
   if(!field)continue;
   if(!TENANT_MODELS.has(field.type) && field.type!=='Tenant')throw new Error('Desteklenmeyen tenant ilişkisi');
   if(typeof value==='object'){checkRead(field.type,(value as {include?:unknown}).include);checkRead(field.type,(value as {select?:unknown}).select);}
  }
 }
 const a:Args={...(args??{})};
 checkRead(model,a.include);checkRead(model,a.select);
 const scope = model==='Tenant'?{id:tenantId}:{tenantId};
 function data(value:unknown,creating:boolean):Record<string,unknown>{
  const d={...(value as Record<string,unknown>??{})};
  for(const key of Object.keys(d))if(relations.get(model!)?.has(key))throw new Error('Tenant istemcisinde ilişki mutasyonu desteklenmiyor');
  if(!creating && Object.hasOwn(d,'tenantId') && d.tenantId!==tenantId)throw new Error('Tenant değiştirilemez');
  if(model==='Tenant' && Object.hasOwn(d,'id') && d.id!==tenantId)throw new Error('Tenant değiştirilemez');
  return creating?{...d,...scope}:d;
 }
 // Tenant root can be read/updated but cannot be created/deleted from a scoped client.
 if(model==='Tenant' && !READ.has(operation) && !['update','updateMany'].includes(operation))throw new Error('Desteklenmeyen tenant kök işlemi');
 if(WHERE.has(operation))a.where={...(a.where??{}),...scope};
 if(operation==='create')a.data=data(a.data,true);
 if(['createMany','createManyAndReturn'].includes(operation))a.data=Array.isArray(a.data)?a.data.map(d=>data(d,true)):data(a.data,true);
 if(['update','updateMany','updateManyAndReturn'].includes(operation))a.data=data(a.data,false);
 if(operation==='upsert'){a.create=data(a.create,true);a.update=data(a.update,false);}
 return a;
}
