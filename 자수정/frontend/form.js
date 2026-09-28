import {example} from './sample.js';
import {markReportStale} from './report.js';

const $ = id => document.getElementById(id);
export function data(){const question=$('question')?.value.trim(),limit=$('word-limit')?.value;return {service:$('service').value,job:$('job').value,essay:question?`문항: ${question}\n답변: ${$('essay').value}`:$('essay').value,focus:[`글자 수 제한: ${limit||'미입력'}`, $('focus').value].filter((x,i)=>i?x:!!$('word-limit')).join('\n'),consent:$('consent').checked};}

export function setupForm(defaultFocus = '', sample = example) {
$('essay').addEventListener('input',()=>$('count').textContent=`${$('essay').value.length.toLocaleString()} / 12,000자`);
$('form').addEventListener('input',()=>{markReportStale();});
$('sample').addEventListener('click',()=>{if(($('job').value || $('essay').value || ($('focus').value && $('focus').value !== defaultFocus)) && !confirm('현재 입력을 가상 예시로 바꿀까요? 기존 입력은 저장되지 않습니다.'))return;for(const [id,value]of Object.entries(sample))$(id).value=id==='focus' ? defaultFocus || value : value;$('essay').dispatchEvent(new Event('input',{bubbles:true}));$('consent').checked=false;$('sample').dispatchEvent(new Event('sample-applied'));});
}
