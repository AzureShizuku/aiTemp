import {readFile,writeFile,mkdir,readdir,rm} from 'node:fs/promises';
import {join,relative} from 'node:path';
const root=new URL('../',import.meta.url).pathname;
const entries=[];
async function scan(path){for(const e of await readdir(path,{withFileTypes:true})){const p=join(path,e.name);if(e.isDirectory())await scan(p);else entries.push(['/'+relative(join(root,'web'),p),await readFile(p,'utf8')]);}}
await scan(join(root,'web'));
const backend=(await readFile(join(root,'server/recognize.mjs'),'utf8')).replace(/^export default handleRecognize;\s*$/m,'').replace(/^export /gm,'');
const source=backend+'\nconst STATIC_ASSETS='+JSON.stringify(Object.fromEntries(entries))+';\n'+`
const MIME={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'application/javascript; charset=utf-8',mjs:'application/javascript; charset=utf-8',svg:'image/svg+xml',txt:'text/plain; charset=utf-8'};
export default {
 async fetch(request, env, ctx) {
  const url=new URL(request.url);
  if(url.pathname==='/api/recognize'){
   const origin=request.headers.get('Origin');
   if(request.method==='POST'&&origin&&origin!==url.origin)return new Response(JSON.stringify({error:{code:'INVALID_ORIGIN',message:'请在应用内重新上传报价。'}}),{status:403,headers:{'Content-Type':'application/json'}});
   return handleRecognize(request,env);
  }
  const path=url.pathname==='/'?'/index.html':url.pathname;
  if(!Object.hasOwn(STATIC_ASSETS,path))return new Response('Not found',{status:404});
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
  const ext=path.split('.').pop();
  return new Response(request.method==='HEAD'?null:STATIC_ASSETS[path],{headers:{'Content-Type':MIME[ext]||'text/plain','Cache-Control':path.startsWith('/vendor/')?'public, max-age=86400':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
 }
};
`;
await mkdir(join(root,'worker'),{recursive:true});
await writeFile(join(root,'worker/index.js'),source);
await rm(join(root,'dist'),{recursive:true,force:true});
await mkdir(join(root,'dist/server'),{recursive:true});
await mkdir(join(root,'dist/.openai'),{recursive:true});
await writeFile(join(root,'dist/server/index.js'),source);
await writeFile(join(root,'dist/.openai/hosting.json'),await readFile(join(root,'.openai/hosting.json')));
console.log(`Built server-enabled mobile H5 (${entries.length} assets, ${source.length} characters)`);
