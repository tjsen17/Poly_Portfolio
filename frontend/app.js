// 화면 시작 및 분석 요청 흐름
import {post} from './api.js';
import {data, setupForm} from './form.js';
import {show, setupReport} from './report.js';
import {download} from './download.js';
import {setupWebMCP} from './webmcp.js';
import {services} from './platform/catalog.js';

const $ = id => document.getElementById(id);
let configured = false;
const routeService = location.pathname.match(/^\/workspace\/([^/]+)$/)?.[1];
const selectedService = services.find(item => item.id === (routeService || new URLSearchParams(location.search).get('service'))) || services[0];
const workspace = selectedService.workspace;
setupForm(selectedService?.focus);
setupReport(selectedService.id);
setupWebMCP();
$('focus').value = selectedService.focus;
$('service').value = selectedService.id;
$('selected-service').textContent = `${selectedService.label} · 자수정`;
$('workspace-title').textContent = workspace.title;
$('workspace-description').textContent = workspace.description;
$('form-description').textContent = workspace.description;
$('job-label').textContent = workspace.sourceLabel;
$('job-hint').textContent = workspace.sourceHint;
$('job').placeholder = workspace.sourcePlaceholder;
$('essay-label').textContent = workspace.contentLabel;
$('essay').placeholder = workspace.contentPlaceholder;
$('focus-label').textContent = workspace.focusLabel;
$('focus').placeholder = workspace.focusPlaceholder;
$('report-title').textContent = workspace.reportTitle;
$('empty-title').innerHTML = workspace.emptyTitle.replace('\n','<br>');
$('before-label').textContent = workspace.beforeLabel;
$('before-text').textContent = workspace.before;
$('after-label').textContent = workspace.afterLabel;
$('after-text').textContent = workspace.after;
$('why-text').textContent = workspace.why;
$('question-text').textContent = `“${workspace.question}”`;
$('upload-field').hidden = !workspace.upload;
if(selectedService.id==='job-fit'){
  $('job-link-field').hidden=false;
  $('import-job').addEventListener('click',async()=>{
    const button=$('import-job'),message=$('job-url-message'),url=$('job-url').value.trim();
    if(!url){message.textContent='채용 공고 링크를 입력해 주세요.';return;}
    if($('job').value.trim()&&!confirm('현재 입력한 공고 내용을 링크의 내용으로 바꿀까요?'))return;
    button.disabled=true;message.textContent='공고 내용을 가져오는 중입니다.';
    try{
      const response=await fetch('/api/job-posting?url='+encodeURIComponent(url));
      const result=await response.json();if(!response.ok)throw new Error(result.error);
      $('job').value=result.text;$('job').dispatchEvent(new Event('input',{bubbles:true}));
      message.textContent='공고 내용을 가져왔습니다. 불필요한 문구가 섞이지 않았는지 확인해 주세요.';
    }catch(error){message.textContent=error.message||'공고를 가져오지 못했습니다. 아래에 직접 붙여 넣어 주세요.';}
    finally{button.disabled=false;}
  });
}
if(selectedService.id==='job-fit'){
  const essay=$('essay'), label=essay.previousElementSibling, section=document.createElement('fieldset');section.className='experience-fields';
  section.innerHTML='<legend>경험별로 정리하기</legend><p>경험명·행동·결과부터 적어 보세요. 역할과 문제는 필요할 때 펼쳐서 보탤 수 있습니다.</p><div id="experiences"></div><button type="button" id="add-experience" class="subtle">경험 추가</button>';
  label.before(section);essay.readOnly=true;
  const preview=document.createElement('details');preview.className='experience-preview';preview.innerHTML='<summary>분석용 내용 미리보기 · <span id="preview-count">0자</span></summary>';section.after(preview);preview.append(label,essay);
  const list=section.querySelector('#experiences');
  const sync=()=>{essay.value=[...list.children].map((card,i)=>{card.querySelector('summary').textContent=`경험 ${i+1}${card.querySelector('input').value.trim()?' · '+card.querySelector('input').value.trim():''}`;return `${i+1}. ${[...card.querySelectorAll('input,textarea')].map(field=>`${field.dataset.label}: ${field.value.trim()}`).join('\n')}`;}).join('\n\n');preview.querySelector('#preview-count').textContent=`${essay.value.length.toLocaleString()}자`;essay.dispatchEvent(new Event('input',{bubbles:true}));};
  section.querySelector('#add-experience').addEventListener('click',()=>{if(list.children.length>=5)return;list.querySelectorAll(':scope>details').forEach(item=>item.open=false);const card=document.createElement('details');card.className='private-block';card.open=true;card.innerHTML='<summary>경험 '+(list.children.length+1)+'</summary><label>경험명<input data-label="경험명" maxlength="100" placeholder="예: 카페 아르바이트"></label><details class="experience-more"><summary>내 역할·문제 더 적기 (선택)</summary><label>내 역할<input data-label="내 역할" maxlength="200"></label><label>마주한 문제<textarea data-label="문제" maxlength="1000" rows="2"></textarea></label></details><label>내가 한 행동<textarea data-label="행동" maxlength="2000" rows="3"></textarea></label><label>결과 또는 배운 점<textarea data-label="결과" maxlength="1000" rows="2"></textarea></label><button type="button" class="subtle">이 경험 삭제</button>';card.querySelector('button').addEventListener('click',()=>{card.remove();sync();});card.addEventListener('input',sync);list.append(card);sync();});
  section.querySelector('#add-experience').click();
  $('sample').addEventListener('sample-applied',()=>{const example=essay.value;list.querySelectorAll('input,textarea').forEach(field=>field.value='');list.querySelector('[data-label="행동"]').value=example;sync();});
}
if(selectedService.id==='resume'||selectedService.id==='complete'){
  const question=document.createElement('div');question.className='experience-fields';
  question.innerHTML='<label for="question">자소서 문항<input id="question" maxlength="1000" placeholder="예: 지원 동기와 입사 후 포부를 기술해 주세요."></label><label for="word-limit">문항별 글자 수 제한<input id="word-limit" type="number" min="1" max="12000" placeholder="예: 700"></label>';
  $('essay').previousElementSibling.before(question);
  $('essay-label').textContent='현재 작성한 답변';
  $('sample').addEventListener('sample-applied',()=>{question.querySelectorAll('input').forEach(input=>input.value='');});
}
document.title = `${selectedService.label} 작업실 | 자수정`;
const draftKey=`jasujeong-workspace-draft-${selectedService.id}`;
const saveWorkspace=()=>{try{sessionStorage.setItem(draftKey,JSON.stringify({job:$('job').value,focus:$('focus').value,essay:$('essay').value,question:$('question')?.value,limit:$('word-limit')?.value,experiences:[...document.querySelectorAll('#experiences>details')].map(card=>[...card.querySelectorAll('input,textarea')].map(field=>field.value))}));}catch{}};
try{
  const saved=JSON.parse(sessionStorage.getItem(draftKey)||'null');
  if(saved&&typeof saved==='object'){
    $('job').value=saved.job||'';$('focus').value=saved.focus||selectedService.focus;
    if(selectedService.id==='job-fit'&&Array.isArray(saved.experiences)){
      const list=$('experiences');while(list.children.length<Math.min(saved.experiences.length,5))$('add-experience').click();
      [...list.children].forEach((card,i)=>{[...card.querySelectorAll('input,textarea')].forEach((field,j)=>field.value=saved.experiences[i]?.[j]||'');card.querySelector('.experience-more').open=Boolean(saved.experiences[i]?.[1]||saved.experiences[i]?.[2]);});
      list.querySelector('input')?.dispatchEvent(new Event('input',{bubbles:true}));
    }else $('essay').value=saved.essay||'';
    if($('question'))$('question').value=saved.question||'';
    if($('word-limit'))$('word-limit').value=saved.limit||'';
  }
}catch{}
$('form').addEventListener('input',saveWorkspace);
$('form').addEventListener('change',saveWorkspace);
if (workspace.upload) $('resume-file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  if(file.size>1024*1024||(!file.name.toLowerCase().endsWith('.txt')&&file.type!=='text/plain')){$('file-note').textContent='.txt 파일만 최대 1MB까지 불러올 수 있습니다.';event.target.value='';return;}
  const text=await file.text();if(text.trim().length<50||text.length>12000){$('file-note').textContent='자소서 내용은 50~12,000자로 준비해 주세요.';event.target.value='';return;}
  if($('essay').value&&!confirm('현재 자소서 내용을 파일 내용으로 바꿀까요?')){event.target.value='';return;}
  $('essay').value=text;$('essay').dispatchEvent(new Event('input',{bubbles:true}));$('file-note').textContent=`${file.name} 내용을 불러왔습니다.`;
});
let movingToRequest = false;
// Warn before leaving an unsaved form; no private input is persisted.
window.addEventListener('beforeunload', event => {
  if (!movingToRequest && ($('job').value || $('essay').value || ($('focus').value && $('focus').value !== (selectedService?.focus || '')) || !$('report').hidden)) {
    event.preventDefault(); event.returnValue = '';
  }
});

$('request-direct').addEventListener('click',()=>{
  const input=data();
  const essay=[input.job && `${workspace.sourceLabel}\n${input.job}`,input.essay && `${workspace.contentLabel}\n${input.essay}`].filter(Boolean).join('\n\n');
  if(essay.length>12000){$('message').textContent='접수 자료는 합계 12,000자까지 보낼 수 있습니다. 공고와 작성 내용을 줄인 뒤 다시 요청해 주세요.';return;}
  try{
    sessionStorage.setItem('jasujeong-review-draft',JSON.stringify({service:selectedService.id,essay,aiReport:'',note:input.focus}));
    movingToRequest=true;
    location.assign('/request');
  }catch{$('message').textContent='접수 화면으로 옮기지 못했습니다. 브라우저의 임시 저장 설정을 확인해 주세요.';}
});
$('prompt').addEventListener('click',async()=>{if(!$('form').reportValidity())return;try{const result=await post('/api/prompt',data());download(result.text,'첨삭-요청서.txt');$('message').textContent='요청서를 다운로드했습니다. 이 동작은 외부 AI에 자료를 전송하지 않습니다.';}catch(error){$('message').textContent=error.message;}});
$('form').addEventListener('submit',async event=>{
  event.preventDefault();if(!configured)return;
  if(!$('consent').checked){$('message').textContent='외부 AI 전송 동의를 선택해 주세요.';$('consent').focus();return;}
  const input = data();const controls=[...$('form').elements,$('sample')];controls.forEach(el=>el.disabled=true);
  $('analyze').textContent='분석 중…';$('message').textContent='공고와 원문을 분석하고 있습니다. 최대 60초 정도 걸릴 수 있습니다.';
  try{const result=await post('/api/review',input);show(result.text,'AI 생성 · 검수 필요',input);}
  catch(error){$('message').textContent=error.message;}
  finally{controls.forEach(el=>el.disabled=false);$('analyze').textContent='진단 · 면접 질문 만들기';}
});
fetch('/api/status').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(status=>{configured=status.configured;$('analyze').disabled=!configured;$('analyze').textContent=configured?'진단 · 면접 질문 만들기':'AI 연결 전';$('connection').textContent=configured?'AI 설정이 있습니다. 실제 호출 성공 여부는 분석 요청 시 확인됩니다.':'API 설정이 없습니다. 운영자 검토는 바로 요청할 수 있으며, 가상 샘플과 요청서 다운로드도 이용할 수 있습니다.';}).catch(()=>{$('connection').textContent='로컬 서버 연결을 확인해 주세요.';$('analyze').textContent='연결할 수 없음';});
