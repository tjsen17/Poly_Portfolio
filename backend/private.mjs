import {readFile,mkdir,writeFile,rename,unlink} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID,scrypt as derive,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(derive);
export const privateFile=fileURLToPath(new URL('../data/private.json',import.meta.url));
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const field=(value,min,max,label)=>{if(typeof value!=='string'||value.trim().length<min||value.length>max)fail(`${label}: ${min}~${max}자로 입력해 주세요.`);return value.trim();};
const publicUser=u=>({id:u.id,email:u.email,name:u.name,role:u.role});
const hash=password=>createHash('sha256').update(password).digest('hex');
const cookie=(value,age)=>`jasu_sid=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}`;
const optional=(value,max,label)=>field(value||'',0,max,label);
const day=value=>{if(!value)return '';if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value+'T00:00:00')))fail('날짜는 YYYY-MM-DD 형식으로 입력해 주세요.');return value;};
const notify=(db,userId,requestId,text)=>{db.notifications??=[];db.notifications.push({id:randomUUID(),userId,requestId,text,at:new Date().toISOString(),read:false});};
export function createPrivateStore(file=privateFile,sendVerification=null){
 let pending=Promise.resolve();const sessions=new Map(),attempts=new Map();
 async function load(){try{const db=JSON.parse(await readFile(file,'utf8'));if(db.version!==1||!Array.isArray(db.users)||!Array.isArray(db.requests))throw new Error('Invalid private store');return db;}catch(e){if(e.code==='ENOENT')return {version:1,users:[],requests:[]};throw e;}}
 function change(fn){const task=pending.then(async()=>{const db=await load(),result=await fn(db),tmp=file+'.'+randomUUID()+'.tmp';await mkdir(dirname(file),{recursive:true});try{await writeFile(tmp,JSON.stringify(db),'utf8');await rename(tmp,file);}catch(e){await unlink(tmp).catch(()=>{});throw e;}return result;});pending=task.catch(()=>{});return task;}
 async function register(input,role='customer',requireVerification=false){
  const email=field(input?.email,3,254,'이메일').toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('이메일 형식을 확인해 주세요.');
  const password=input?.password;if(typeof password!=='string'||password.length<10||password.length>128)fail('비밀번호는 10~128자로 입력해 주세요.');
  if(requireVerification&&input.passwordConfirm!==password)fail('비밀번호 확인이 일치하지 않습니다.');
  if(requireVerification&&!sendVerification)fail('이메일 발송 설정 전에는 회원가입할 수 없습니다.',503);
  const name=field(input?.name,1,30,'이름');const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  return change(async db=>{
   if(db.users.some(u=>u.email===email))fail('이미 등록된 이메일입니다.',409);
   const token=requireVerification?randomBytes(32).toString('hex'):null;
   if(token)try{await sendVerification(email,token);}catch{fail('인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.',502);}
   const user={id:randomUUID(),email,name,role,salt,passwordHash:key.toString('hex'),verifiedAt:token?null:new Date().toISOString()};
   if(token){user.verificationHash=hash(token);user.verificationExpires=Date.now()+24*3600000;user.verificationSentAt=Date.now();}
   db.users.push(user);return publicUser(user);
  });
 }
 async function verify(token){
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))fail('인증 링크가 올바르지 않습니다.');
  return change(db=>{const user=db.users.find(u=>u.verificationHash===hash(token)&&u.verifiedAt===null);if(!user||user.verificationExpires<Date.now())fail('인증 링크가 만료되었거나 유효하지 않습니다.');user.verifiedAt=new Date().toISOString();delete user.verificationHash;delete user.verificationExpires;delete user.verificationSentAt;return {ok:true};});
 }
 async function resend(email){
  email=field(email,3,254,'이메일').toLowerCase();if(!sendVerification)fail('이메일 발송 설정 전에는 인증 메일을 보낼 수 없습니다.',503);
  return change(async db=>{const user=db.users.find(u=>u.email===email&&u.verifiedAt===null);if(!user||Date.now()-(user.verificationSentAt||0)<60000)return {ok:true};const token=randomBytes(32).toString('hex');try{await sendVerification(email,token);}catch{fail('인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.',502);}user.verificationHash=hash(token);user.verificationExpires=Date.now()+24*3600000;user.verificationSentAt=Date.now();return {ok:true};});
 }
 async function current(req){const sid=(req.headers.cookie||'').match(/(?:^|;\s*)jasu_sid=([a-f0-9]{64})(?:;|$)/)?.[1];if(!sid)return null;const session=sessions.get(hash(sid));if(!session)return null;if(session.expires<Date.now()){sessions.delete(hash(sid));return null;}return (await load()).users.find(u=>u.id===session.userId)||null;}
 function dto(r,user){const {draft,...result}=r;return user.role==='operator'?r:result;}
 return {register,current,async deleteAccount(req,password,removeBoard){
  const user=await current(req);if(!user)fail('로그인 후 이용해 주세요.',401);
  if(user.role==='operator')fail('운영자 계정은 이 화면에서 삭제할 수 없습니다.',403);
  if(typeof password!=='string'||password.length>128)fail('비밀번호를 확인해 주세요.',400);
  const derived=await scrypt(password,user.salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  if(!timingSafeEqual(derived,Buffer.from(user.passwordHash,'hex')))fail('비밀번호가 일치하지 않습니다.',403);
  await change(async db=>{
   if(!db.users.some(item=>item.id===user.id))fail('계정을 찾을 수 없습니다.',404);
   await removeBoard(user.id);
   const requestIds=new Set(db.requests.filter(item=>item.ownerId===user.id).map(item=>item.id));
   db.users=db.users.filter(item=>item.id!==user.id);
   db.requests=db.requests.filter(item=>item.ownerId!==user.id);
   db.drafts=(db.drafts||[]).filter(item=>item.ownerId!==user.id);
   db.notifications=(db.notifications||[]).filter(item=>item.userId!==user.id&&!requestIds.has(item.requestId));
  });
  for(const [id,session] of sessions)if(session.userId===user.id)sessions.delete(id);
  return {headers:{'Set-Cookie':cookie('',0)},body:{ok:true}};
 },async handle(path,req,input={}){
  if(['/api/auth/register','/api/auth/login','/api/auth/verify','/api/auth/resend'].includes(path)){
   if(!input||typeof input!=='object'||Array.isArray(input))fail('입력 형식을 확인해 주세요.');
   const ip=req.socket.remoteAddress,now=Date.now();for(const [key,value]of attempts)if(value.until<now)attempts.delete(key);
   const limit=attempts.get(ip)||{count:0,until:now+60000};if(++limit.count>15)fail('로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.',429);attempts.set(ip,limit);
   if(path==='/api/auth/register')return {status:201,body:{user:await register(input,'customer',true)}};
   if(path==='/api/auth/verify')return {body:await verify(input.token)};
   if(path==='/api/auth/resend')return {body:await resend(input.email)};
   const email=field(input.email,3,254,'이메일').toLowerCase();if(typeof input.password!=='string'||input.password.length>128)fail('이메일 또는 비밀번호가 올바르지 않습니다.',401);
   const user=(await load()).users.find(u=>u.email===email),derived=await scrypt(input.password,user?.salt||'unknown-user',64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
   if(!user||!timingSafeEqual(derived,Buffer.from(user.passwordHash,'hex')))fail('이메일 또는 비밀번호가 올바르지 않습니다.',401);
   if(user.verifiedAt===null)fail('이메일 인증을 완료한 뒤 로그인해 주세요.',403);
   for(const [key,value]of sessions)if(value.expires<now)sessions.delete(key);
   if(sessions.size>=1000)fail('접속 세션이 많습니다. 잠시 후 다시 시도해 주세요.',429);
   const old=(req.headers.cookie||'').match(/jasu_sid=([a-f0-9]{64})/)?.[1];if(old)sessions.delete(hash(old));
   const sid=randomBytes(32).toString('hex');sessions.set(hash(sid),{userId:user.id,expires:now+8*3600000});
   return {headers:{'Set-Cookie':cookie(sid,8*3600)},body:{user:publicUser(user)}};
  }
  if(path==='/api/auth/logout'){const sid=(req.headers.cookie||'').match(/jasu_sid=([a-f0-9]{64})/)?.[1];if(sid)sessions.delete(hash(sid));return {headers:{'Set-Cookie':cookie('',0)},body:{ok:true}};}
  const user=await current(req);
  if(path==='/api/auth/config')return {body:{signupAvailable:!!sendVerification}};
  if(path==='/api/auth/me')return {body:{user:user?publicUser(user):null}};
  if(!user)fail('로그인 후 이용해 주세요.',401);
  const url=new URL(req.url,'http://local');
  if(req.method==='GET'&&path==='/api/notifications')return {body:{notifications:((await load()).notifications||[]).filter(n=>n.userId===user.id).reverse()}};
  if(req.method==='GET'&&path==='/api/drafts')return {body:{drafts:((await load()).drafts||[]).filter(d=>d.ownerId===user.id).reverse()}};
  if(req.method==='GET'){
   const list=(await load()).requests.filter(r=>user.role==='operator'||r.ownerId===user.id);
   if(url.searchParams.has('id')){const item=list.find(r=>r.id===url.searchParams.get('id'));if(!item)fail('요청을 찾을 수 없습니다.',404);return {body:{request:dto(item,user)}};}
   return {body:{requests:list.map(r=>({id:r.id,title:r.title,status:r.status,createdAt:r.createdAt,updatedAt:r.updatedAt,ownerName:r.ownerName,version:r.version,company:r.company||'',role:r.jobRole||'',deadline:r.deadline||'',dueAt:r.dueAt||''})).reverse()}};
  }
  if(!input||typeof input!=='object'||Array.isArray(input))fail('입력 형식을 확인해 주세요.');
  if(path==='/api/notifications/read')return change(db=>{const item=(db.notifications||[]).find(n=>n.id===input.id&&n.userId===user.id);if(!item)fail('알림을 찾을 수 없습니다.',404);item.read=true;return {body:{ok:true}};});
  if(path==='/api/drafts')return change(db=>{db.drafts??=[];if(input.action==='delete'){const index=db.drafts.findIndex(d=>d.id===input.id&&d.ownerId===user.id);if(index<0)fail('임시 저장을 찾을 수 없습니다.',404);db.drafts.splice(index,1);return {body:{ok:true}};}if(input.action!=='save')fail('임시 저장 동작을 확인해 주세요.');const draft={id:input.id||randomUUID(),ownerId:user.id,service:optional(input.service,30,'서비스'),title:field(input.title,2,100,'제목'),company:optional(input.company,100,'회사'),role:optional(input.role,100,'직무'),deadline:day(input.deadline),essay:optional(input.essay,12000,'원문'),note:optional(input.note,5000,'요청사항'),updatedAt:new Date().toISOString()};const index=db.drafts.findIndex(d=>d.id===draft.id&&d.ownerId===user.id);if(index>=0)db.drafts[index]=draft;else db.drafts.push(draft);return {body:{draft}};});
  if(path==='/api/requests'){
   if(input.consent!==true)fail('비공개 검토를 위한 자료 저장·열람에 동의해 주세요.');
   const request={id:randomUUID(),ownerId:user.id,ownerName:user.name,title:field(input.title,2,100,'제목'),company:optional(input.company,100,'회사'),jobRole:optional(input.role,100,'직무'),deadline:day(input.deadline),service:optional(input.service,30,'서비스'),essay:field(input.essay,20,12000,'원문'),aiReport:field(input.aiReport||'',0,20000,'AI 결과'),note:field(input.note,2,5000,'요청사항'),status:'submitted',version:0,createdAt:new Date().toISOString(),messages:[],draft:{revision:'',reason:'',next:''},interview:{turns:[],feedback:''},recheckCount:0};
   request.updatedAt=request.createdAt;return change(db=>{db.requests.push(request);for(const operator of db.users.filter(u=>u.role==='operator'))notify(db,operator.id,request.id,'새 비공개 요청이 접수됐습니다.');return {status:201,body:{request:dto(request,user)}};});
  }
  return change(db=>{
   const r=db.requests.find(x=>x.id===input.id&&(user.role==='operator'||x.ownerId===user.id));if(!r)fail('요청을 찾을 수 없습니다.',404);
   if(input.version!==r.version)fail('다른 변경이 있습니다. 최신 상태를 불러온 뒤 다시 작성해 주세요.',409);
   if(path==='/api/requests/recheck'){
    if(user.role!=='customer'||r.status!=='completed'||(r.recheckCount||0)>=1)fail('재검토는 완료 후 한 번 요청할 수 있습니다.',403);
    r.messages.push({by:'customer',text:field(input.message,2,5000,'재검토 질문'),at:new Date().toISOString()});r.finalHistory??=[];r.finalHistory.push(r.final);r.recheckCount=1;r.status='recheck_requested';
    for(const operator of db.users.filter(u=>u.role==='operator'))notify(db,operator.id,r.id,'고객이 재검토를 요청했습니다.');
   }else if(path==='/api/requests/interview'){
    r.interview??={turns:[],feedback:''};const action=input.action,turns=r.interview.turns;
    if(action==='question'&&user.role==='operator'&&r.status!=='completed'){if(turns.length>=20)fail('모의면접은 20문항까지 진행할 수 있습니다.');if(turns.length&&(!turns.at(-1).answer||turns.at(-1).followUp&&!turns.at(-1).followUpAnswer))fail('고객 답변을 기다리는 중입니다.',409);turns.push({question:field(input.text,2,2000,'면접 질문'),answer:'',followUp:'',followUpAnswer:''});notify(db,r.ownerId,r.id,'운영자 모의면접 질문이 도착했습니다.');}
    else if(action==='answer'&&user.role==='customer'&&turns.length&&!turns.at(-1).answer){turns.at(-1).answer=field(input.text,2,5000,'면접 답변');for(const operator of db.users.filter(u=>u.role==='operator'))notify(db,operator.id,r.id,'고객의 모의면접 답변이 도착했습니다.');}
    else if(action==='followup'&&user.role==='operator'&&turns.length&&turns.at(-1).answer&&!turns.at(-1).followUp){turns.at(-1).followUp=field(input.text,2,2000,'꼬리 질문');notify(db,r.ownerId,r.id,'모의면접 꼬리 질문이 도착했습니다.');}
    else if(action==='followup_answer'&&user.role==='customer'&&turns.length&&turns.at(-1).followUp&&!turns.at(-1).followUpAnswer){turns.at(-1).followUpAnswer=field(input.text,2,5000,'꼬리 질문 답변');for(const operator of db.users.filter(u=>u.role==='operator'))notify(db,operator.id,r.id,'고객의 꼬리 질문 답변이 도착했습니다.');}
    else if(action==='feedback'&&user.role==='operator'&&turns.length&&turns.at(-1).answer&&(!turns.at(-1).followUp||turns.at(-1).followUpAnswer)){r.interview.feedback=field(input.text,10,5000,'최종 피드백');notify(db,r.ownerId,r.id,'운영자 모의면접 최종 피드백이 도착했습니다.');}
    else fail('현재 단계에서 수행할 수 없는 모의면접 동작입니다.',409);
   }else
   if(path==='/api/requests/reply'){
    if(user.role!=='customer'||r.status!=='needs_info')fail('보완 요청을 받은 고객만 답변할 수 있습니다.',403);
    r.messages.push({by:'customer',text:field(input.message,2,5000,'보완 답변'),at:new Date().toISOString()});r.status='submitted';for(const operator of db.users.filter(u=>u.role==='operator'))notify(db,operator.id,r.id,'고객이 보완 자료를 보냈습니다.');
   }else{
    if(user.role!=='operator')fail('운영자 권한이 필요합니다.',403);
    if(r.status==='completed')fail('완료된 리포트는 재검토 요청 전까지 수정할 수 없습니다.',409);
    if(!['reviewing','needs_info','completed'].includes(input.status))fail('진행 상태를 확인해 주세요.');
    const draft={};for(const [key,label,max]of [['revision','수정본',20000],['reason','수정 이유',5000],['next','보완점',5000]])draft[key]=field(input[key]??r.draft[key],input.status==='completed'?20:0,max,label);
    if(input.status==='needs_info')r.messages.push({by:'operator',text:field(input.message,2,5000,'보완 요청'),at:new Date().toISOString()});
    r.dueAt=day(input.dueAt??r.dueAt);
    if(input.status==='completed'){if(input.checked!==true)fail('원문 근거와 최종 리포트를 확인해 주세요.');r.final={...draft,reviewer:user.name};r.completedAt=new Date().toISOString();}
    r.draft=draft;r.status=input.status;if(input.status==='needs_info'||input.status==='completed'||r.dueAt)notify(db,r.ownerId,r.id,input.status==='needs_info'?'운영자가 자료 보완을 요청했습니다.':input.status==='completed'?'최종 리포트가 도착했습니다.':'검토 예정일이 안내됐습니다.');
   }
   r.updatedAt=new Date().toISOString();r.version++;return {body:{request:dto(r,user)}};
  });
 }};
}
