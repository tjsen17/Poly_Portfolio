import {mountBoard} from './board.js';
import {services, categories, findServices} from './catalog.js';

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const search = (q='', category='전체') => `<form class="search" action="/services" method="get" role="search"><label class="sr-only" for="q">서비스 검색</label><input id="q" name="q" maxlength="100" value="${escape(q)}" placeholder="자소서, 직무 분석, 면접… 무엇이 필요한가요?"><input type="hidden" name="category" value="${escape(category)}"><button type="submit">검색</button></form>`;
const art = item => `<div class="service-art ${item.tone}" aria-hidden="true"><span>${item.label}</span><div class="paper"><b>${item.motif}</b><strong>${item.label}</strong><i></i><i></i><i></i></div><em>${item.category==='면접'?'Q → A':'한 문장, 더 선명하게'}</em></div>`;
const card = item => `<a class="service-card" href="/services/${item.id}">${art(item)}<div class="card-copy"><span class="eyebrow">${item.category} · 자수정</span><h3>${item.title}</h3><p>${item.brief}</p><div class="card-bottom"><span>로컬 체험</span><strong>자세히 보기 ↗</strong></div></div></a>`;
const steps = `<ol class="steps"><li><span>01</span><div><h3>필요한 도움을 고르세요</h3><p>문장 첨삭, 직무 연결, 면접 준비 중 지금 필요한 목적을 선택해요.</p></div></li><li><span>02</span><div><h3>공고와 내 경험을 넣으세요</h3><p>작성한 답변과 특히 점검하고 싶은 부분을 작업실에 입력해요.</p></div></li><li><span>03</span><div><h3>검토하고, 내 말로 완성하세요</h3><p>사실과 표현을 직접 확인하고 필요한 결과를 내려받으세요.</p></div></li></ol>`;
const params = new URLSearchParams(location.search);
const path = location.pathname.replace(/\/$/,'') || '/';
const content = document.getElementById('content');

function home() {
  document.title='자수정 — 나다운 지원의 시작';
  return `<section class="hero"><div class="hero-copy"><p class="eyebrow">자소서부터 면접까지, 자수정</p><h1>좋은 경험을<br><span>좋은 기회로.</span></h1><p>혼자 막혔던 문장부터 면접에서 할 이야기까지.<br>지금 나에게 필요한 준비를 찾아보세요.</p>${search()}<div class="quick-links"><span>바로 찾기</span><a href="/services?category=자소서">자소서 첨삭</a><a href="/services?category=직무%20분석">직무 분석</a><a href="/services?category=면접">면접 질문</a></div></div><div class="hero-note"><div class="note-top"><span>문장 다음 / 첨삭 노트</span><b>가상 예시</b></div><p class="note-before">“저는 꼼꼼한 사람입니다.”</p><span class="note-arrow">↓ 경험으로 바꿔 쓰면</span><p class="note-after">마감 항목을 <mark>체크리스트로 정리</mark>하고,<br>다음 근무자에게 공유했습니다.</p><div class="note-question"><b>이어서 준비할 질문</b><p>어떤 항목을, 왜 넣었나요?</p></div><p class="note-caption">입력 분석 결과가 아닌 서비스 이해용 예시입니다.</p></div></section>
  <nav class="category-strip" aria-label="분야별 서비스"><a href="/services"><span>전체</span><strong>서비스 둘러보기 ↗</strong></a>${categories.slice(1).map((c,i)=>`<a href="/services?category=${encodeURIComponent(c)}"><span>0${i+1}</span><strong>${c}</strong></a>`).join('')}</nav>
  <section class="section"><div class="section-heading"><div><p class="eyebrow">지금 필요한 만큼</p><h2>어떤 준비부터 시작할까요?</h2></div><a class="text-link" href="/services">전체 서비스 보기 →</a></div><div class="cards">${services.map(card).join('')}</div></section>
  <section class="workspace-banner"><div><span class="eyebrow">이미 작성한 자소서가 있다면</span><h2>문장 다음 작업실에서<br>바로 다듬어보세요.</h2><p>가상 샘플 확인과 첨삭 요청서 다운로드부터 시작할 수 있어요.</p></div><a class="button light" href="/workspace">작업실 열기 ↗</a></section>
  <section class="section"><div class="section-heading"><h2>처음 이용해도, 세 단계면 충분해요.</h2><a class="text-link" href="/guide">이용 가이드 →</a></div>${steps}</section>`;
}
function listing() {
  document.title='서비스 찾기 | 자수정';
  const q=(params.get('q')||'').slice(0,100), category=categories.includes(params.get('category'))?params.get('category'):'전체';
  const results=findServices(q,category);
  return `<div class="page-intro"><p class="eyebrow">자수정 서비스</p><h1>지금 필요한 도움을 찾아보세요.</h1><p>목적에 따라 검토할 부분을 선택할 수 있어요. 모든 서비스는 같은 첨삭 작업실로 연결됩니다.</p>${search(q,category)}</div><nav class="filters" aria-label="서비스 분야">${categories.map(c=>`<a ${c===category?'aria-current="page"':''} href="/services?${new URLSearchParams({q,category:c})}">${c}</a>`).join('')}</nav><div class="results-heading"><h2>${escape(category)} 서비스</h2><span>${results.length}개${q?` · “${escape(q)}” 검색 결과`:''}</span></div>${results.length?`<div class="cards">${results.map(card).join('')}</div>`:`<div class="no-results"><h2>일치하는 서비스를 찾지 못했어요.</h2><p>검색어를 줄이거나 다른 분야를 선택해 보세요.</p><a class="button" href="/services">전체 서비스 보기</a></div>`}<p class="disclosure">현재는 로컬 체험 버전입니다. 결제나 전문가 연결은 제공하지 않습니다.</p>`;
}
function detail(item) {
  document.title=`${item.title} | 자수정`;
  return `<nav class="breadcrumb" aria-label="현재 위치"><a href="/">홈</a><span>/</span><a href="/services">서비스</a><span>/ ${item.category}</span></nav><div class="detail-grid"><article><div class="detail-title"><span class="eyebrow">${item.category} · 자수정 자체 서비스</span><h1>${item.title}</h1><p>${item.brief}</p></div>${art(item)}<section class="detail-section"><h2>이런 분께 어울려요</h2><p>${item.audience}</p></section><section class="detail-section"><h2>이 내용을 중점적으로 살펴봐요</h2><ul class="check-list">${item.outputs.map(x=>`<li>${x}</li>`).join('')}</ul><p class="disclosure">AI 출력은 매번 달라질 수 있으며, 모든 내용은 제출 전에 직접 확인해야 합니다.</p></section><section class="detail-section"><h2>검토 방향 예시</h2><blockquote>${item.sample}</blockquote><p>자료에 없는 성과나 수치를 만들어내지 않고, 추가 확인이 필요한 부분은 질문으로 남깁니다.</p></section><section class="detail-section"><h2>시작 전 준비할 것</h2><p>${item.preparation}</p><p class="muted">불필요한 이름·연락처 등 개인정보는 빼고 입력해 주세요.</p></section></article><aside class="start-panel"><span class="tag">로컬 체험</span><h2>${item.label} 시작하기</h2><p>선택한 목적이 작업실의 검토 요청에 미리 입력됩니다.</p><dl><div><dt>방식</dt><dd>공고·자소서 기반 AI 검토</dd></div><div><dt>자료</dt><dd>공고와 작성한 답변</dd></div><div><dt>결과</dt><dd>화면 확인 · 텍스트 다운로드</dd></div></dl><a class="button" href="/workspace?service=${item.id}">이 목적으로 시작하기 →</a><a class="text-link" href="/guide">처음이라면 이용 방법 보기</a><p class="disclosure">실제 분석은 API 설정과 전송 동의가 필요합니다. 미설정 상태에서는 샘플과 요청서 다운로드를 이용할 수 있습니다.</p></aside></div>`;
}
function guide() {
  document.title='이용 가이드 | 자수정';
  return `<div class="page-intro"><span class="eyebrow">자수정 사용 안내</span><h1>내 경험은 그대로.<br>전달하는 방법을 다듬으세요.</h1><p>서비스 선택부터 결과 확인까지, 처음 시작하는 분을 위한 안내입니다.</p></div>${steps}<section class="guide-grid"><div><h2>입력 전에 준비해 주세요</h2><ul class="check-list"><li>지원할 직무의 채용 공고</li><li>자소서 문항과 본인이 작성한 답변</li><li>강조하고 싶은 경험이나 점검할 부분</li></ul><a class="button" href="/services">내게 맞는 서비스 찾기</a></div><div><h2>자주 묻는 질문</h2>${[
    ['서비스마다 다른 도구인가요?','같은 첨삭 작업실을 사용합니다. 선택한 서비스에 맞는 검토 요청이 미리 입력되고, 직접 바꿀 수 있습니다.'],
    ['지금 바로 AI 첨삭을 받을 수 있나요?','운영자가 API 키와 모델을 설정한 환경에서 가능합니다. 현재 연결 상태는 작업실에서 확인할 수 있습니다. 미설정 상태에서는 가상 샘플을 보거나 첨삭 요청서를 다운로드할 수 있습니다.'],
    ['입력한 내용은 저장되나요?','이 로컬 시제품은 자소서와 결과를 별도 파일이나 브라우저 저장소에 자동 저장하지 않습니다. 페이지를 이동하거나 새로고침하기 전에 필요한 결과를 내려받으세요.'],
    ['자료가 외부로 전송되나요?','실제 AI 분석을 누르면 동의한 자료가 OpenAI로 전송됩니다. 가상 샘플 보기와 첨삭 요청서 다운로드는 외부 AI 전송 없이 동작합니다.'],
    ['전문가 상담이나 결제도 가능한가요?','현재 버전은 자수정 자체 도구를 체험하는 로컬 플랫폼입니다. 전문가 상담, 회원 계정, 결제는 아직 제공하지 않습니다.']
  ].map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div></section>`;
}
function login() {
  document.title='로그인 | 자수정';
  return `<section class="login-layout"><div class="login-intro"><span class="eyebrow">자수정 · 나다운 지원의 시작</span><h1>다음 기회를 준비하는<br>나만의 작업실.</h1><p>내 경험을 정리하고, 더 나은 문장과 답변으로.<br>자수정과 차근차근 준비해 보세요.</p><a class="text-link" href="/services">먼저 서비스 둘러보기 →</a></div><div class="login-card"><h2>로그인</h2><p class="muted">이메일로 시작하세요.</p><p id="login-notice" class="login-notice">화면 미리보기입니다. 실제 인증은 아직 연결되지 않았습니다. 실제 비밀번호는 입력하지 마세요.</p><form id="login-form" aria-describedby="login-notice"><label for="login-email">이메일</label><input id="login-email" type="email" placeholder="name@example.com" autocomplete="off" maxlength="254" required><label for="login-password">비밀번호</label><div class="password-field"><input id="login-password" type="password" autocomplete="off" placeholder="테스트용 비밀번호" maxlength="128" required><button id="password-toggle" type="button" aria-label="비밀번호 표시" aria-pressed="false">보기</button></div><button class="login-submit" type="submit">로그인</button><p id="login-message" role="status" aria-live="polite"></p></form><div class="login-alternative"><p>아직 계정이 없어도 둘러볼 수 있어요.</p><a class="text-link" href="/workspace">로그인 없이 작업실 체험하기 →</a></div></div></section>`;
}
const selected=services.find(item=>path===`/services/${item.id}`);
content.innerHTML=path==='/'?home():path==='/services'?listing():path==='/guide'?guide():path==='/login'?login():selected?detail(selected):'<h1>페이지를 찾을 수 없습니다.</h1><a href="/">홈으로</a>';
if (path==='/board') mountBoard(content);
if (path==='/login') {
  const password=document.getElementById('login-password'), toggle=document.getElementById('password-toggle');
  toggle.addEventListener('click',()=>{
    const visible=password.type==='password';
    password.type=visible?'text':'password';
    toggle.textContent=visible?'숨기기':'보기';
    toggle.setAttribute('aria-label',visible?'비밀번호 숨기기':'비밀번호 표시');
    toggle.setAttribute('aria-pressed',String(visible));
  });
  document.getElementById('login-form').addEventListener('submit',event=>{
    event.preventDefault();
    password.value='';
    document.getElementById('login-message').textContent='아직 로그인할 수 없습니다. 인증 기능은 준비 중이며 입력 내용은 서버로 전송하거나 저장하지 않았습니다.';
  });
}
for(const link of document.querySelectorAll('.site-header nav a')) {
  if(path===link.getAttribute('href') || (selected&&link.getAttribute('href')==='/services'))link.setAttribute('aria-current','page');
}
