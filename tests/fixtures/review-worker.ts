/** Isolated production registration fixture: own pg-boss schema and one owned tenant only. */
import PgBoss from "pg-boss";
import { startReviewWorker } from "../../jobs/review-worker";
import { recoverReviewInvitations } from "../../lib/messaging/review-worker";
import { prisma } from "../../lib/db";
import { JOB } from "../../jobs/queue";
try { process.loadEnvFile(".env"); } catch { /* supplied env */ }
const schema=process.env.KR_REVIEW_SCHEMA!,tenantId=process.env.KR_REVIEW_TENANT!;
if(!/^kr_rw_[a-f0-9]+$/.test(schema)||!/^c[a-z0-9]+$/.test(tenantId)||process.env.SMS_PROVIDER!=="mock"||process.env.ALLOW_REAL_SMS!=="false")throw new Error("invalid_fixture");
const boss=new PgBoss({connectionString:process.env.DATABASE_URL!,schema,max:2});
boss.on("error",()=>{process.exitCode=1;});
async function main(){
 const tenant=await prisma.tenant.findUnique({where:{id:tenantId},select:{slug:true}});if(!tenant?.slug.startsWith("rw-fixture-"))throw new Error("foreign_fixture");
 await boss.start();await boss.createQueue(JOB.reviewRecovery);
 await startReviewWorker(boss,()=>recoverReviewInvitations({tenantId}));
 const stop=async()=>{await boss.stop({graceful:true});await prisma.$disconnect();process.exit(0);};
 process.on("SIGTERM",()=>void stop());process.on("SIGINT",()=>void stop());
 console.log("REVIEW_WORKER_READY");
}
main().catch(async()=>{await boss.stop().catch(()=>{});await prisma.$disconnect();process.exit(1);});
