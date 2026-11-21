import {afterAll,expect,it} from "vitest";
try{process.loadEnvFile('.env')}catch{/* local */}
import {prisma} from "@/lib/db";
import {resolveTenantUser} from "@/lib/session";
import {createService,updateService,serviceSchema,servicePatchSchema} from "@/lib/panel/catalog";
const ids:string[]=[];
async function fixture(){const t=await prisma.tenant.create({data:{slug:`catalog-terms-${crypto.randomUUID()}`,name:"Fixture",city:"Girne",status:"active"}});ids.push(t.id);const u=await prisma.user.create({data:{tenantId:t.id,email:`${crypto.randomUUID()}@example.test`,name:"Owner",role:"owner"}}),ctx=await resolveTenantUser({user:{id:u.id}});const svc=await prisma.service.create({data:{tenantId:t.id,nameTr:"Original",durationMin:30,priceTry:"125.50",bufferMin:10,sortOrder:7,active:false}});const staff=await Promise.all([0,1,2].map(()=>prisma.staff.create({data:{tenantId:t.id,name:"Fixture"}})));for(const s of staff.slice(0,2))await prisma.serviceStaff.create({data:{tenantId:t.id,serviceId:svc.id,staffId:s.id,durationMinOverride:45,priceTryOverride:"0"}});return{t,ctx,svc,staff};}
const dbit=it.skipIf(!process.env.DATABASE_URL);
afterAll(async()=>{await prisma.tenant.deleteMany({where:{id:{in:ids}}});});
it("PATCH omission stays omission; precision is rejected before decimal storage",()=>{
 expect(servicePatchSchema.parse({nameTr:"Renamed"})).toEqual({nameTr:"Renamed"});
 for(const priceTry of [1.001,0.001,99999.999]){expect(servicePatchSchema.safeParse({priceTry}).success).toBe(false);expect(serviceSchema.safeParse({nameTr:"Fixture",durationMin:30,priceTry}).success).toBe(false);}
 for(const priceTry of [0,0.29,125.5,100000])expect(servicePatchSchema.safeParse({priceTry}).success).toBe(true);
});
dbit("rename via parsed PATCH preserves defaults, eligibility and stored overrides",async()=>{
 const f=await fixture();await updateService(f.ctx,f.svc.id,servicePatchSchema.parse({nameTr:"Renamed"}));
 expect(await prisma.service.findUnique({where:{id:f.svc.id}})).toMatchObject({nameTr:"Renamed",bufferMin:10,active:false,sortOrder:7});
 const links=await prisma.serviceStaff.findMany({where:{serviceId:f.svc.id}});expect(links).toHaveLength(2);expect(links.every(l=>l.durationMinOverride===45&&l.priceTryOverride?.toString()==="0")).toBe(true);
});
dbit("explicit staff replacement retains intersection overrides and defaults only new links",async()=>{
 const f=await fixture();await updateService(f.ctx,f.svc.id,{staffIds:[f.staff[0]!.id,f.staff[2]!.id]});
 const links=await prisma.serviceStaff.findMany({where:{serviceId:f.svc.id}});expect(links).toHaveLength(2);
 expect(links.find(l=>l.staffId===f.staff[0]!.id)).toMatchObject({durationMinOverride:45});expect(links.find(l=>l.staffId===f.staff[0]!.id)?.priceTryOverride?.toString()).toBe("0");
 expect(links.find(l=>l.staffId===f.staff[2]!.id)).toMatchObject({durationMinOverride:null,priceTryOverride:null});
 await updateService(f.ctx,f.svc.id,{staffIds:[]});expect(await prisma.serviceStaff.count({where:{serviceId:f.svc.id}})).toBe(0);
});
dbit("fresh suspended tenant blocks stale active owner on create and update",async()=>{
 const f=await fixture();await prisma.tenant.update({where:{id:f.t.id},data:{status:"suspended"}});
 await expect(createService(f.ctx,serviceSchema.parse({nameTr:"Denied",durationMin:30,priceTry:1}))).rejects.toMatchObject({code:"suspended"});
 await expect(updateService(f.ctx,f.svc.id,{nameTr:"Denied"})).rejects.toMatchObject({code:"suspended"});
});
dbit("audit failure rolls service and link update back together",async()=>{
 const f=await fixture(),suffix=crypto.randomUUID().replaceAll('-',''),fn=`kr_catalog_fail_${suffix}`,trigger=`kr_catalog_trigger_${suffix}`;expect(f.t.id).toMatch(/^[a-z0-9]+$/);
 try{
 await prisma.$executeRawUnsafe(`CREATE FUNCTION "${fn}"() RETURNS trigger AS $$ BEGIN IF NEW."tenantId" = '${f.t.id}' AND NEW.action IN ('service.create','service.update') THEN RAISE EXCEPTION 'injected_catalog_failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
 await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION "${fn}"()`);
 await expect(updateService(f.ctx,f.svc.id,{nameTr:"Rollback",staffIds:[]})).rejects.toThrow();
 expect(await prisma.service.findUnique({where:{id:f.svc.id}})).toMatchObject({nameTr:"Original"});expect(await prisma.serviceStaff.count({where:{serviceId:f.svc.id}})).toBe(2);
 await expect(createService(f.ctx,serviceSchema.parse({nameTr:"Rollback create",durationMin:30,priceTry:1,staffIds:[f.staff[0]!.id]}))).rejects.toThrow();
 expect(await prisma.service.count({where:{tenantId:f.t.id}})).toBe(1);
 }finally{await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "AuditLog"`);await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${fn}"()`);}
});
dbit("foreign service/staff and staff role still cannot mutate catalog",async()=>{
 const f=await fixture(),g=await fixture();await expect(updateService(f.ctx,g.svc.id,{nameTr:"Denied"})).rejects.toMatchObject({code:"not_found"});
 await expect(updateService(f.ctx,f.svc.id,{staffIds:[g.staff[0]!.id]})).rejects.toMatchObject({code:"not_found"});
 await expect(updateService({...f.ctx,user:{...f.ctx.user,role:"staff"}},f.svc.id,{nameTr:"Denied"})).rejects.toMatchObject({code:"forbidden"});
});
