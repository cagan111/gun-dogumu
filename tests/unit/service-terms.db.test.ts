import {afterAll,expect,it} from "vitest";
try{process.loadEnvFile('.env')}catch{/* local */}
import {prisma,withTenant} from "@/lib/db";
import {effectiveServiceTerms} from "@/lib/service-terms";
const ids:string[]=[];
async function fixture(){const t=await prisma.tenant.create({data:{slug:`terms-${crypto.randomUUID()}`,name:"Fixture",city:"Girne"}});ids.push(t.id);const s=await prisma.service.create({data:{tenantId:t.id,nameTr:"Fixture",durationMin:30,bufferMin:10,priceTry:"125.50"}}),staff=await prisma.staff.create({data:{tenantId:t.id,name:"Fixture"}});return{t,s,staff};}
const dbit=it.skipIf(!process.env.DATABASE_URL);
afterAll(async()=>{await prisma.tenant.deleteMany({where:{id:{in:ids}}});});
dbit("existing eligibility inserts retain null overrides; DB bounds and scoped reads hold",async()=>{
 const f=await fixture();const link=await prisma.serviceStaff.create({data:{tenantId:f.t.id,serviceId:f.s.id,staffId:f.staff.id}});
 expect(link).toMatchObject({durationMinOverride:null,priceTryOverride:null});
 const key={serviceId_staffId:{serviceId:f.s.id,staffId:f.staff.id}};
 for(const durationMinOverride of [4,601])await expect(prisma.serviceStaff.update({where:key,data:{durationMinOverride} as never})).rejects.toThrow();
 for(const priceTryOverride of ["-0.01","100000.01"])await expect(prisma.serviceStaff.update({where:key,data:{priceTryOverride} as never})).rejects.toThrow();
 const changed=await prisma.serviceStaff.update({where:key,data:{durationMinOverride:45,priceTryOverride:"0"} as never});
 expect(effectiveServiceTerms(f.s,f.staff,changed)).toEqual({durationMin:45,bufferMin:10,priceTry:"0.00"});
 const other=await fixture();expect(await withTenant(other.t.id).serviceStaff.count({where:{serviceId:f.s.id}})).toBe(0);
});
dbit("overrides/default edits do not rewrite existing appointment price/time snapshots",async()=>{
 const f=await fixture();await prisma.serviceStaff.create({data:{tenantId:f.t.id,serviceId:f.s.id,staffId:f.staff.id}});
 const c=await prisma.customer.create({data:{tenantId:f.t.id,name:"Fixture",phone:"+905331234567"}}),startsAt=new Date();
 const a=await prisma.appointment.create({data:{tenantId:f.t.id,staffId:f.staff.id,serviceId:f.s.id,customerId:c.id,startsAt,endsAt:new Date(+startsAt+1800000),blockedUntil:new Date(+startsAt+2400000),priceTry:"125.50",cancelToken:crypto.randomUUID()}});
 await prisma.serviceStaff.updateMany({where:{tenantId:f.t.id},data:{durationMinOverride:60,priceTryOverride:"250"} as never});await prisma.service.update({where:{id:f.s.id},data:{durationMin:90,priceTry:"500"}});
 const stored=await prisma.appointment.findUniqueOrThrow({where:{id:a.id}});expect(stored.priceTry.toString()).toBe("125.5");expect(stored.endsAt).toEqual(a.endsAt);expect(stored.blockedUntil).toEqual(a.blockedUntil);
});
