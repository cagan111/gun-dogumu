/** Real Caddy log privacy with a loopback fixture; synthetic tokens only. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kr-uri-')),base='http://localhost:3423';let child,server;
const markers=['kr-path-token','kr-query-token','kr-referer-token','kr-location-token','kr-runtime-token','kr-ical-token','kr%2Dencoded%2Dtoken'];
(async()=>{try{
 const seen=[];server=http.createServer((req,res)=>{seen.push(req.url);if(req.url.startsWith('/abort/')){res.writeHead(200,{'content-length':'1000'});res.write('fixture');setTimeout(()=>res.destroy(),50);return}if(req.url.startsWith('/r/')){res.writeHead(302,{location:'/giris/sihirli?token=kr-location-token'});res.end();return}res.end('ok')});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(3422,'127.0.0.1',resolve)});
 const config=fs.readFileSync('Caddyfile','utf8').replace('{\n','{\n admin off\n').replace('app:3000','127.0.0.1:3422').replace('{$CADDY_SITE::80} {','{$CADDY_SITE::80} {\n bind 127.0.0.1');fs.writeFileSync(path.join(dir,'Caddyfile'),config,{mode:0o600});
 const fd=fs.openSync(path.join(dir,'caddy.log'),'a',0o600);child=spawn(process.env.CADDY_EXECUTABLE_PATH||'/tmp/kr-caddy',['run','--config',path.join(dir,'Caddyfile'),'--adapter','caddyfile'],{detached:true,env:{PATH:process.env.PATH,CADDY_SITE:base,PROXY_SHARED_SECRET:crypto.randomBytes(32).toString('hex'),XDG_DATA_HOME:dir,XDG_CONFIG_HOME:dir},stdio:['ignore',fd,fd]});fs.closeSync(fd);
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}assert.ok(ready,'fixture proxy ready');
 const headers={referer:base+'/sifre-belirle?token=kr-referer-token'};
 const r=await fetch(base+'/r/kr-path-token?token=kr-query-token',{redirect:'manual',headers});assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/giris/sihirli?token=kr-location-token');await r.text();
 const encoded='/r/kr%2Dencoded%2Dtoken?%74oken=kr%2Dencoded%2Dtoken';await(await fetch(base+encoded,{redirect:'manual'})).text();assert.ok(seen.includes(encoded));
 await(await fetch(base+'/api/ical/kr-ical-token.ics')).text();
 let aborted=false;try{await(await fetch(base+'/abort/kr-runtime-token?token=kr-query-token',{headers})).text()}catch{aborted=true}assert.ok(aborted,'runtime warning must be exercised');
 assert.ok(seen.includes('/r/kr-path-token?token=kr-query-token'),'logging must not rewrite upstream URI');
 await new Promise(r=>setTimeout(r,100));const logs=fs.readFileSync(path.join(dir,'caddy.log'),'utf8');assert.ok(logs.includes('aborting with incomplete response'));assert.ok(logs.includes('http.log.access'),'keep useful access records');
 for(const marker of markers)assert.equal(logs.includes(marker),false,'token found in Caddy logs');
 console.log('PASS raw path/query/iCal/referrer/redirect tokens absent from access and forced runtime logs; upstream path and Location preserved');
 }finally{if(child){try{process.kill(-child.pid,'SIGKILL')}catch{}}if(server)await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e.name,'private fixture log:',dir);process.exitCode=1});
