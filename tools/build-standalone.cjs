'use strict';
const fs=require('node:fs'),path=require('node:path');
function build(input) {
  input=fs.realpathSync(input);const root=path.dirname(input),files=[],seen=new Set();
  const html=fs.readFileSync(input,'utf8').replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi,(tag,attrs,body)=>{
    const a=attrs.match(/(?:^|\s)src\s*=\s*(["'])(.*?)\1/i);if(!a){if(/(?:^|\s)src\s*=/i.test(attrs))throw Error('Script src must be quoted');return tag;}
    if(/(?:^|\s)(?:async|defer)(?:\s|=|$)/i.test(attrs)||/\btype\s*=\s*(["'])module\1/i.test(attrs))throw Error('Only ordered classic scripts can be bundled');
    const src=a[2];if(/^(?:[a-z][\w+.-]*:|\/|#)/i.test(src))throw Error('Only relative local scripts can be bundled');
    const rel=decodeURIComponent(src.split(/[?#]/)[0]);if(!/\.js$/i.test(rel))throw Error('Script must be a JavaScript file');
    const file=fs.realpathSync(path.resolve(root,rel));if(!file.startsWith(root+path.sep))throw Error('Script escapes the input directory');
    if(seen.has(file))throw Error('Duplicate script: '+rel);seen.add(file);files.push(file);
    const rest=attrs.replace(a[0],'').trim(),label=path.relative(root,file).replace(/\*\//g,'* /');
    const code=fs.readFileSync(file,'utf8').replace(/<\/script/gi,m=>'<\\/'+m.slice(2));
    return '<script'+(rest?' '+rest:'')+'>\n/* source: '+label+' */\n'+code+'\n</script>';
  });
  if(!files.length)throw Error('No external scripts found');
  return {html,files,input};
}
function main(args){
  const opts={};for(let i=0;i<args.length;i+=2){if(!['--input','--output'].includes(args[i])||!args[i+1])throw Error('Usage: --input index.html --output explicit-test-path.html');opts[args[i]]=args[i+1];}
  if(!opts['--input']||!opts['--output'])throw Error('Both input and output are required');
  const result=build(opts['--input']),output=path.resolve(opts['--output']),realOut=fs.existsSync(output)?fs.realpathSync(output):output;
  if(realOut===result.input||result.files.includes(realOut))throw Error('Output would overwrite a source file');
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,result.html);
  return {scripts:result.files.length,bytes:Buffer.byteLength(result.html),output};
}
if(require.main===module){try{console.log(JSON.stringify(main(process.argv.slice(2))))}catch(e){console.error(e.message);process.exitCode=1}}
module.exports={build,main};
