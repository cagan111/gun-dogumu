import {afterAll,expect,it} from "vitest";
try{process.loadEnvFile('.env')}catch{/* local */}
import {prisma,withTenant} from "@/lib/db";
import {createAppointment} from "@/lib/booking";
import {getSlots,bookPublic,publicBookingSchema} from "@/lib/public";
import {MemoryQueue,setQueue} from "@/jobs/queue";
import {addDays,utcToLocal,zonedToUtc} from "@/lib/time";
const ids:string[]=[];
async function fixture(){const now=new Date(),date=addDays(utcToLocal(now,'UTC').date,3),start=zonedToUtc(date,600,'UTC');const t=await prisma.tenant.create({data:{slug:`quote-${crypto.randomUUID()}`,name:"Fixture",city:"Girne",status:"active",timeZone:"UTC",minLeadMinutes:0}});ids.push(t.id);const service=await prisma.service.create({data:{tenantId:t.id,nameTr:"Fixture",durationMin:30,bufferMin:10,priceTry:"125.50"}});const staff=await Promise.all([0,1].map(sortOrder=>prisma.staff.create({data:{tenantId:t.id,name:"Fixture",sortOrder}})));for(const s of staff){await prisma.serviceStaff.create({data:{tenantId:t.id,serviceId:service.id,staffId:s.id}});await prisma.workingHours.createMany({data:[0,1,2,3,4,5,6].map(weekday=>({tenantId:t.id,staffId:s.id,weekday,startMin:540,endMin:1080,breaks:[]}))});}setQueue(new MemoryQueue());const quote={serviceId:service.id,staffId:staff[1]!.id,startsAt:start.toISOString(),durationMin:30,bufferMin:10,priceTry:"125.50"};const input={tenantId:t.id,serviceId:service.id,staffId:"any",startsAt:start,customer:{name:"Fixture",phone:"+905331234567"},now,quote};return{t,service,staff,quote,input,date,now};}
const dbit=it.skipIf(!process.env.DATABASE_URL);
afterAll(async()=>{setQueue(null);await prisma.tenant.deleteMany({where:{id:{in:ids}}});});
dbit("slots expose exact base offers and public booking binds quoted any staff",async()=>{
 const f=await fixture(),slots=await getSlots(f.t.slug,{serviceId:f.service.id,staffId:"any",date:f.date},f.now);
 const slot=slots.slots.find(s=>s.startsAt===f.quote.startsAt) as unknown as {offers:typeof f.quote[]};expect(slot.offers).toContainEqual(f.quote);
 const parsed=publicBookingSchema.parse({serviceId:f.service.id,staffId:"any",startsAt:f.quote.startsAt,quote:f.quote,customer:f.input.customer,kvkkAccepted:true});
 const result=await bookPublic(f.t.slug,parsed,f.now);expect(await prisma.appointment.findUnique({where:{id:result.id}})).toMatchObject({staffId:f.quote.staffId});
});
dbit("price, duration or buffer change after quote rejects before customer/appointment writes",async()=>{
 for(const data of [{priceTry:"200"},{durationMin:45},{bufferMin:20}]){const f=await fixture();await prisma.service.update({where:{id:f.service.id},data});
 await expect(createAppointment(withTenant(f.t.id),f.input)).rejects.toMatchObject({code:"conflict"});expect(await prisma.appointment.count({where:{tenantId:f.t.id}})).toBe(0);expect(await prisma.customer.count({where:{tenantId:f.t.id}})).toBe(0);}
});
dbit("quote cannot be transplanted to another service/staff/time or discounted",async()=>{
 const f=await fixture(),g=await fixture();for(const quote of [{...f.quote,priceTry:"0.00"},{...f.quote,serviceId:g.service.id},{...f.quote,staffId:g.staff[0]!.id},{...f.quote,startsAt:new Date(+f.input.startsAt+900000).toISOString()}])await expect(createAppointment(withTenant(f.t.id),{...f.input,quote})).rejects.toMatchObject({code:"conflict"});
 await expect(createAppointment(withTenant(f.t.id),{...f.input,staffId:f.staff[0]!.id})).rejects.toMatchObject({code:"conflict"});
 expect(await prisma.customer.count({where:{tenantId:f.t.id}})).toBe(0);
});
dbit("quoted any has no silent staff fallback when concurrent requests compete",async()=>{
 const f=await fixture();const results=await Promise.allSettled([createAppointment(withTenant(f.t.id),f.input),createAppointment(withTenant(f.t.id),{...f.input,customer:{name:"Other",phone:"+905551234567"}})]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(await prisma.appointment.count({where:{tenantId:f.t.id}})).toBe(1);
});
dbit("unactivated differing overrides cannot be booked or advertised as base offers",async()=>{
 const f=await fixture();await prisma.serviceStaff.updateMany({where:{tenantId:f.t.id},data:{durationMinOverride:60,priceTryOverride:"300"}});
 await expect(createAppointment(withTenant(f.t.id),{...f.input,quote:undefined})).rejects.toMatchObject({code:"conflict"});
 await expect(getSlots(f.t.slug,{serviceId:f.service.id,staffId:"any",date:f.date},f.now)).rejects.toMatchObject({code:"conflict"});
});
dbit("legacy base booking still works and quoted snapshots survive later config changes",async()=>{
 const f=await fixture();const a=await createAppointment(withTenant(f.t.id),f.input);await prisma.service.update({where:{id:f.service.id},data:{durationMin:60,priceTry:"500"}});
 const stored=await prisma.appointment.findUniqueOrThrow({where:{id:a.id}});expect(stored.priceTry.toString()).toBe("125.5");expect(+stored.endsAt-+stored.startsAt).toBe(1800000);expect(+stored.blockedUntil-+stored.endsAt).toBe(600000);
 const g=await fixture();await expect(createAppointment(withTenant(g.t.id),{...g.input,quote:undefined})).resolves.toMatchObject({tenantId:g.t.id});
});
dbit("panel create forwards the same expectation and cannot silently reprice it",async()=>{
 const f=await fixture();const {resolveTenantUser}=await import("@/lib/session"),{createPanelAppointment,createSchema}=await import("@/lib/panel/appointments");
 const user=await prisma.user.create({data:{tenantId:f.t.id,email:`${crypto.randomUUID()}@example.test`,name:"Owner",role:"owner"}}),ctx=await resolveTenantUser({user:{id:user.id}});
 await prisma.service.update({where:{id:f.service.id},data:{priceTry:"200"}});
 const body={serviceId:f.service.id,staffId:"any",startsAt:f.quote.startsAt,customer:f.input.customer,quote:f.quote};
 await expect(createPanelAppointment(ctx,createSchema.parse(body),f.now)).rejects.toMatchObject({code:"conflict"});
 expect(await prisma.customer.count({where:{tenantId:f.t.id}})).toBe(0);
 const result=await createPanelAppointment(ctx,createSchema.parse({...body,quote:{...f.quote,priceTry:"200.00"}}),f.now);expect(result).toMatchObject({staffId:f.quote.staffId,priceTry:200});
});
it("quote shape is strict, canonical-money only and normalizes the same UTC instant",async()=>{
 const {serviceQuoteSchema}=await import("@/lib/service-quote");const good={serviceId:"svc",staffId:"staff",startsAt:"2026-10-25T03:30:00+02:00",durationMin:30,bufferMin:10,priceTry:"0.00"};
 expect(serviceQuoteSchema.parse(good).startsAt).toBe("2026-10-25T01:30:00.000Z");
 for(const quote of [{...good,discount:1},{...good,staffId:"any"},{...good,priceTry:"1.001"},{...good,priceTry:1},{...good,durationMin:0},{...good,bufferMin:241}])expect(serviceQuoteSchema.safeParse(quote).success).toBe(false);
});
dbit("locked booking decision rejects suspension after an earlier active resolution",async()=>{
 const f=await fixture();await prisma.tenant.update({where:{id:f.t.id},data:{status:"suspended"}});
 for(const quote of [f.quote,undefined])await expect(createAppointment(withTenant(f.t.id),{...f.input,quote})).rejects.toMatchObject({code:"suspended"});
 expect(await prisma.customer.count({where:{tenantId:f.t.id}})).toBe(0);expect(await prisma.appointment.count({where:{tenantId:f.t.id}})).toBe(0);
});
