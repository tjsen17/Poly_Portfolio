import {mountPrivate,setupAccountNav} from './private.js';
import {mountBoard} from './board.js';
import {services, categories, findServices} from './catalog.js';

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const search = (q='', category='전체') => `<form class="search" action="/services" method="get" role="search"><label class="sr-only" for="q">서비스 검색</label><input id="q" name="q" maxlength="100" value="${escape(q)}" placeholder="자소서, 직무 분석, 면접… 무엇이 필요한가요?"><input type="hidden" name="category" value="${escape(category)}"><button type="submit">검색</button></form>`;
const art = item => `<div class="service-art ${item.tone}" aria-hidden="true"><span>${item.label}</span><div class="paper"><b>${item.motif}</b><strong>${item.label}</strong><i></i><i></i><i></i></div><em>${item.category==='면접'?'Q → A':'한 문장, 더 선명하게'}</em></div>`;
const card = item => `<a class="service-card" href="/services/${item.id}">${art(item)}<div class="card-copy"><span class="eyebrow">${item.category} · 운영자 검토 접수</span><h3>${item.title}</h3><p>${item.brief}</p><div class="card-bottom"><span>로컬 체험</span><strong>자세히 보기 ↗</strong></div></div></a>`;
const reportExamples={
  resume:[['제출한 문장','저는 책임감이 강하고 꼼꼼합니다.'],['운영자 수정 제안','카페 마감 업무에서 누락을 발견해 체크리스트를 만들고 다음 근무자에게 공유했습니다.'],['수정 이유·확인할 점','성격 묘사 대신 행동을 보여줍니다. 체크리스트를 실제로 만들었는지, 적용 결과가 있었는지는 본인이 확인해야 합니다.']],
  'job-fit':[['공고 요구','고객 문의를 분류하고 정확하게 전달할 수 있는 사람'],['경험과 연결','카페 근무 중 문의 내용을 유형별로 정리해 다음 근무자에게 전달한 경험을 연결할 수 있습니다.'],['보완 질문','분류 기준과 전달 방식이 실제로 어땠는지 확인한 뒤 지원 문장에 반영합니다.']],
  interview:[['운영자 질문','인수인계 누락을 발견했을 때 본인이 맡은 역할은 무엇이었나요?'],['꼬리 질문','체크리스트를 쓰기 전후에 달라진 점을 어떻게 확인했나요?'],['최종 피드백 예시','행동은 구체적입니다. 본인 역할과 확인 가능한 결과를 구분해 답하면 더 명확해집니다.']],
  complete:[['자소서 수정 방향','추상적인 강점 표현을 실제 행동과 근거가 드러나는 문장으로 바꿉니다.'],['직무·면접 연결','공고의 요구와 그 행동이 만나는 지점을 표시하고 예상 질문을 준비합니다.'],['최종 보완점','운영자가 확인되지 않은 성과를 질문으로 남기고, 제출 전 사실관계를 다시 확인하도록 안내합니다.']]
};
const reportExample=item=>`<section class="detail-section report-example"><h2>운영자 검토 결과물 예시</h2><p class="disclosure">아래는 구성 이해를 위한 가상 예시입니다. 실제 검토 내용은 제출 자료에 따라 달라집니다.</p><dl>${reportExamples[item.id].map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl><p>최종 리포트에는 수정 이유와 다음 보완점을 담고, 완료 후 재검토를 1회 요청할 수 있습니다.</p></section>`;
const steps = `<ol class="steps"><li><span>01</span><div><h3>필요한 도움을 고르세요</h3><p>문장 첨삭, 직무 연결, 면접 준비 중 지금 필요한 목적을 선택해요.</p></div></li><li><span>02</span><div><h3>서비스에 맞는 자료를 넣으세요</h3><p>공고와 자소서 또는 경험을 선택한 작업실에 입력해요.</p></div></li><li><span>03</span><div><h3>검토하고, 나만의 표현으로 경쟁력을 갖추세요.</h3><p>사실과 표현을 직접 확인하고 필요한 결과를 내려받으세요.</p></div></li></ol>`;
const params = new URLSearchParams(location.search);
const path = location.pathname.replace(/\/$/,'') || '/';
const content = document.getElementById('content');

function home() {
  document.title='자수정 — 나다운 지원의 시작';
  return `<section class="hero"><div class="hero-copy"><p class="eyebrow">자소서부터 면접까지, 자수정</p><h1>좋은 경험을<br><span>좋은 기회로.</span></h1><p>혼자 막혔던 문장부터 면접에서 할 이야기까지.<br>지금 나에게 필요한 준비를 찾아보세요.</p>${search()}<div class="quick-links"><span>바로 찾기</span><a href="/services?category=자소서">자소서 첨삭</a><a href="/services?category=직무%20분석">직무 분석</a><a href="/services?category=면접">면접 질문</a></div></div><div class="hero-note"><div class="note-top"><span>자수정 / 첨삭 노트</span><b>가상 예시</b></div><p class="note-before">“저는 꼼꼼한 사람입니다.”</p><span class="note-arrow">↓ 경험으로 바꿔 쓰면</span><p class="note-after">마감 항목을 <mark>체크리스트로 정리</mark>하고,<br>다음 근무자에게 공유했습니다.</p><div class="note-question"><b>이어서 준비할 질문</b><p>어떤 항목을, 왜 넣었나요?</p></div><p class="note-caption">입력 분석 결과가 아닌 서비스 이해용 예시입니다.</p></div></section>
  <nav class="category-strip" aria-label="분야별 서비스"><a href="/services"><span>전체</span><strong>서비스 둘러보기 ↗</strong></a>${categories.slice(1).map((c,i)=>`<a href="/services?category=${encodeURIComponent(c)}"><span>0${i+1}</span><strong>${c}</strong></a>`).join('')}</nav>
  <section class="section"><div class="section-heading"><div><p class="eyebrow">지금 필요한 만큼</p><h2>어떤 준비부터 시작할까요?</h2></div><a class="text-link" href="/services">전체 서비스 보기 →</a></div><div class="cards">${services.map(card).join('')}</div></section>
  <section class="workspace-banner"><div><span class="eyebrow">이미 작성한 자소서가 있다면</span><h2>보석 세공 작업실에서<br>바로 다듬어보세요.</h2><p>자소서 첨삭, 직무 연결, 면접 준비에 맞는 입력 화면을 이용할 수 있어요.</p></div><a class="button light" href="/workspace/resume">자소서 작업실 열기 ↗</a></section>
  <section class="section"><div class="section-heading"><h2>처음 이용해도, 세 단계면 충분해요.</h2><a class="text-link" href="/guide">이용 가이드 →</a></div>${steps}</section>`;
}
function listing() {
  document.title='서비스 찾기 | 자수정';
  const q=(params.get('q')||'').slice(0,100), category=categories.includes(params.get('category'))?params.get('category'):'전체';
  const results=findServices(q,category);
  return `<div class="page-intro"><p class="eyebrow">자수정 서비스</p><h1>지금 필요한 도움을 찾아보세요.</h1><p>목적에 따라 입력 자료와 결과 구성이 다른 전용 작업실을 이용할 수 있어요.</p>${search(q,category)}</div><nav class="filters" aria-label="서비스 분야">${categories.map(c=>`<a ${c===category?'aria-current="page"':''} href="/services?${new URLSearchParams({q,category:c})}">${c}</a>`).join('')}</nav><div class="results-heading"><h2>${escape(category)} 서비스</h2><span>${results.length}개${q?` · “${escape(q)}” 검색 결과`:''}</span></div>${results.length?`<div class="cards">${results.map(card).join('')}</div>`:`<div class="no-results"><h2>일치하는 서비스를 찾지 못했어요.</h2><p>검색어를 줄이거나 다른 분야를 선택해 보세요.</p><a class="button" href="/services">전체 서비스 보기</a></div>`}<p class="disclosure">현재는 로컬 체험 버전입니다. AI 연결 없이도 운영자 검토를 비공개로 접수할 수 있습니다. 결제와 외부 전문가 연결은 제공하지 않습니다.</p>`;
}
function detail(item) {
  document.title=`${item.title} | 자수정`;
  return `<nav class="breadcrumb" aria-label="현재 위치"><a href="/">홈</a><span>/</span><a href="/services">서비스</a><span>/ ${item.category}</span></nav><div class="detail-grid"><article><div class="detail-title"><span class="eyebrow">${item.category} · 운영자 검토 접수</span><h1>${item.title}</h1><p>${item.brief}</p></div>${art(item)}<section class="detail-section"><h2>이런 분께 어울려요</h2><p>${item.audience}</p></section><section class="detail-section"><h2>이 내용을 중점적으로 살펴봐요</h2><ul class="check-list">${item.outputs.map(x=>`<li>${x}</li>`).join('')}</ul><p class="disclosure">AI 분석은 연결된 환경에서만 실행됩니다. 운영자 검토는 AI 결과 없이도 비공개로 접수할 수 있습니다.</p></section><section class="detail-section"><h2>검토 방향 예시</h2><blockquote>${item.sample}</blockquote><p>자료에 없는 성과나 수치를 만들어내지 않고, 추가 확인이 필요한 부분은 질문으로 남깁니다.</p></section><section class="detail-section"><h2>시작 전 준비할 것</h2><p>${item.preparation}</p><p class="muted">불필요한 이름·연락처 등 개인정보는 빼고 입력해 주세요.</p></section><section class="detail-section"><h2>제공 범위 안내</h2><p>${item.label} 자료를 접수하면 운영자가 원문과 요청사항을 확인하고 수정본·수정 이유·보완점을 담은 리포트를 제출합니다. 완료 후 질문을 포함한 재검토를 1회 요청할 수 있습니다.</p><p>검토 예정일은 접수 후 운영자가 개별 안내합니다. 확정 소요 기간과 가격은 아직 정해지지 않았으며 결제 기능은 제공하지 않습니다.</p></section></article><aside class="start-panel"><span class="tag">로컬 체험</span><h2>${item.label} 시작하기</h2><p>${item.workspace.description}</p><dl><div><dt>입력</dt><dd>${item.workspace.sourceLabel} · ${item.workspace.contentLabel}</dd></div><div><dt>결과</dt><dd>${item.workspace.reportTitle}</dd></div><div><dt>재검토</dt><dd>완료 후 1회 요청 가능</dd></div><div><dt>소요 기간</dt><dd>운영자가 접수 후 안내</dd></div></dl><a class="button" href="/workspace/${item.id}">서비스 시작하기 →</a><a class="text-link" href="/guide">처음이라면 이용 방법 보기</a><p class="disclosure">AI 미연결 상태에서도 작업실 자료를 비공개 운영자 검토로 접수할 수 있습니다. AI 분석에는 별도 API 설정과 전송 동의가 필요합니다.</p></aside></div>`;
}
function guide() {
  document.title='이용 가이드 | 자수정';
  return `<div class="page-intro"><span class="eyebrow">자수정 사용 안내</span><h1>내 경험은 그대로.<br>전달하는 방법을 다듬으세요.</h1><p>서비스 선택부터 결과 확인까지, 처음 시작하는 분을 위한 안내입니다.</p></div>${steps}<section class="guide-grid"><div><h2>입력 전에 준비해 주세요</h2><ul class="check-list"><li>지원할 직무의 채용 공고</li><li>자소서 문항과 본인이 작성한 답변</li><li>강조하고 싶은 경험이나 점검할 부분</li></ul><a class="button" href="/services">내게 맞는 서비스 찾기</a></div><div><h2>자주 묻는 질문</h2>${[
    ['서비스마다 입력 내용이 다른가요?','네. 자소서 첨삭은 문항과 답변, 직무 연결은 경험 정리, 면접 준비는 자소서를 중심으로 입력합니다. 결과 예시와 요청서 구성도 서비스에 맞게 달라집니다.'],
    ['지금 바로 AI 첨삭을 받을 수 있나요?','운영자가 API를 설정한 환경에서만 가능합니다. AI가 연결되지 않아도 작업실에서 비공개 운영자 검토를 요청할 수 있습니다. 현재 연결 상태는 작업실에서 확인하세요.'],
    ['입력한 내용은 저장되나요?','작업실 입력은 자동 저장되지 않습니다. 운영자 검토 요청을 누르면 자료가 이 탭에 임시 보관되고, 비공개 접수 후 서버에 저장됩니다. 접수한 자료는 요청한 고객과 운영자만 확인할 수 있습니다.'],
    ['자료가 외부로 전송되나요?','실제 AI 분석을 누르면 동의한 자료가 설정된 외부 AI 서비스로 전송됩니다. 가상 샘플 보기와 첨삭 요청서 다운로드는 외부 AI 전송 없이 동작합니다.'],
    ['전문가 상담이나 결제도 가능한가요?','회원가입 후 비공개 첨삭을 접수하면 운영자가 검토합니다. 진행 상태와 최종 리포트는 마이페이지에서 확인할 수 있습니다. 결제는 아직 제공하지 않습니다.']
  ].map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div></section>`;
}
const selected=services.find(item=>path===`/services/${item.id}`);
content.innerHTML=path==='/'?home():path==='/services'?listing():path==='/guide'?guide():selected?detail(selected):'<h1>페이지를 찾을 수 없습니다.</h1><a href="/">홈으로</a>';
if(selected)content.querySelector('.detail-grid article .detail-section:nth-of-type(3)').insertAdjacentHTML('afterend',reportExample(selected));
if (path==='/board') mountBoard(content);
if (['/login','/signup','/verify','/my','/request','/operator'].includes(path)) mountPrivate(content);
setupAccountNav();
for(const link of document.querySelectorAll('.site-header nav a')) {
  if(path===link.getAttribute('href') || (selected&&link.getAttribute('href')==='/services'))link.setAttribute('aria-current','page');
}
