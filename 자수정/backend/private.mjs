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
export function createPrivateStore(file=privateFile){
 let pending=Promise.resolve();const sessions=new Map(),attempts=new Map();
 async function load(){try{const db=JSON.parse(await readFile(file,'utf8'));if(db.version!==1||!Array.isArray(db.users)||!Array.isArray(db.requests))throw new Error('Invalid private store');return db;}catch(e){if(e.code==='ENOENT')return {version:1,users:[],requests:[]};throw e;}}
 function change(fn){const task=pending.then(async()=>{const db=await load(),result=await fn(db),tmp=file+'.'+randomUUID()+'.tmp';await mkdir(dirname(file),{recursive:true});try{await writeFile(tmp,JSON.stringify(db),'utf8');await rename(tmp,file);}catch(e){await unlink(tmp).catch(()=>{});throw e;}return result;});pending=task.catch(()=>{});return task;}
 async function register(input,role='customer'){
  const email=field(input?.email,3,254,'이메일').toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('이메일 형식을 확인해 주세요.');
  const password=input?.password;if(typeof password!=='string'||password.length<10||password.length>128)fail('비밀번호는 10~128자로 입력해 주세요.');
  const name=field(input?.name,1,30,'이름');const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  return change(db=>{if(db.users.some(u=>u.email===email))fail('이미 등록된 이메일입니다.',409);const user={id:randomUUID(),email,name,role,salt,passwordHash:key.toString('hex')};db.users.push(user);return publicUser(user);});
 }
 async function current(req){const sid=(req.headers.cookie||'').match(/(?:^|;\s*)jasu_sid=([a-f0-9]{64})(?:;|$)/)?.[1];if(!sid)return null;const session=sessions.get(hash(sid));if(!session)return null;if(session.expires<Date.now()){sessions.delete(hash(sid));return null;}return (await load()).users.find(u=>u.id===session.userId)||null;}
 function dto(r,user){const {draft,...result}=r;return user.role==='operator'?r:result;}
 return {register,current,async handle(path,req,input={}){
  if(path==='/api/auth/register'||path==='/api/auth/login'){
   if(!input||typeof input!=='object'||Array.isArray(input))fail('입력 형식을 확인해 주세요.');
   const ip=req.socket.remoteAddress,now=Date.now();for(const [key,value]of attempts)if(value.until<now)attempts.delete(key);
   const limit=attempts.get(ip)||{count:0,until:now+60000};if(++limit.count>15)fail('로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.',429);attempts.set(ip,limit);
   if(path.endsWith('register'))return {status:201,body:{user:await register(input)}};
   const email=field(input.email,3,254,'이메일').toLowerCase();if(typeof input.password!=='string'||input.password.length>128)fail('이메일 또는 비밀번호가 올바르지 않습니다.',401);
   const user=(await load()).users.find(u=>u.email===email),derived=await scrypt(input.password,user?.salt||'unknown-user',64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
   if(!user||!timingSafeEqual(derived,Buffer.from(user.passwordHash,'hex')))fail('이메일 또는 비밀번호가 올바르지 않습니다.',401);
   for(const [key,value]of sessions)if(value.expires<now)sessions.delete(key);
   if(sessions.size>=1000)fail('접속 세션이 많습니다. 잠시 후 다시 시도해 주세요.',429);
   const old=(req.headers.cookie||'').match(/jasu_sid=([a-f0-9]{64})/)?.[1];if(old)sessions.delete(hash(old));
   const sid=randomBytes(32).toString('hex');sessions.set(hash(sid),{userId:user.id,expires:now+8*3600000});
   return {headers:{'Set-Cookie':cookie(sid,8*3600)},body:{user:publicUser(user)}};
  }
  if(path==='/api/auth/logout'){const sid=(req.headers.cookie||'').match(/jasu_sid=([a-f0-9]{64})/)?.[1];if(sid)sessions.delete(hash(sid));return {headers:{'Set-Cookie':cookie('',0)},body:{ok:true}};}
  const user=await current(req);
  if(path==='/api/auth/me')return {body:{user:user?publicUser(user):null}};
  if(!user)fail('로그인 후 이용해 주세요.',401);
  const url=new URL(req.url,'http://local');
  if(req.method==='GET'){
   const list=(await load()).requests.filter(r=>user.role==='operator'||r.ownerId===user.id);
   if(url.searchParams.has('id')){const item=list.find(r=>r.id===url.searchParams.get('id'));if(!item)fail('요청을 찾을 수 없습니다.',404);return {body:{request:dto(item,user)}};}
   return {body:{requests:list.map(r=>({id:r.id,title:r.title,status:r.status,createdAt:r.createdAt,updatedAt:r.updatedAt,ownerName:r.ownerName,version:r.version})).reverse()}};
  }
  if(!input||typeof input!=='object'||Array.isArray(input))fail('입력 형식을 확인해 주세요.');
  if(path==='/api/requests'){
   if(input.consent!==true)fail('비공개 검토를 위한 자료 저장·열람에 동의해 주세요.');
   const request={id:randomUUID(),ownerId:user.id,ownerName:user.name,title:field(input.title,2,100,'제목'),essay:field(input.essay,20,12000,'원문'),aiReport:field(input.aiReport||'',0,20000,'AI 결과'),note:field(input.note,2,5000,'요청사항'),status:'submitted',version:0,createdAt:new Date().toISOString(),messages:[],draft:{revision:'',reason:'',next:''}};
   request.updatedAt=request.createdAt;return change(db=>{db.requests.push(request);return {status:201,body:{request:dto(request,user)}};});
  }
  return change(db=>{
   const r=db.requests.find(x=>x.id===input.id&&(user.role==='operator'||x.ownerId===user.id));if(!r)fail('요청을 찾을 수 없습니다.',404);
   if(input.version!==r.version)fail('다른 변경이 있습니다. 최신 상태를 불러온 뒤 다시 작성해 주세요.',409);
   if(path==='/api/requests/reply'){
    if(user.role!=='customer'||r.status!=='needs_info')fail('보완 요청을 받은 고객만 답변할 수 있습니다.',403);
    r.messages.push({by:'customer',text:field(input.message,2,5000,'보완 답변'),at:new Date().toISOString()});r.status='submitted';
   }else{
    if(user.role!=='operator')fail('운영자 권한이 필요합니다.',403);
    if(r.status==='completed')fail('완료된 리포트는 수정할 수 없습니다.',409);
    if(!['reviewing','needs_info','completed'].includes(input.status))fail('진행 상태를 확인해 주세요.');
    const draft={};for(const [key,label,max]of [['revision','수정본',20000],['reason','수정 이유',5000],['next','보완점',5000]])draft[key]=field(input[key]??r.draft[key],input.status==='completed'?20:0,max,label);
    if(input.status==='needs_info')r.messages.push({by:'operator',text:field(input.message,2,5000,'보완 요청'),at:new Date().toISOString()});
    if(input.status==='completed'){if(input.checked!==true)fail('원문 근거와 최종 리포트를 확인해 주세요.');r.final={...draft,reviewer:user.name};r.completedAt=new Date().toISOString();}
    r.draft=draft;r.status=input.status;
   }
   r.updatedAt=new Date().toISOString();r.version++;return {body:{request:dto(r,user)}};
  });
 }};
}
