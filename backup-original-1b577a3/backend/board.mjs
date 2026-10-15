import {readFile, mkdir, writeFile, rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';

export function createBoard(file = fileURLToPath(new URL('../data/posts.json', import.meta.url))) {
  // ponytail: a single local server reads the whole file; use a database before multi-process hosting.
  let pending = Promise.resolve();
  async function load() {
    try { return JSON.parse(await readFile(file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }
  return {async list(){return (await load()).filter(p=>p.category!=='추가 첨삭 요청').map(({id,title,author,body,category,createdAt})=>({id,title,author,body,category,createdAt}));},async legacy(){return (await load()).filter(p=>p.category==='추가 첨삭 요청');}, async add(input) {
    const limits = {title:100, author:30, body:10000};
    if (!input || !['자유', '질문', '정보'].includes(input.category)) throw new TypeError('게시판 분류를 선택해 주세요.');
    const post = {id:randomUUID(), category:input.category, createdAt:new Date().toISOString()};
    for (const [key, limit] of Object.entries(limits)) {
      if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > limit) throw new TypeError(`${({title:'제목',author:'닉네임',body:'요청 내용',essay:'자소서 원문',aiReport:'AI 첨삭 결과'})[key]}은 공백 없이 입력하고 ${limit.toLocaleString()}자 이내로 작성해 주세요.`);
      post[key] = input[key].trim();
    }
    const saved = pending.then(async () => {
      const posts = await load();
      await mkdir(dirname(file), {recursive:true});
      await writeFile(file + '.tmp', JSON.stringify([post, ...posts]), 'utf8');
      await rename(file + '.tmp', file);
      return post;
    });
    pending = saved.catch(() => {});
    return saved;
  }};
}
