/** Owned loopback-only upstream: deterministically abort a response for log redaction tests. */
require('node:http').createServer((req,res)=>{
 if(req.url==='/api/health'){res.end('ok');return}
 res.writeHead(200,{'content-type':'text/plain','content-length':'1000'});res.write('fixture');
 setTimeout(()=>res.destroy(),50);
}).listen(3412,'127.0.0.1');
