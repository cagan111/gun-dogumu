import { afterAll,beforeAll,describe,expect,it } from "vitest";
import { prisma } from "@/lib/db";
import { resolveTenantUser } from "@/lib/session";
import { searchCustomers } from "@/lib/panel/customers";
import { authenticatePassword } from "@/lib/login";
try{process.loadEnvFile('.env')}catch{ /* optional */ }
let tenantId='',owner:Awaited<ReturnType<typeof resolveTenantUser>>,staff:typeof owner;
describe.skipIf(!process.env.DATABASE_URL)('literal customer lookup and malformed login',()=>{
 beforeAll(async()=>{const t=await prisma.tenant.create({data:{slug:`literal-${crypto.randomUUID()}`,name:'Fixture',city:'Girne'}});tenantId=t.id;for(const role of ['owner','staff'] as const){const u=await prisma.user.create({data:{tenantId,email:`${role}-${crypto.randomUUID()}@example.test`,name:'Fixture',role}});const ctx=await resolveTenantUser({user:{id:u.id,tenantId}});if(role==='owner')owner=ctx;else staff=ctx}await prisma.customer.createMany({data:['Normal Alice','Sale %%%','Code ___','Path \\\\\\'].map((name,i)=>({tenantId,name,phone:`+90533124000${i}`}))})});
 afterAll(async()=>{await prisma.tenant.deleteMany({where:{id:tenantId}})});
 it.each([['%%%','Sale %%%'],['___','Code ___'],['\\\\\\','Path \\\\\\']])('owner and staff search %s literally',async(q,name)=>{for(const ctx of [owner,staff]){const r=await searchCustomers(ctx,{q,page:1,pageSize:25});expect(r.customers.map(c=>c.name)).toEqual([name])}});
 it('NUL login email fails generically without PostgreSQL error',async()=>{await expect(authenticatePassword('bad\0@example.test','fixture-password','192.0.2.247')).resolves.toBeNull()});
});
