import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../backend/app.mjs';
import {createPrivateStore} from '../backend/private.mjs';
import {verificationMailer} from '../backend/email.mjs';
async function fixture(run){const dir=await mkdtemp(join(tmpdir(),'jasu-private-')),messages=[];const options={key:'',model:'',accountFile:join(dir,'private.json'),boardFile:join(dir,'posts.json'),sendVerification:async(email,token)=>{messages.push({email,token});}};try{await run(options,messages);}finally{await rm(dir,{recursive:true,force:true});}}
async function server(options,run){const app=createApp(options);await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${app.address().port}`;
 const call=async(path,input,cookie='',origin=base)=>{const res=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:res.status,data:res.headers.get('content-type')?.startsWith('application/json')?await res.json():await res.text(),cookie:res.headers.get('set-cookie')};};
 try{await run(call);}finally{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}}
const customer={email:'customer@example.test',name:'고객',password:'test-only-password'};
const request={title:'경험 전달력 검토',essay:'카페에서 마감 체크리스트를 작성하고 동료에게 공유한 경험입니다.',note:'경험이 명확히 전달되는지 확인해 주세요.',consent:true};
const login=async(call,user=customer)=>{const result=await call('/api/auth/login',user);assert.equal(result.status,200);return result.cookie.split(';')[0];};

test('account deletion removes only the customer and their private and board data',async()=>fixture(async options=>{
 const other={email:'keep@example.test',name:'남을 고객',password:'keep-test-password'};
 const store=createPrivateStore(options.accountFile);await store.register(customer);await store.register(other);
 await server(options,async call=>{
  const owner=await login(call),remaining=await login(call,other);
  const own=(await call('/api/posts',{category:'질문',title:'삭제할 질문',body:'제 경험을 질문합니다.'},owner)).data.post;
  const kept=(await call('/api/posts',{category:'정보',title:'남을 글',body:'다른 고객의 글입니다.'},remaining)).data.post;
  assert.equal((await call('/api/posts/action',{id:kept.id,action:'comment',body:'삭제할 댓글'},owner)).status,200);
  assert.equal((await call('/api/posts/action',{id:kept.id,action:'report',reason:'삭제할 신고'},owner)).status,200);
  assert.equal((await call('/api/drafts',{action:'save',title:'삭제할 초안',essay:'고객이 작성한 초안입니다.'},owner)).status,200);
  assert.equal((await call('/api/requests',request,owner)).status,201);
  assert.equal((await call('/api/account/delete',{password:'wrong-password'},owner)).status,403);
  assert.equal((await call('/api/account/delete',{password:customer.password},owner,'https://wrong.example')).status,403);
  assert.equal((await call('/api/posts',undefined,owner)).data.posts.length,2);
  const deleted=await call('/api/account/delete',{password:customer.password},owner);assert.equal(deleted.status,200);assert.match(deleted.cookie,/Max-Age=0/);
  assert.equal((await call('/api/requests',undefined,owner)).status,401);
  assert.equal((await call('/api/auth/login',customer)).status,401);
  const posts=(await call('/api/posts',undefined,remaining)).data.posts;assert.deepEqual(posts.map(post=>post.id),[kept.id]);assert.equal(posts[0].comments.length,0);
  const board=JSON.parse(await readFile(options.boardFile,'utf8'));assert.equal(board[0].reports.length,0);assert.ok(!board.some(post=>post.id===own.id));
  const db=JSON.parse(await readFile(options.accountFile,'utf8'));assert.deepEqual(db.users.map(user=>user.email),[other.email]);assert.equal(db.requests.length,0);assert.equal((db.drafts||[]).length,0);assert.equal((db.notifications||[]).length,0);
 });
}));

test('auth: role injection, credentials, verification, CSRF, logout and static access restrictions',async()=>fixture(async (options,messages)=>{
 await server(options,async call=>{
  for(const route of ['/signup','/login','/request','/my','/operator','/platform/private.js','/platform/private.css'])assert.equal((await call(route)).status,200,route);
  assert.equal((await call('/api/requests')).status,401);
  assert.equal((await call('/api/requests',request)).status,401);
  assert.equal((await call('/api/legacy-requests')).status,403);
  assert.equal((await call('/api/auth/config')).data.signupAvailable,true);
  assert.equal((await call('/api/auth/register',{...customer,passwordConfirm:'different'})).status,400);
  const registered=await call('/api/auth/register',{...customer,passwordConfirm:customer.password,role:'operator'});assert.equal(registered.status,201);assert.equal(registered.data.user.role,'customer');assert.equal(registered.data.user.passwordHash,undefined);
  assert.equal((await call('/api/auth/register',{...customer,passwordConfirm:customer.password})).status,409);
  assert.equal((await call('/api/auth/login',{...customer,password:'wrong-password'})).status,401);
  assert.equal((await call('/api/auth/login',customer,'','https://wrong.example')).status,403);
  assert.equal((await call('/api/auth/login',customer)).status,403);
  assert.equal((await call('/api/auth/verify',{token:'x'.repeat(64)})).status,400);
  assert.equal((await call('/api/auth/verify',{token:messages[0].token})).status,200);
  assert.equal((await call('/api/auth/verify',{token:messages[0].token})).status,400);
  const signed=await call('/api/auth/login',customer);assert.match(signed.cookie,/HttpOnly/);assert.match(signed.cookie,/SameSite=Strict/);const cookie=signed.cookie.split(';')[0];
  assert.equal((await call('/api/auth/me',undefined,cookie)).data.user.role,'customer');
  assert.equal((await call('/api/legacy-requests',undefined,cookie)).status,403);
  for(const path of ['/data/private.json','/data/posts.json','/backend/private.mjs'])assert.equal((await call(path)).status,404);
  for(const path of ['/api/auth/logout','/api/requests','/api/requests/update','/api/requests/reply'])assert.equal((await call(path,request,cookie,'https://wrong.example')).status,403);
  assert.equal((await call('/api/auth/logout',{},cookie)).status,200);assert.equal((await call('/api/auth/me',undefined,cookie)).data.user,null);
  const persisted=await readFile(options.accountFile,'utf8');assert.ok(!persisted.includes(customer.password));assert.ok(JSON.parse(persisted).users[0].passwordHash.length===128);
 });
}));

test('private workflow: isolation, draft privacy, supplemental answers, final report, conflicts and restart',async()=>fixture(async options=>{
 const admin={email:'operator@example.test',name:'운영자',password:'operator-test-password'};
 const other={email:'other@example.test',name:'다른 고객',password:'other-test-password'};
 const store=createPrivateStore(options.accountFile);await store.register(admin,'operator');await store.register(customer);await store.register(other);
 let id,expiredCookie;
 await server(options,async call=>{
  const a=await login(call),b=await login(call,other),op=await login(call,admin);expiredCookie=a;
  assert.equal((await call('/api/requests',{...request,consent:false},a)).status,400);
  const saved=await call('/api/requests',{...request,ownerId:'fake',status:'completed'},a);assert.equal(saved.status,201);id=saved.data.request.id;assert.equal(saved.data.request.status,'submitted');assert.notEqual(saved.data.request.ownerId,'fake');assert.equal(saved.data.request.draft,undefined);
  assert.equal((await call('/api/requests',undefined,b)).data.requests.length,0);
  assert.equal((await call('/api/requests?id='+id,undefined,b)).status,404);
  assert.equal((await call('/api/requests/update',{id,version:0,status:'reviewing'},b)).status,404);
  assert.equal((await call('/api/requests/update',{id,version:0,status:'reviewing'},a)).status,403);
  assert.equal((await call('/api/requests',undefined,op)).data.requests.length,1);
  const draft={id,version:0,status:'reviewing',revision:'운영자만 볼 수 있는 미완성 수정본',reason:'',next:''};assert.equal((await call('/api/requests/update',draft,op)).status,200);
  const visible=(await call('/api/requests?id='+id,undefined,a)).data.request;assert.equal(visible.draft,undefined);assert.equal(visible.final,undefined);assert.equal(visible.status,'reviewing');
  assert.equal((await call('/api/requests/update',draft,op)).status,409);
  assert.equal((await call('/api/requests/update',{id,version:1,status:'needs_info',message:'체크리스트를 적용한 후 어떤 변화가 있었나요?'},op)).status,200);
  assert.equal((await call('/api/requests/reply',{id,version:2,message:'다른 사용자 답변'},b)).status,404);
  const reply=await call('/api/requests/reply',{id,version:2,message:'다음 근무자가 확인할 수 있게 인수인계했습니다.'},a);assert.equal(reply.status,200);assert.equal(reply.data.request.status,'submitted');assert.equal(reply.data.request.messages.length,2);
  assert.equal((await call('/api/requests/update',{id,version:3,status:'completed',checked:true},op)).status,400);
  const final={id,version:3,status:'completed',revision:'카페 마감 담당자로서 체크리스트를 작성하고 다음 근무자에게 전달했습니다.',reason:'구체적인 역할과 행동을 드러내도록 수정했습니다. 근거 없는 성과는 추가하지 않았습니다.',next:'실제 확인한 변화가 있다면 구체적인 사례로 추가해 주세요. 수치는 확인된 경우에만 사용하세요.'};
  assert.equal((await call('/api/requests/update',final,op)).status,400);
  assert.equal((await call('/api/requests/update',{...final,checked:true},op)).status,200);
  const result=(await call('/api/requests?id='+id,undefined,a)).data.request;assert.equal(result.final.revision,final.revision);assert.equal(result.final.reviewer,'운영자');assert.equal(result.draft,undefined);
  assert.equal((await call('/api/requests/update',{...final,version:4,checked:true},op)).status,409);
 });
 await server(options,async call=>{assert.equal((await call('/api/requests',undefined,expiredCookie)).status,401);const cookie=await login(call);assert.equal((await call('/api/requests?id='+id,undefined,cookie)).data.request.status,'completed');});
}));

test('legacy public review data stays on disk and is only served to an operator',async()=>fixture(async options=>{
 const posts=[{id:'legacy',title:'예전 요청',category:'추가 첨삭 요청',author:'닉네임',body:'요청사항',essay:'비공개 원문',aiReport:'비공개 결과'},{id:'public',title:'질문',category:'질문',author:'고객',body:'공개 질문',essay:'유출되면 안 됨'}];await writeFile(options.boardFile,JSON.stringify(posts));
 const admin={...customer,email:'admin@example.test'};await createPrivateStore(options.accountFile).register(admin,'operator');
 await server(options,async call=>{const result=await call('/api/posts');assert.equal(result.data.posts.length,1);assert.equal(result.data.posts[0].essay,undefined);assert.equal((await call('/api/legacy-requests')).status,403);const op=await login(call,admin);assert.equal((await call('/api/legacy-requests',undefined,op)).data.posts[0].essay,'비공개 원문');assert.equal((await call('/api/posts',{...posts[0],publicConsent:true},op)).status,400);assert.equal((await call('/api/posts',{title:'새로운 공개 글',author:'고객',body:'일반적인 취업 질문입니다.',category:'질문'})).status,401);});
 const saved=JSON.parse(await readFile(options.boardFile,'utf8'));assert.deepEqual(saved.find(p=>p.id==='legacy'),posts[0]);
}));

test('simultaneous signup preserves unique accounts; repeated auth attempts are limited',async()=>fixture(async (options,messages)=>{
 await server(options,async call=>{const signup={...customer,passwordConfirm:customer.password};const results=await Promise.all([call('/api/auth/register',signup),call('/api/auth/register',signup)]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal(messages.length,1);assert.equal((await call('/api/auth/verify',{token:messages[0].token})).status,200);for(let i=0;i<12;i++)assert.equal((await call('/api/auth/login',{...customer,password:'wrong-password'})).status,401);assert.equal((await call('/api/auth/login',customer)).status,429);});
 assert.equal(JSON.parse(await readFile(options.accountFile,'utf8')).users.length,1);
}));
test('signup stays closed without mail; expired links can be resent',async()=>fixture(async (options,messages)=>{
 await server({...options,sendVerification:null},async call=>{
  assert.equal((await call('/api/auth/config')).data.signupAvailable,false);
  assert.equal((await call('/api/auth/register',{...customer,passwordConfirm:customer.password})).status,503);
 });
 await server(options,async call=>{assert.equal((await call('/api/auth/register',{...customer,passwordConfirm:customer.password})).status,201);});
 const db=JSON.parse(await readFile(options.accountFile,'utf8'));db.users[0].verificationExpires=Date.now()-1;db.users[0].verificationSentAt=Date.now()-60001;await writeFile(options.accountFile,JSON.stringify(db));
 await server(options,async call=>{
  assert.equal((await call('/api/auth/verify',{token:messages[0].token})).status,400);
  assert.equal((await call('/api/auth/resend',{email:customer.email})).status,200);
  assert.equal(messages.length,2);
  assert.equal((await call('/api/auth/verify',{token:messages[1].token})).status,200);
  assert.equal((await call('/api/auth/login',customer)).status,200);
 });
}));
test('verification mail uses configured sender and a single-use link',async()=>{
 let sent;
 const mail=verificationMailer({apiKey:'test-key',from:'자수정 <hello@example.test>',baseUrl:'https://example.test',fetcher:async(url,options)=>{sent={url,options};return new Response('{}',{status:200});}});
 await mail('customer@example.test','a'.repeat(64));
 assert.equal(sent.url,'https://api.resend.com/emails');assert.equal(sent.options.headers.Authorization,'Bearer test-key');
 const body=JSON.parse(sent.options.body);assert.deepEqual(body.to,['customer@example.test']);assert.match(body.text,/https:\/\/example\.test\/verify\?token=/);
});
test('draft, interview, recheck and notifications stay private across restart',async()=>fixture(async options=>{
 const admin={email:'operator-extra@example.test',name:'운영자',password:'operator-test-password'};
 const store=createPrivateStore(options.accountFile);await store.register(admin,'operator');await store.register(customer);
 let id;
 await server(options,async call=>{
  const user=await login(call),op=await login(call,admin);
  const draft=await call('/api/drafts',{action:'save',title:'지원 준비',company:'예시 회사',role:'기획',deadline:'2026-10-15',essay:'작성 중인 내용'},user);
  assert.equal(draft.status,200);assert.equal((await call('/api/drafts',undefined,op)).data.drafts.length,0);
  const created=await call('/api/requests',{...request,consent:true,company:'예시 회사',role:'기획',deadline:'2026-10-15',service:'interview'},user);
  assert.equal(created.status,201);id=created.data.request.id;
  assert.equal((await call('/api/requests/interview',{id,version:0,action:'question',text:'이 경험에서 본인 역할은 무엇인가요?'},user)).status,409);
  assert.equal((await call('/api/requests/interview',{id,version:0,action:'question',text:'이 경험에서 본인 역할은 무엇인가요?'},op)).status,200);
  assert.equal((await call('/api/requests/interview',{id,version:1,action:'answer',text:'마감 항목을 정리하고 동료에게 공유했습니다.'},user)).status,200);
  assert.equal((await call('/api/requests/interview',{id,version:2,action:'followup',text:'왜 그 방법을 선택했나요?'},op)).status,200);
  assert.equal((await call('/api/requests/interview',{id,version:3,action:'followup_answer',text:'누락을 줄일 수 있는 방법이었기 때문입니다.'},user)).status,200);
  assert.equal((await call('/api/requests/interview',{id,version:4,action:'feedback',text:'역할은 분명합니다. 결과를 수치 없이 구체화해 보세요.'},op)).status,200);
  assert.ok((await call('/api/notifications',undefined,user)).data.notifications.length);
  assert.equal((await call('/api/requests?id='+id,undefined,op)).data.request.interview.turns.length,1);
 });
 await server(options,async call=>{
  const user=await login(call),op=await login(call,admin);
  const r=(await call('/api/requests?id='+id,undefined,user)).data.request;
  assert.equal(r.interview.feedback,'역할은 분명합니다. 결과를 수치 없이 구체화해 보세요.');
  assert.equal(r.company,'예시 회사');assert.equal(r.deadline,'2026-10-15');
  const final={id,version:r.version,status:'completed',revision:'카페 근무 중 마감 항목을 정리해 체크리스트로 만들고 다음 근무자에게 공유했습니다.',reason:'추상적인 성격 표현보다 실제 맡은 행동과 협업 내용을 보여 주기 위한 수정입니다.',next:'체크리스트를 적용한 뒤 실제로 어떤 변화가 있었는지 본인 경험으로 확인해 주세요.',checked:true};
  assert.equal((await call('/api/requests/update',final,op)).status,200);
  assert.equal((await call('/api/requests/recheck',{id,version:r.version+1,message:'협업 경험 부분을 다시 확인해 주세요.'},user)).status,200);
  assert.equal((await call('/api/requests/recheck',{id,version:r.version+2,message:'다시 요청'},user)).status,403);
  assert.equal((await call('/api/requests?id='+id,undefined,user)).data.request.status,'recheck_requested');
 });
}));
test('board owner controls, comments, reports and operator moderation',async()=>fixture(async options=>{
 const other={email:'other-board@example.test',name:'다른 고객',password:'other-test-password'};
 const admin={email:'board-admin@example.test',name:'운영자',password:'operator-test-password'};
 const store=createPrivateStore(options.accountFile);await store.register(customer);await store.register(other);await store.register(admin,'operator');
 await server(options,async call=>{
  const owner=await login(call),visitor=await login(call,other),op=await login(call,admin);
  const created=await call('/api/posts',{category:'질문',title:'지원 질문',author:'고객',body:'면접 준비 질문입니다.'},owner);
  assert.equal(created.status,201);const id=created.data.post.id;
  assert.equal((await call('/api/posts/action',{id,action:'edit',title:'변경',body:'남의 글 변경'},visitor)).status,403);
  assert.equal((await call('/api/posts/action',{id,action:'edit',title:'지원 질문 수정',body:'수정된 내용입니다.'},owner)).status,200);
  const commented=await call('/api/posts/action',{id,action:'comment',body:'제가 준비한 답변을 공유합니다.'},visitor);assert.equal(commented.status,200);
  const commentId=commented.data.comment.id;
  assert.equal((await call('/api/posts/action',{id,action:'comment_delete',commentId},owner)).status,403);
  assert.equal((await call('/api/posts/action',{id,action:'report',reason:'개인정보 노출 의심'},visitor)).status,200);
  assert.equal((await call('/api/posts/action',{id,action:'moderate',hidden:true,pinned:true},owner)).status,403);
  assert.equal((await call('/api/posts/action',{id,action:'moderate',hidden:true,pinned:true},op)).status,200);
  assert.equal((await call('/api/posts',undefined,visitor)).data.posts.length,0);
  assert.equal((await call('/api/posts',undefined,op)).data.posts[0].reportCount,1);
  assert.equal((await call('/api/posts/action',{id,action:'delete'},owner)).status,200);
 });
}));
