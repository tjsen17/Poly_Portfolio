import {sampleReport} from './sample.js';
import {show} from './report.js';

export function setupWebMCP() {
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'show_sample_report',description:'입력 분석 없이 미리 작성된 가상 샘플 리포트를 화면에 표시합니다.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('빈 객체가 필요합니다.');show(sampleReport,'가상 샘플');return {state:'sample',analyzed:false};}})).catch(()=>{});}catch{}}

}
