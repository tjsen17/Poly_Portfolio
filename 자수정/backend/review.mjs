import {validate} from './validation.mjs';
import {instructions} from './prompt.mjs';

export async function review(data, {key, model, fetcher = fetch}) {
  const input = validate(data);
  if (!key || !model) throw new Error('AI 연결 전입니다. 운영자가 API 키와 모델을 설정해야 합니다. 지금은 샘플과 요청서 다운로드를 사용할 수 있습니다.');
  const response = await fetcher('https://api.openai.com/v1/responses', {
    method:'POST', signal:AbortSignal.timeout(60000),
    headers:{'Content-Type':'application/json', Authorization:`Bearer ${key}`},
    body:JSON.stringify({model, instructions, input:JSON.stringify(input), store:false, max_output_tokens:4000})
  });
  if (!response.ok) throw new Error(`AI 요청을 완료하지 못했습니다 (${response.status}). 설정·잔액·사용 한도를 확인해 주세요. 자동 재시도하지 않았습니다.`);
  const body = await response.json();
  if (body.status !== 'completed') throw new Error('AI 결과가 완성되지 않았습니다. 입력을 줄이거나 운영자에게 문의해 주세요.');
  const content = (body.output ?? []).flatMap(item => item.content ?? []);
  if (content.some(item => item.type === 'refusal')) throw new Error('AI가 이 요청의 처리를 거절했습니다. 입력 내용을 확인해 주세요.');
  const text = content.filter(item => item.type === 'output_text').map(item => item.text).join('\n');
  if (!text.trim()) throw new Error('AI가 읽을 수 있는 결과를 반환하지 않았습니다.');
  return {text, usage:body.usage ? {input_tokens:body.usage.input_tokens,output_tokens:body.usage.output_tokens} : null};
}
