/** Real direct-Next HTTP validation; deliberately bypass Caddy's independent cap. */
const assert=require('node:assert/strict'),http=require('node:http');
const BASE=process.env.DIRECT_BASE_URL||process.env.BASE_URL||'http://localhost:3000',LIMIT=1048576;
function payload(n){const empty=JSON.stringify({token:'fixture-token-not-valid',password:'fixture-only-password',padding:''});return Buffer.from(JSON.stringify({token:'fixture-token-not-valid',password:'fixture-only-password',padding:'x'.repeat(n-Buffer.byteLength(empty))}))}
function post(bytes,chunked){return new Promise((resolve,reject)=>{const data=payload(bytes),req=http.request(BASE+'/api/auth/set-password',{method:'POST',headers:{'content-type':'application/json',...(chunked?{'transfer-encoding':'chunked'}:{'content-length':String(data.length)})}},r=>{let body='';r.on('data',x=>body+=x);r.on('end',()=>resolve({status:r.statusCode,body}))});req.on('error',reject);if(chunked){for(let i=0;i<data.length;i+=16384)req.write(data.subarray(i,i+16384));req.end()}else req.end(data)})}
(async()=>{
 for(const chunked of [false,true]){const r=await post(LIMIT+1,chunked);assert.equal(r.status,413);assert.equal(JSON.parse(r.body).error.code,'payload_too_large')}
 const exact=await post(LIMIT,false);assert.equal(exact.status,400);assert.equal(JSON.parse(exact.body).error.code,'invalid_token');
 const small=await post(256,false);assert.equal(small.status,400);assert.equal(JSON.parse(small.body).error.code,'invalid_token');
 for(const value of ['Bearer %%%','Bearer %E0%A4%A','Bearer invalid']){const r=await fetch(BASE+'/panel',{redirect:'manual',headers:{authorization:value}});assert.equal(r.status,307);assert.equal(new URL(r.headers.get('location')).pathname,'/giris')}
 console.log('PASS direct Next declared/chunked oversized JSON413, exact/small parser behavior, malformed anonymous Bearer fails closed');
})().catch(e=>{console.error(e.name,'local HTTP input check failed');process.exitCode=1});
