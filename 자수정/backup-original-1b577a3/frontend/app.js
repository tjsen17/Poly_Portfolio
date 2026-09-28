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
document.title = `${selectedService.label} 작업실 | 자수정`;
if (workspace.upload) $('resume-file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  if(file.size>1024*1024||(!file.name.toLowerCase().endsWith('.txt')&&file.type!=='text/plain')){$('file-note').textContent='.txt 파일만 최대 1MB까지 불러올 수 있습니다.';event.target.value='';return;}
  const text=await file.text();if(text.trim().length<50||text.length>12000){$('file-note').textContent='자소서 내용은 50~12,000자로 준비해 주세요.';event.target.value='';return;}
  if($('essay').value&&!confirm('현재 자소서 내용을 파일 내용으로 바꿀까요?')){event.target.value='';return;}
  $('essay').value=text;$('essay').dispatchEvent(new Event('input',{bubbles:true}));$('file-note').textContent=`${file.name} 내용을 불러왔습니다.`;
});
// Warn before leaving an unsaved form; no private input is persisted.
window.addEventListener('beforeunload', event => {
  if ($('job').value || $('essay').value || ($('focus').value && $('focus').value !== (selectedService?.focus || '')) || !$('report').hidden) {
    event.preventDefault(); event.returnValue = '';
  }
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
fetch('/api/status').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(status=>{configured=status.configured;$('analyze').disabled=!configured;$('analyze').textContent=configured?'진단 · 면접 질문 만들기':'AI 연결 전';$('connection').textContent=configured?'AI 설정이 있습니다. 실제 호출 성공 여부는 분석 요청 시 확인됩니다.':'API 설정이 없습니다. 가상 샘플을 보거나 첨삭 요청서를 다운로드할 수 있습니다.';}).catch(()=>{$('connection').textContent='로컬 서버 연결을 확인해 주세요.';$('analyze').textContent='연결할 수 없음';});
