import {afterAll,beforeAll,describe,it,expect} from 'vitest';
import {prisma,withTenant} from '@/lib/db';
import {createAppointment} from '@/lib/booking';
import {addDays,utcToLocal,zonedToUtc} from '@/lib/time';
try{process.loadEnvFile('.env')}catch{ /* optional env */ }
let tenantId='',staffId='',serviceId='',date='';
describe.skipIf(!process.env.DATABASE_URL)('T144 anonymous customer integrity',()=>{
 beforeAll(async()=>{const t=await prisma.tenant.create({data:{slug:`identity-${crypto.randomUUID()}`,name:'Fixture',city:'Girne',minLeadMinutes:0}});tenantId=t.id;date=addDays(utcToLocal(new Date(),t.timeZone).date,3);const s=await prisma.staff.create({data:{tenantId,name:'Fixture'}});staffId=s.id;const v=await prisma.service.create({data:{tenantId,nameTr:'Fixture',durationMin:30,priceTry:100}});serviceId=v.id;await prisma.serviceStaff.create({data:{tenantId,staffId,serviceId}});await prisma.workingHours.createMany({data:[0,1,2,3,4,5,6].map(weekday=>({tenantId,staffId,weekday,startMin:540,endMin:1080}))})});
 afterAll(async()=>{await prisma.tenant.deleteMany({where:{id:tenantId}})});
 const book=(phone:string,min:number,marketingConsent=true)=>createAppointment(withTenant(tenantId),{tenantId,staffId,serviceId,startsAt:zonedToUtc(date,min,'Asia/Famagusta'),customer:{phone,name:'Attacker',email:'changed@example.test',marketingConsent,kvkkAccepted:true}});
 it('cannot overwrite existing identity or forge opt-in',async()=>{const c=await prisma.customer.create({data:{tenantId,phone:'+905339991111',name:'Original',email:'original@example.test',marketingConsent:false}});await book(c.phone,600);const after=await prisma.customer.findUniqueOrThrow({where:{id:c.id}});expect(after.name).toBe(c.name);expect(after.email).toBe(c.email);expect(after.marketingConsent).toBe(false);expect(after.marketingConsentAt).toEqual(c.marketingConsentAt);expect(after.kvkkAcceptedAt).toEqual(c.kvkkAcceptedAt)});
 it('anonymous first booking cannot create marketing permission',async()=>{await book('+905339991112',660);expect((await prisma.customer.findFirstOrThrow({where:{tenantId,phone:'+905339991112'}})).marketingConsent).toBe(false)});
 it('anonymous input cannot withdraw existing consent or fill a private empty email',async()=>{const c=await prisma.customer.create({data:{tenantId,phone:'+905339991113',name:'Original',marketingConsent:true,marketingConsentAt:new Date()}});await book(c.phone,720,false);const after=await prisma.customer.findUniqueOrThrow({where:{id:c.id}});expect(after.marketingConsent).toBe(true);expect(after.marketingConsentAt).toEqual(c.marketingConsentAt);expect(after.email).toBeNull()});

});
