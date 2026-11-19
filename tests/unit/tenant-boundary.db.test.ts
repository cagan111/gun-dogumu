import {afterAll,describe,it,expect} from 'vitest';
import {prisma,withTenant,lockTenantRow} from '@/lib/db';
try{process.loadEnvFile('.env')}catch{ /* optional env */ }
const ids:string[]=[];
describe.skipIf(!process.env.DATABASE_URL)('T118 scoped runtime boundary',()=>{
 afterAll(async()=>{await prisma.tenant.deleteMany({where:{id:{in:ids}}})});
 it('rejects raw SQL/unsafe/extensions in root and transaction before execution',async()=>{
 const db=withTenant('fixture');
 for(const key of ['$queryRaw','$queryRawUnsafe','$executeRaw','$executeRawUnsafe','$extends'])expect(()=>Reflect.get(db,key)).toThrow();
 await db.$transaction(async tx=>{expect(()=>tx.$queryRaw).toThrow();expect(()=>tx.$executeRawUnsafe).toThrow()});
 });
 it('scopes Tenant/User and rejects LoginToken, nested mutation and tenant moves; fixed lock helper is bound',async()=>{
 const a=await prisma.tenant.create({data:{slug:`scope-${crypto.randomUUID()}`,name:'A',city:'Girne'}}),b=await prisma.tenant.create({data:{slug:`scope-${crypto.randomUUID()}`,name:'B',city:'Girne'}});ids.push(a.id,b.id);
 const db=withTenant(a.id);expect((await db.tenant.findMany()).map(t=>t.id)).toEqual([a.id]);
 await expect(db.loginToken.findMany()).rejects.toThrow('Desteklenmeyen');
 const customer=await db.customer.create({data:{tenantId:a.id,phone:'+905331110000',name:'A'}});
 await expect(db.customer.update({where:{id:customer.id},data:{tenantId:b.id}})).rejects.toThrow('Tenant');
 await expect(db.customer.update({where:{id:customer.id},data:{appointments:{deleteMany:{}}}})).rejects.toThrow('ilişki');
 await db.$transaction(async tx=>{await lockTenantRow(tx,a.id);await expect(lockTenantRow(tx,b.id)).rejects.toThrow('Tenant kilidi')});
 expect((await prisma.customer.findUniqueOrThrow({where:{id:customer.id}})).tenantId).toBe(a.id);
 });
});
