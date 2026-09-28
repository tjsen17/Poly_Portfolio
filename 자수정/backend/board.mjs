import {readFile, mkdir, writeFile, rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';

const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const text=(value,max,label)=>{if(typeof value!=='string'||!value.trim()||value.length>max)fail(`${label}은 1~${max}자로 입력해 주세요.`);return value.trim();};
export function createBoard(file=fileURLToPath(new URL('../data/posts.json',import.meta.url))){
 let pending=Promise.resolve();
 async function load(){try{const posts=JSON.parse(await readFile(file,'utf8'));if(!Array.isArray(posts))throw new Error('Invalid board store');return posts;}catch(e){if(e.code==='ENOENT')return [];throw e;}}
 function change(fn){const task=pending.then(async()=>{const posts=await load(),result=fn(posts);await mkdir(dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(posts),'utf8');await rename(tmp,file);return result;});pending=task.catch(()=>{});return task;}
 const publicPost=(post,user)=>({id:post.id,title:post.title,author:post.author,body:post.body,category:post.category,createdAt:post.createdAt,updatedAt:post.updatedAt||post.createdAt,pinned:!!post.pinned,hidden:!!post.hidden,canEdit:!!user&&user.id===post.ownerId,comments:(post.comments||[]).filter(c=>!c.hidden||user?.role==='operator').map(c=>({id:c.id,author:c.author,body:c.body,createdAt:c.createdAt,canEdit:!!user&&user.id===c.ownerId})),reportCount:user?.role==='operator'?(post.reports||[]).length:undefined});
 return {
  async list(user){return (await load()).filter(p=>p.category!=='추가 첨삭 요청'&&(!p.hidden||user?.role==='operator'||p.ownerId===user?.id)).sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)).map(p=>publicPost(p,user));},
  async legacy(){return (await load()).filter(p=>p.category==='추가 첨삭 요청');},
  async add(input,user){if(!input||!['자유','질문','정보'].includes(input.category))fail('게시판 분류를 선택해 주세요.');const post={id:randomUUID(),category:input.category,title:text(input.title,100,'제목'),author:text(input.author,30,'닉네임'),body:text(input.body,10000,'내용'),ownerId:user?.id||null,comments:[],reports:[],pinned:false,hidden:false,createdAt:new Date().toISOString()};return change(posts=>{posts.unshift(post);return publicPost(post,user);});},
  async mutate(input,user){if(!user)fail('로그인 후 이용해 주세요.',401);return change(posts=>{const post=posts.find(p=>p.id===input.id&&p.category!=='추가 첨삭 요청');if(!post)fail('게시글을 찾을 수 없습니다.',404);const owner=post.ownerId===user.id,operator=user.role==='operator';let result;
   if(input.action==='edit'&&owner){post.title=text(input.title,100,'제목');post.body=text(input.body,10000,'내용');post.updatedAt=new Date().toISOString();}
   else if(input.action==='delete'&&owner){posts.splice(posts.indexOf(post),1);return {deleted:true};}
   else if(input.action==='comment'){post.comments??=[];const comment={id:randomUUID(),ownerId:user.id,author:user.name,body:text(input.body,3000,'댓글'),createdAt:new Date().toISOString()};post.comments.push(comment);result={comment};}
   else if(input.action==='comment_edit'){const comment=(post.comments||[]).find(c=>c.id===input.commentId);if(!comment||comment.ownerId!==user.id)fail('본인 댓글만 수정할 수 있습니다.',403);comment.body=text(input.body,3000,'댓글');}
   else if(input.action==='comment_delete'){const index=(post.comments||[]).findIndex(c=>c.id===input.commentId&&c.ownerId===user.id);if(index<0)fail('본인 댓글만 삭제할 수 있습니다.',403);post.comments.splice(index,1);}
   else if(input.action==='report'){post.reports??=[];if(post.reports.some(r=>r.userId===user.id))fail('이미 신고한 글입니다.',409);post.reports.push({userId:user.id,reason:text(input.reason,500,'신고 사유'),at:new Date().toISOString()});}
   else if(input.action==='moderate'&&operator){if(typeof input.hidden!=='boolean'||typeof input.pinned!=='boolean')fail('관리 상태를 확인해 주세요.');post.hidden=input.hidden;post.pinned=input.pinned;}
   else fail('이 작업을 수행할 권한이 없습니다.',403);
   return {...result,post:publicPost(post,user)};
  });}
 };
}
