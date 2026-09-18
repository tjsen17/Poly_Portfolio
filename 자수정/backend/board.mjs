import {readFile, mkdir, writeFile, rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';

export function createBoard(file = fileURLToPath(new URL('../data/posts.json', import.meta.url))) {
  // ponytail: a single local server reads the whole file; use a database before multi-process hosting.
  let pending = Promise.resolve();
  async function list() {
    try { return JSON.parse(await readFile(file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }
  return {list, async add(input) {
    const limits = {title:100, author:30, body:10000};
    if (!input || !['자유', '질문', '정보', '추가 첨삭 요청'].includes(input.category)) throw new TypeError('게시판 분류를 선택해 주세요.');
    if (input.category === '추가 첨삭 요청') {
      if (input.publicConsent !== true) throw new TypeError('원문과 AI 결과의 게시판 공개에 동의해 주세요.');
      Object.assign(limits, {essay:12000, aiReport:20000});
    }
    const post = {id:randomUUID(), category:input.category, createdAt:new Date().toISOString()};
    for (const [key, limit] of Object.entries(limits)) {
      if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > limit) throw new TypeError(`${({title:'제목',author:'닉네임',body:'요청 내용',essay:'자소서 원문',aiReport:'AI 첨삭 결과'})[key]}은 공백 없이 입력하고 ${limit.toLocaleString()}자 이내로 작성해 주세요.`);
      post[key] = input[key].trim();
    }
    if (input.category === '추가 첨삭 요청') post.status = '접수 대기';
    const saved = pending.then(async () => {
      const posts = await list();
      await mkdir(dirname(file), {recursive:true});
      await writeFile(file + '.tmp', JSON.stringify([post, ...posts]), 'utf8');
      await rename(file + '.tmp', file);
      return post;
    });
    pending = saved.catch(() => {});
    return saved;
  }};
}
