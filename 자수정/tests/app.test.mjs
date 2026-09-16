import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../backend/app.mjs';
import {review} from '../backend/review.mjs';
import {validate} from '../backend/validation.mjs';
import {readFile} from 'node:fs/promises';
import {services, findServices} from '../frontend/platform/catalog.js';
import {setupForm} from '../frontend/form.js';

const data={job:'상품 정보 관리와 고객 문의 정리 업무를 담당합니다.',essay:'카페에서 근무하며 마감 업무가 누락되는 것을 발견했습니다. 마감 체크리스트를 만들어 다음 근무자가 확인할 수 있도록 공유했습니다.',focus:'사실만 사용',consent:true};
const success=async()=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'확인 근거와 면접 질문'}]}],usage:{input_tokens:100,output_tokens:50}}));
async function withServer(options,run){const server=createApp(options);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;try{await run(base);}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
function post(base,path,input,origin=base){return fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(input)});}

test('real local routes: no-key state, request export, validation and consent',async()=>{
 await withServer({key:'',model:''},async base=>{
  const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/자수정/);
  for(const asset of ['/app.js','/style.css'])assert.equal((await fetch(base+asset)).status,200);
  assert.deepEqual(await (await fetch(base+'/api/status')).json(),{configured:false});
  assert.equal((await fetch(base+'/.env')).status,404);
  const exported=await post(base,'/api/prompt',data);assert.equal(exported.status,200);assert.match((await exported.json()).text,/경력, 수치/);
  assert.equal((await post(base,'/api/review',data)).status,503);
  assert.equal((await post(base,'/api/review',{...data,consent:false})).status,400);
  assert.equal((await post(base,'/api/prompt',{...data,essay:'짧음'})).status,400);
  assert.equal((await post(base,'/api/prompt',{...data,focus:4})).status,400);
  assert.equal((await post(base,'/api/prompt',data,'https://other.example')).status,403);
  assert.equal((await post(base,'/api/prompt',{...data,job:'가'.repeat(12001)})).status,400);
  assert.equal((await post(base,'/api/prompt',{...data,job:'가'.repeat(50000)})).status,413);
 });
});
test('HTTP review passes bounded request and extracts actual provider output (provider mocked)',async()=>{
 let calls=0;
 await withServer({key:'test-only',model:'test-model',fetcher:async(url,options)=>{
  calls++;assert.equal(url,'https://api.openai.com/v1/responses');const payload=JSON.parse(options.body);
  assert.equal(payload.store,false);assert.equal(payload.max_output_tokens,4000);assert.equal(payload.model,'test-model');assert.equal(JSON.parse(payload.input).essay,data.essay);
  return success();
 }},async base=>{const response=await post(base,'/api/review',data);assert.equal(response.status,200);assert.equal((await response.json()).text,'확인 근거와 면접 질문');assert.equal(calls,1);});
});
test('provider failures are not shown as finished reports (mocked)',async()=>{
 for(const [payload,status]of [[{},429],[{status:'incomplete',output:[]},200],[{status:'completed',output:[]},200],[{status:'completed',output:[{content:[{type:'refusal'}]}]},200]]) {
  await assert.rejects(()=>review(data,{key:'test',model:'test',fetcher:async()=>new Response(JSON.stringify(payload),{status})}));
 }
 assert.throws(()=>validate(null));assert.throws(()=>validate({...data,essay:' '.repeat(50)}));
});
test('duplicate in-flight requests are rejected without a second provider call',async()=>{
 let release;let started;const ready=new Promise(resolve=>started=resolve);
 await withServer({key:'test',model:'test',fetcher:()=>{started();return new Promise(resolve=>release=()=>resolve(success()));}},async base=>{
  const first=post(base,'/api/review',data);await ready;
  assert.equal((await post(base,'/api/review',data)).status,429);release();assert.equal((await first).status,200);
 });
});
test('all split frontend modules and their imports are served; backend stays private', async () => {
 await withServer({key:'',model:''}, async base => {
  const html = await (await fetch(base+'/workspace')).text();
  assert.match(html, /<script type="module" src="\/app.js">/);
  const font = await fetch(base + '/fonts/PretendardVariable.woff2');
  assert.equal(font.status, 200);
  assert.equal(font.headers.get('content-type'), 'font/woff2');
  assert.equal(Buffer.from(await font.arrayBuffer()).subarray(0, 4).toString(), 'wOF2');
  const visited = new Set();
  for (const [path,type] of [['/brand/symbol.svg','image/svg+xml'],['/brand/brand.css','text/css; charset=utf-8']]) {
   const asset=await fetch(base+path);
   assert.equal(asset.status,200);
   assert.equal(asset.headers.get('content-type'),type);
   assert.equal(await asset.text(),await readFile(new URL('../frontend'+path,import.meta.url),'utf8'));
  }
  async function visit(path) {
   if (visited.has(path)) return;
   visited.add(path);
   const response = await fetch(base + path);
   assert.equal(response.status, 200, path);
   assert.match(response.headers.get('content-type'), /javascript/);
   const source = await response.text();
   assert.equal(source, await readFile(new URL('../frontend' + path, import.meta.url), 'utf8'));
   for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    await visit(new URL(match[1], base + path).pathname);
   }
  }
  await visit('/app.js');
  assert.equal(visited.size, 8);
  for (const path of ['/backend/review.mjs', '/backend/prompt.mjs', '/.env', '/package.json']) {
   assert.equal((await fetch(base + path)).status, 404);
  }
 });
});

test('platform pages support direct links and queries without exposing arbitrary files', async () => {
 await withServer({key:'',model:''}, async base => {
  for(const route of ['/', '/services?q=면접', '/guide', '/login', ...services.map(s=>`/services/${s.id}`)]) {
   const response=await fetch(base+route);assert.equal(response.status,200,route);
   assert.match(await response.text(), /src="\/platform\/platform.js"/);
  }
  for(const route of ['/workspace?service=interview','/platform/platform.js','/platform/catalog.js','/platform/platform.css']) assert.equal((await fetch(base+route)).status,200,route);
  for(const route of ['/services/missing','/platform/../../.env','/constructor','/toString','/platform/page.html']) assert.equal((await fetch(base+route)).status,404,route);
 });
});
test('service filters combine keywords and categories and handle no matches', () => {
 assert.equal(findServices().length,4);
 assert.deepEqual(findServices('면접','면접').map(s=>s.id),['interview']);
 assert.equal(findServices('  경험   자소서  ','자소서')[0].id,'resume');
 assert.equal(findServices('존재하지않는서비스').length,0);
 assert.equal(findServices('<script>alert(1)</script>').length,0);
 assert.equal(findServices('','없는분야').length,0);
 assert.equal(new Set(services.map(s=>s.id)).size,services.length);
});

test('sample form keeps selected focus and does not overwrite edited input when cancelled', () => {
 const savedDocument=globalThis.document, savedConfirm=globalThis.confirm;
 const elements=Object.fromEntries(['job','essay','focus','form','sample','consent','count'].map(id=>[id,{value:'',checked:true,listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},dispatchEvent(event){this.listeners[event.type]?.();}}]));
 let confirmations=0;
 globalThis.document={getElementById:id=>elements[id]};
 globalThis.confirm=()=>{confirmations++;return false;};
 try {
  elements.focus.value=services[2].focus;
  setupForm(services[2].focus);
  elements.sample.listeners.click();
  assert.equal(confirmations,0);
  assert.equal(elements.focus.value,services[2].focus);
  assert.ok(elements.essay.value.length>=50);
  assert.equal(elements.consent.checked,false);
  elements.essay.value='본인의 수정 내용';
  elements.sample.listeners.click();
  assert.equal(confirmations,1);
  assert.equal(elements.essay.value,'본인의 수정 내용');
 } finally {
  if(savedDocument===undefined)delete globalThis.document;else globalThis.document=savedDocument;
  if(savedConfirm===undefined)delete globalThis.confirm;else globalThis.confirm=savedConfirm;
 }
});
