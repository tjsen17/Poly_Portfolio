import {sampleReport} from './sample.js';
import {download} from './download.js';

const $ = id => document.getElementById(id);
let reportText = '';
export function show(text,state){reportText=text;$('empty').hidden=true;$('report').hidden=false;$('report').textContent=text;$('download').hidden=false;$('report-state').textContent=state;$('message').textContent='';}
export function markReportStale() {
  if(reportText) $('report-state').textContent = '이전 결과 · 입력 변경됨';
}
export function setupReport() {
$('preview').addEventListener('click',()=>show(sampleReport,'가상 샘플'));
$('download').addEventListener('click',()=>download(reportText,'첨삭-리포트.txt'));
}
