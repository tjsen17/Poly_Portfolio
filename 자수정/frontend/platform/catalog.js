export const categories = ['전체', '자소서', '직무 분석', '면접'];
export const services = [
  {id:'resume', category:'자소서', title:'경험이 드러나는 자소서 첨삭', brief:'추상적인 표현은 덜고, 내가 한 일을 구체적으로.', label:'문장 첨삭', motif:'01', tone:'sage',
    focus:'자소서의 추상적인 표현을 실제 행동 중심으로 다듬고, 문장별 수정 이유를 설명해 주세요. 제시되지 않은 사실은 추가하지 마세요.',
    audience:'경험은 있지만 문장으로 풀어내기 어려운 분', outputs:['원문에 근거한 핵심 진단','수정 제안과 바꾼 이유','추가로 확인해야 할 사실'], preparation:'지원 공고, 자소서 문항과 답변', sample:'꼼꼼합니다 → 어떤 일을 어떻게 확인했나요?'},
  {id:'job-fit', category:'직무 분석', title:'공고와 내 경험 연결하기', brief:'채용 공고의 요구와 내 경험 사이의 연결점을 찾아요.', label:'직무 연결', motif:'02', tone:'sand',
    focus:'채용 공고의 요구 역량과 자소서에 제시된 경험을 연결해 주세요. 확인된 근거와 추론을 구분하고 부족한 정보는 질문으로 남겨 주세요.',
    audience:'같은 경험을 지원 직무에 맞게 설명하고 싶은 분', outputs:['공고의 요구 역량 정리','경험과 직무의 연결 근거','보완할 정보와 확인 질문'], preparation:'지원 공고 전체, 본인의 경험이 담긴 답변', sample:'요구 역량 ↔ 경험 속 행동 ↔ 설명할 근거'},
  {id:'interview', category:'면접', title:'내 자소서로 면접 질문 준비', brief:'내가 쓴 문장에서 질문과 꼬리 질문을 뽑아봐요.', label:'면접 준비', motif:'03', tone:'ink',
    focus:'자소서에 근거한 면접 질문과 꼬리 질문, 답변 평가 기준을 중점적으로 작성해 주세요. 실제로 본인이 한 일을 확인할 수 있는 질문을 포함해 주세요.',
    audience:'자소서는 썼지만 면접에서 무엇을 말할지 막막한 분', outputs:['경험에 기반한 예상 질문','답변을 깊게 파고드는 꼬리 질문','답변에서 확인할 핵심 기준'], preparation:'지원 공고, 면접에서 설명할 자소서', sample:'어떤 역할이었나요? → 왜 그렇게 결정했나요?'},
  {id:'complete', category:'자소서', title:'자소서부터 면접까지 한 번에', brief:'문장을 다듬고, 그 문장을 말로 설명하는 단계까지.', label:'통합 점검', motif:'04', tone:'rose',
    focus:'자소서 진단, 문장 첨삭, 수정 초안, 면접 질문을 균형 있게 제공해 주세요. 제출 전 확인할 사항을 함께 정리해 주세요.',
    audience:'지원서와 면접 준비를 함께 점검하고 싶은 분', outputs:['진단·첨삭·수정 초안','예상 질문과 답변 기준','제출 전 사실 확인 사항'], preparation:'지원 공고, 자소서 문항과 답변', sample:'진단 → 첨삭 → 수정 초안 → 면접 연습'}
];
export function findServices(query='', category='전체') {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return services.filter(item => (category==='전체'||item.category===category) && words.every(word => `${item.title} ${item.brief} ${item.category} ${item.label}`.toLocaleLowerCase().includes(word)));
}
