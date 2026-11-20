/** Real local Caddy + isolated Next production server. No public listener or real SMS. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');const assert=require('node:assert/strict');
try{process.loadEnvFile('.env')}catch{ /* optional local env */ }
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kr-proxy-')),secret=crypto.randomBytes(32).toString('hex');
const BASE='http://localhost:3400',children=[];
function stop(){for(const child of children){try{process.kill(-child.pid,'SIGTERM')}catch{ /* exited */ }try{process.kill(-child.pid,'SIGKILL')}catch{ /* exited */ }}}
function start(cmd,args,env,log){const fd=fs.openSync(path.join(dir,log),'a',0o600);const child=spawn(cmd,args,{env,detached:true,stdio:['ignore',fd,fd]});children.push(child);child.on('error',()=>{});fs.closeSync(fd);return child}
async function ready(url){const until=Date.now()+30000;while(Date.now()<until){try{if((await fetch(url)).ok)return}catch{}await new Promise(r=>setTimeout(r,200))}throw new Error('Local test server not ready')}
async function run(name,env){const child=start(process.execPath,[`tests/e2e/${name}.cjs`],env,`${name}.log`);const code=await new Promise(r=>child.on('exit',r));assert.equal(code,0,`Local ${name} test failed; inspect private test log`);console.log(`PASS ${name}`)}
(async()=>{try{
 const appEnv={...process.env,TRUST_PROXY:'true',PROXY_SHARED_SECRET:secret,AUTH_URL:BASE,NEXTAUTH_URL:BASE,SMS_PROVIDER:'mock',ALLOW_REAL_SMS:'false',SMS_APPROVED_SENDERS_JSON:'{}',JOBS_QUEUE:'pgboss'};
 start(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3401'],appEnv,'app.log');await ready('http://127.0.0.1:3401/api/health');
 start(process.execPath,['tests/e2e/proxy-log-fixture.cjs'],process.env,'upstream.log');await ready('http://127.0.0.1:3412/api/health');
 const config=fs.readFileSync('Caddyfile','utf8').replace('app:3000','127.0.0.1:3401').replace('{$CADDY_SITE::80} {','{$CADDY_SITE::80} {\n bind 127.0.0.1');fs.writeFileSync(path.join(dir,'Caddyfile'),config+`\nhttp://localhost:3413 {\n bind 127.0.0.1\n reverse_proxy 127.0.0.1:3412 {\n header_up X-KR-Proxy-Token {$PROXY_SHARED_SECRET}\n }\n}\n`,{mode:0o600});
 start(process.env.CADDY_EXECUTABLE_PATH||'/tmp/kr-caddy',['run','--config',path.join(dir,'Caddyfile'),'--adapter','caddyfile'],{PATH:process.env.PATH,CADDY_SITE:BASE,PROXY_SHARED_SECRET:secret,XDG_DATA_HOME:dir,XDG_CONFIG_HOME:dir},'caddy.log');await ready(`${BASE}/api/health`);
 await fetch(`${BASE}/api/health`,{headers:{authorization:'Bearer kr-auth-marker',cookie:'kr=kr-cookie-marker','x-kr-proxy-token':'kr-token-marker'}});
 await ready('http://localhost:3413/api/health');
 let aborted=false;try{await(await fetch('http://localhost:3413/abort',{headers:{'x-kr-proxy-token':secret,authorization:'Bearer kr-auth-marker',cookie:'kr=kr-cookie-marker'}})).text()}catch{aborted=true}assert.equal(aborted,true,'fixture must cause runtime proxy warning');
 const env={...process.env,BASE_URL:BASE,DIRECT_BASE_URL:"http://127.0.0.1:3401"};delete env.PROXY_SHARED_SECRET;
 for(const name of ['review-settings','calendar-feed','nul-search','http-inputs','csp','proxy-limits','proxy-uri-logs','logout-failure','session-revocation','login-dos','otp-queue','booking','panel','flow','isolation'])await run(name,env);
 const logs=fs.readFileSync(path.join(dir,'caddy.log'),'utf8');assert.ok(logs.includes('aborting with incomplete response'),'must inspect a real runtime warning');for(const value of [secret,'kr-auth-marker','kr-cookie-marker','kr-token-marker'])assert.equal(logs.includes(value),false,'Proxy log leaked a credential marker');
 console.log('PASS real Caddy overwrites forged IP/token headers; private headers absent from access and forced runtime-warning logs');
 }finally{stop()}})().catch(e=>{console.error(e.name,e.message,`private fixture directory: ${dir}`);process.exitCode=1});
process.on('SIGTERM',()=>{stop();process.exit(1)});
