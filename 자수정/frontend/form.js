import {example} from './sample.js';
import {markReportStale} from './report.js';

const $ = id => document.getElementById(id);
export function data(){return {job:$('job').value,essay:$('essay').value,focus:$('focus').value,consent:$('consent').checked};}

export function setupForm(defaultFocus = '') {
$('essay').addEventListener('input',()=>$('count').textContent=`${$('essay').value.length.toLocaleString()} / 12,000자`);
$('form').addEventListener('input',()=>{markReportStale();});
$('sample').addEventListener('click',()=>{if(($('job').value || $('essay').value || ($('focus').value && $('focus').value !== defaultFocus)) && !confirm('현재 입력을 가상 예시로 바꿀까요? 기존 입력은 저장되지 않습니다.'))return;for(const [id,value]of Object.entries(example))$(id).value=id==='focus' ? defaultFocus || value : value;$('essay').dispatchEvent(new Event('input',{bubbles:true}));$('consent').checked=false;});
}
