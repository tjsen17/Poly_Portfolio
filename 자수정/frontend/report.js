import {sampleReport} from './sample.js';
import {download} from './download.js';

const $ = id => document.getElementById(id);
let reportText = '';
let reviewedInput = null;
export function show(text,state,input=null){reportText=text;reviewedInput=input ? {...input} : null;$('empty').hidden=true;$('report').hidden=false;$('report').textContent=text;$('download').hidden=false;$('report-state').textContent=state;$('message').textContent='';$('request-review').hidden=!reviewedInput;}
export function markReportStale() {
  if(reportText) $('report-state').textContent = '이전 결과 · 입력 변경됨';
}
export function setupReport() {
$('request-review').addEventListener('click',()=>{
  if (!reviewedInput) return;
  try {
    sessionStorage.setItem('jasujeong-review-draft',JSON.stringify({essay:reviewedInput.essay,aiReport:reportText}));
    location.assign('/board?write=1&category=추가%20첨삭%20요청');
  } catch { $('message').textContent='요청서로 옮기지 못했습니다. 리포트를 다운로드한 뒤 게시판에서 추가 첨삭 요청을 작성해 주세요.'; }
});
$('preview').addEventListener('click',()=>show(sampleReport,'가상 샘플'));
$('download').addEventListener('click',()=>download(reportText,'첨삭-리포트.txt'));
}
