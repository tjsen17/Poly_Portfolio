const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories = ['전체', '자유', '질문', '정보', '추가 첨삭 요청'];
const date = value => new Date(value).toLocaleDateString('ko-KR');

export async function mountBoard(content) {
  document.title = '게시판 | 자수정';
  const params = new URLSearchParams(location.search);
  const q = (params.get('q') || '').slice(0,100);
  const category = categories.includes(params.get('category')) ? params.get('category') : '전체';
  let reviewRequest = category === '추가 첨삭 요청';
  const back = `/board?${new URLSearchParams({q,category})}`;
  content.innerHTML = `<section class="page-intro"><p class="eyebrow">자수정 커뮤니티</p><h1>함께 준비하는 다음 기회.</h1><p>막히는 문장은 질문하고, 도움이 된 경험은 나누세요.</p><p class="disclosure">로컬 게시판 · 이 서버에 저장됩니다. 닉네임은 인증되지 않습니다.</p></section><div id="board-view" aria-live="polite">게시글을 불러오고 있습니다.</div>`;
  const view = document.getElementById('board-view');
  if (params.get('write') === '1') {
    view.innerHTML = `<a class="text-link" href="${escape(back)}">← 게시판으로</a><form id="post-form" class="board-form"><h2>${reviewRequest?'운영자에게 추가 첨삭 요청':'새 글 작성'}</h2><div class="board-fields"><label>분류<select name="category">${categories.slice(1).map(c=>`<option ${c===category?'selected':''}>${c}</option>`).join('')}</select></label><label>닉네임<input name="author" maxlength="30" required autocomplete="nickname"></label></div><label>제목<input name="title" maxlength="100" required placeholder="어떤 이야기를 나누고 싶나요?"></label><label><span id="body-label">${reviewRequest?'추가로 봐줬으면 하는 부분':'내용'}</span><textarea name="body" rows="12" maxlength="10000" required placeholder="질문이나 경험을 자유롭게 적어 주세요."></textarea></label><fieldset id="review-fields" ${reviewRequest?'':'hidden disabled'}><legend>추가 첨삭 자료</legend><label>자소서 원문<textarea name="essay" rows="8" maxlength="12000" required></textarea></label><label>AI 첨삭 결과<textarea name="aiReport" rows="8" maxlength="20000" required></textarea></label><p class="login-notice">원문과 AI 결과는 게시판 열람자 모두에게 공개됩니다. 운영자만 보는 비공개 요청이 아닙니다. 로컬 저장만 지원하며 운영자 알림·답변은 아직 연결되지 않았습니다.</p><label class="request-consent"><input type="checkbox" name="publicConsent" required>개인정보를 제거했으며 원문·AI 결과의 게시판 공개에 동의합니다.</label></fieldset><p class="muted">연락처 등 개인정보는 제외해 주세요. 등록 후 수정·삭제는 아직 지원하지 않습니다.</p><div class="board-actions"><button type="submit">${reviewRequest?'추가 첨삭 요청 등록':'게시글 등록'}</button><a href="${escape(back)}">취소</a></div><p id="post-error" role="alert"></p></form>`;
    const form = document.getElementById('post-form');
    let dirty = false;
    let draftLoaded = false;
    function updateCategory() {
      reviewRequest = form.elements.category.value === '추가 첨삭 요청';
      const fields = document.getElementById('review-fields');
      fields.hidden = fields.disabled = !reviewRequest;
      form.querySelector('h2').textContent = reviewRequest ? '운영자에게 추가 첨삭 요청' : '새 글 작성';
      form.querySelector('button').textContent = reviewRequest ? '추가 첨삭 요청 등록' : '게시글 등록';
      document.getElementById('body-label').textContent = reviewRequest ? '추가로 봐줬으면 하는 부분' : '내용';
      if (!reviewRequest || draftLoaded) return;
      draftLoaded = true;
      try {
        const draft = JSON.parse(sessionStorage.getItem('jasujeong-review-draft') || 'null');
        if (draft && typeof draft.essay === 'string' && typeof draft.aiReport === 'string') {
          form.elements.essay.value = draft.essay;
          form.elements.aiReport.value = draft.aiReport;
          dirty = true;
        }
      } catch { document.getElementById('post-error').textContent='임시 자료를 읽지 못했습니다. 원문과 AI 결과를 직접 입력해 주세요.'; }
    }
    updateCategory();
    form.elements.category.addEventListener('change',updateCategory);
    form.addEventListener('input',()=>{dirty=true;});
    window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const button = form.querySelector('button');
      const error = document.getElementById('post-error');
      button.disabled = true; error.textContent = '';
      try {
        const response = await fetch('/api/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...Object.fromEntries(new FormData(form)),publicConsent:reviewRequest && form.elements.publicConsent.checked===true})});
        const data = await response.json();
        if(!response.ok)throw new Error(data.error || '게시글을 저장하지 못했습니다.');
        if (reviewRequest) { try {sessionStorage.removeItem('jasujeong-review-draft');} catch {} }
        dirty = false;
        location.assign(`/board?id=${encodeURIComponent(data.post.id)}`);
      } catch(failure) {error.textContent = `${failure.message} 입력 내용은 유지됩니다.`;button.disabled=false;}
    });
    return;
  }
  try {
    const response = await fetch('/api/posts');
    if(!response.ok)throw new Error('게시글을 불러오지 못했습니다.');
    const {posts} = await response.json();
    if(params.has('id')) {
      const post = posts.find(item=>item.id===params.get('id'));
      document.title = post ? `${post.title} | 자수정 게시판` : '글을 찾을 수 없습니다 | 자수정';
      view.innerHTML = `<a class="text-link" href="${escape(back)}">← 목록으로</a>${post ? `<article class="board-detail"><span class="tag">${escape(post.category)}</span><h2>${escape(post.title)}</h2><p class="muted">${escape(post.author)} · ${date(post.createdAt)}</p><div class="board-body">${escape(post.body)}</div>${post.category==='추가 첨삭 요청'?`<p class="tag">${escape(post.status)} · 로컬 저장</p><h3>자소서 원문</h3><div class="board-body">${escape(post.essay)}</div><h3>AI 첨삭 결과</h3><div class="board-body">${escape(post.aiReport)}</div>`:''}</article>` : '<div class="no-results"><h2>글을 찾을 수 없습니다.</h2><p>목록에서 게시글을 다시 선택해 주세요.</p></div>'}`;
      return;
    }
    const results = posts.filter(post=>(category==='전체'||post.category===category)&&`${post.title} ${post.body} ${post.author}`.toLocaleLowerCase().includes(q.trim().toLocaleLowerCase()));
    view.innerHTML = `<section class="review-request-banner"><div><h2>AI 첨삭 다음, 운영자의 시선이 필요하다면.</h2><p>원문과 AI 결과를 첨부하고 추가로 점검받고 싶은 부분을 남겨 주세요.</p><p class="muted">현재는 공개 요청 게시글 저장 단계입니다. 운영자 알림·답변은 준비 중입니다.</p></div><a class="button" href="/board?write=1&amp;category=추가%20첨삭%20요청">추가 첨삭 요청하기 →</a></section><div class="board-toolbar"><form class="search" action="/board" role="search"><label for="board-q" class="sr-only">게시글 검색</label><input id="board-q" name="q" maxlength="100" value="${escape(q)}" placeholder="제목, 내용, 닉네임으로 검색"><input type="hidden" name="category" value="${category}"><button>검색</button></form><a class="button" href="/board?write=1">글쓰기 ↗</a></div><nav class="filters" aria-label="게시판 분류">${categories.map(c=>`<a href="/board?${escape(new URLSearchParams({q,category:c}))}" ${c===category?'aria-current="page"':''}>${c}</a>`).join('')}</nav><div class="results-heading"><h2>${category} 게시글</h2><span>${results.length}개의 이야기 · 최신순</span></div>${results.length ? `<ul class="board-list">${results.map(post=>`<li><a href="${escape(back)}&amp;id=${encodeURIComponent(post.id)}"><span class="tag">${escape(post.category)}${post.status?` · ${escape(post.status)}`:''}</span><div><h3>${escape(post.title)}</h3><p>${escape(post.body.slice(0,100))}</p><span class="muted">${escape(post.author)} · ${date(post.createdAt)}</span></div><span aria-hidden="true">↗</span></a></li>`).join('')}</ul>` : `<div class="no-results"><h2>${posts.length?'일치하는 글이 없어요.':'첫 번째 이야기를 기다리고 있어요.'}</h2><p>${posts.length?'다른 검색어나 분류를 선택해 보세요.':'취업 준비 중 궁금한 점이나 나누고 싶은 경험을 적어 보세요.'}</p><a class="button" href="${posts.length?'/board':'/board?write=1'}">${posts.length?'전체 글 보기':'첫 글 작성하기'}</a></div>`}`;
  } catch(error) {view.innerHTML=`<div class="no-results"><h2>${escape(error.message)}</h2><a href="${escape(location.pathname+location.search)}" class="button">다시 시도</a></div>`;}
}
