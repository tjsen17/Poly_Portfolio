import {download} from '../download.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statuses={submitted:'접수 완료',reviewing:'운영자 검토 중',needs_info:'자료 보완 필요',completed:'최종 리포트 도착'};
const date=value=>new Date(value).toLocaleString('ko-KR');
async function api(path,input){const response=await fetch(path,input===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const data=await response.json();if(!response.ok)throw new Error(data.error||'요청을 처리하지 못했습니다.');return data;}
const area=(name,label,value='',min=0,max=5000)=>`<label>${label}<textarea name="${name}" rows="6" minlength="${min}" maxlength="${max}" ${min?'required':''}>${esc(value)}</textarea></label>`;
const block=(label,text)=>`<section class="private-block"><h3>${label}</h3><div class="private-text">${esc(text||'첨부하지 않았습니다.')}</div></section>`;
function submit(form,action){let dirty=false;form.addEventListener('input',()=>dirty=true);window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});form.addEventListener('submit',async event=>{event.preventDefault();const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);const error=form.querySelector('[role="alert"]');error.textContent='';try{const data=Object.fromEntries(new FormData(form));await action(data,event.submitter?.value);}catch(e){error.textContent=e.message+' 입력 내용은 유지됩니다.';}finally{buttons.forEach(b=>b.disabled=false);}});return ()=>dirty=false;}
export async function setupAccountNav(){const link=document.querySelector('a[data-account]');if(!link)return;try{const {user}=await api('/api/auth/me');if(!user)return;link.textContent=user.role==='operator'?'운영자 검토실':'마이페이지';link.href=user.role==='operator'?'/operator':'/my';const button=document.createElement('button');button.className='account-logout';button.textContent='로그아웃';button.addEventListener('click',async()=>{button.disabled=true;try{await api('/api/auth/logout',{});sessionStorage.removeItem('jasujeong-review-draft');location.assign('/login');}catch{button.textContent='로그아웃 재시도';button.disabled=false;}});link.after(button);}catch{}}
export async function mountPrivate(content){
 const path=location.pathname,params=new URLSearchParams(location.search),operator=path==='/operator';
 const title=({'/login':'로그인','/signup':'회원가입','/my':'마이페이지','/request':'비공개 첨삭 접수','/operator':'운영자 검토실'})[path];document.title=title+' | 자수정';
 content.innerHTML=`<section class="page-intro"><p class="eyebrow">자수정 · 비공개 검토</p><h1>${title}</h1><p>자료는 요청한 고객과 운영자만 확인합니다.</p></section><div id="private-view" aria-live="polite">불러오는 중입니다.</div>`;
 const view=document.getElementById('private-view');
 try{
 if(path==='/login'||path==='/signup'){
  const signup=path==='/signup',next=['/request','/my','/operator'].includes(params.get('next'))?params.get('next'):'';
  view.innerHTML=`<form class="private-form auth-form"><h2>${signup?'내 계정 만들기':'이메일로 로그인'}</h2>${signup?'<label>이름<input name="name" maxlength="30" autocomplete="name" required></label>':''}<label>이메일<input name="email" type="email" maxlength="254" autocomplete="username" required></label><label>비밀번호<input name="password" type="password" minlength="10" maxlength="128" autocomplete="${signup?'new-password':'current-password'}" required></label><p class="muted">${signup?'비밀번호는 10자 이상으로 설정해 주세요.':'가입한 계정으로 진행 상태와 리포트를 확인하세요.'}</p><button>${signup?'회원가입':'로그인'}</button><p role="alert"></p><a href="${signup?'/login':'/signup'}${next?'?next='+encodeURIComponent(next):''}">${signup?'이미 계정이 있어요':'계정이 없어요 · 회원가입'}</a></form>`;
  const form=view.querySelector('form');let clean;
  clean=submit(form,async data=>{let signed=await api('/api/auth/'+(signup?'register':'login'),data);if(signup)signed=await api('/api/auth/login',{email:data.email,password:data.password});clean();location.assign(next||(signed.user.role==='operator'?'/operator':'/my'));});return;
 }
 const {user}=await api('/api/auth/me');
 if(!user){location.replace('/login?next='+encodeURIComponent(path));return;}
 if(operator&&user.role!=='operator'){view.innerHTML='<h2>운영자만 이용할 수 있는 공간입니다.</h2><a href="/my">내 요청 확인하기</a>';return;}
 if(path==='/request'){
  let draft={};try{const saved=JSON.parse(sessionStorage.getItem('jasujeong-review-draft')||'null');if(saved&&typeof saved.essay==='string'&&typeof saved.aiReport==='string')draft=saved;}catch{}
  view.innerHTML=`<form class="private-form"><h2>어떤 부분을 검토해 드릴까요?</h2><p>AI 결과가 없어도 접수할 수 있습니다. 연락처 등 불필요한 개인정보는 제외해 주세요.</p><label>요청 제목<input name="title" minlength="2" maxlength="100" placeholder="예: 지원 동기와 경험 전달력을 검토해 주세요" required></label>${area('essay','자소서 원문',draft.essay,20,12000)}${area('aiReport','AI 첨삭 결과 (선택)',draft.aiReport,0,20000)}${area('note','운영자에게 요청할 내용','',2)}<label class="private-check"><input type="checkbox" name="consent" required>첨삭을 위해 자료를 서버에 저장하고 운영자가 열람하는 데 동의합니다.</label><button>비공개로 접수하기</button><p role="alert"></p></form>`;
  const form=view.querySelector('form');let clean;clean=submit(form,async data=>{const result=await api('/api/requests',{...data,consent:form.elements.consent.checked});try{sessionStorage.removeItem('jasujeong-review-draft');}catch{}clean();location.assign('/my?id='+encodeURIComponent(result.request.id));});return;
 }
 const destination=operator?'/operator':'/my';
 if(!params.has('id')){
  const {requests}=await api('/api/requests');
  view.innerHTML=`<div class="private-toolbar"><p>${esc(user.name)}님 · ${requests.length}건의 요청</p><a class="button" href="/request">비공개 첨삭 접수하기 →</a>${user.role==='operator'?'<a href="/operator">운영자 검토실</a>':''}</div><div class="private-counts">${Object.entries(statuses).map(([key,label])=>`<div><span>${label}</span><strong>${requests.filter(r=>r.status===key).length}</strong></div>`).join('')}</div><ul class="private-list">${requests.map(r=>`<li><a href="${destination}?id=${encodeURIComponent(r.id)}"><span class="tag">${statuses[r.status]}</span><h2>${esc(r.title)}</h2><p>${operator?esc(r.ownerName)+' · ':''}${date(r.updatedAt)} 업데이트</p><span>상세 보기 →</span></a></li>`).join('')}</ul>${requests.length?'':'<p class="no-results">아직 접수한 요청이 없습니다. 첫 첨삭 요청을 남겨 보세요.</p>'}${operator?'<section class="private-block"><h2>이전 공개 첨삭 요청</h2><p>작성자 계정을 확인할 수 없어 고객 계정에 임의로 연결하지 않습니다. 기존 원본은 보존되며 운영자만 확인합니다.</p><button id="legacy">기존 요청 확인</button><div id="legacy-list"></div></section>':''}`;
  if(operator)view.querySelector('#legacy').addEventListener('click',async event=>{event.target.disabled=true;const list=view.querySelector('#legacy-list');try{const {posts}=await api('/api/legacy-requests');list.innerHTML=posts.length?posts.map(p=>`<details><summary>${esc(p.title)}</summary>${block('기존 닉네임 (미인증)',p.author)}${block('요청사항',p.body)}${block('원문',p.essay)}${block('AI 결과',p.aiReport)}</details>`).join(''):'보관된 이전 요청이 없습니다.';}catch(e){list.textContent=e.message;}finally{event.target.disabled=false;}});return;
 }
 const {request:r}=await api('/api/requests?id='+encodeURIComponent(params.get('id')));
 view.innerHTML=`<a href="${destination}">← 요청 목록</a><div class="private-toolbar"><h2>${esc(r.title)}</h2><span class="tag">${statuses[r.status]}</span></div><p class="muted">접수 ${date(r.createdAt)} · 최근 변경 ${date(r.updatedAt)}</p><p class="private-progress">접수 → 운영자 검토 → 필요 시 자료 보완 → 최종 리포트</p><div class="private-columns"><article>${block('자소서 원문',r.essay)}${block('AI 첨삭 결과',r.aiReport)}${block('고객 요청사항',r.note)}<section class="private-block"><h3>보완 요청과 답변</h3>${r.messages.length?r.messages.map(m=>block(m.by==='operator'?'운영자 · '+date(m.at):'고객 · '+date(m.at),m.text)).join(''):'보완 요청이 없습니다.'}</section></article><aside id="review-panel"></aside></div>`;
 const panel=view.querySelector('#review-panel');
 if(r.status==='completed'){
  panel.innerHTML=`<section class="private-block"><h2>최종 첨삭 리포트</h2><p>${esc(r.final.reviewer)} 운영자 · ${date(r.completedAt)}</p>${block('수정본',r.final.revision)}${block('수정 이유',r.final.reason)}${block('다음 준비와 보완점',r.final.next)}<button id="download-final">최종 리포트 다운로드</button></section>`;
  panel.querySelector('button').addEventListener('click',()=>download(`${r.title}\n검토자: ${r.final.reviewer}\n\n수정본\n${r.final.revision}\n\n수정 이유\n${r.final.reason}\n\n다음 준비와 보완점\n${r.final.next}`,'자수정-최종리포트.txt'));return;
 }
 if(operator){
  panel.innerHTML=`<form class="private-form"><h2>운영자 2차 검토</h2><p>임시 수정본은 고객에게 표시되지 않습니다. 최종 제출 후 고객이 리포트를 확인할 수 있습니다.</p>${area('revision','수정본',r.draft.revision,0,20000)}${area('reason','수정 이유',r.draft.reason)}${area('next','다음 준비와 보완점',r.draft.next)}${area('message','고객에게 보완 요청 (보완 요청 시 필수)')}<label class="private-check"><input name="checked" type="checkbox">원문에 없는 사실을 추가하지 않았으며 최종 내용을 확인했습니다.</label><p class="muted">최종 제출 시 수정본·수정 이유·보완점을 각각 20자 이상 작성해 주세요. 제출 후에는 수정할 수 없습니다.</p><div class="private-toolbar"><button value="reviewing">임시 저장 · 검토 중</button><button value="needs_info">자료 보완 요청</button><button value="completed">최종 리포트 제출</button></div><p role="alert"></p></form>`;
  const form=panel.querySelector('form');let clean;clean=submit(form,async(data,status)=>{if(status==='completed'&&!confirm('고객에게 최종 리포트를 전달할까요? 제출 후 수정할 수 없습니다.'))return;await api('/api/requests/update',{...data,id:r.id,version:r.version,status,checked:form.elements.checked.checked});clean();location.reload();});
 }else if(r.status==='needs_info'){
  panel.innerHTML=`<form class="private-form"><h2>추가 자료를 알려주세요.</h2><p>운영자의 질문을 확인하고 답변하면 다시 검토 대기 상태로 변경됩니다.</p>${area('message','보완 답변','',2)}<button>답변 보내기</button><p role="alert"></p></form>`;
  let clean;clean=submit(panel.querySelector('form'),async data=>{await api('/api/requests/reply',{...data,id:r.id,version:r.version});clean();location.reload();});
 }else panel.innerHTML='<section class="private-block"><h2>운영자의 검토를 기다리고 있어요.</h2><p>원문과 요청사항을 바탕으로 수정본, 수정 이유, 다음 준비를 정리해 드립니다. 보완 요청이나 최종 리포트는 이 페이지에서 확인하세요.</p><a href="'+esc(location.pathname+location.search)+'">진행 상태 새로고침</a></section>';
 }catch(e){view.innerHTML=`<p role="alert">${esc(e.message)}</p><a href="/login">다시 로그인</a> · <a href="${esc(location.pathname+location.search)}">다시 불러오기</a>`;}
}
