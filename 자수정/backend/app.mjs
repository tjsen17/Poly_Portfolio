import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {review} from './review.mjs';
import {prompt} from './prompt.mjs';
import {validate} from './validation.mjs';
import {services} from '../frontend/platform/catalog.js';
import {createBoard} from './board.mjs';

const assets = {
  "/brand/symbol.svg": ["brand/symbol.svg", "image/svg+xml"],
  "/brand/brand.css": ["brand/brand.css", "text/css; charset=utf-8"],
  "/fonts/PretendardVariable.woff2": ["fonts/PretendardVariable.woff2", "font/woff2"],
  "/workspace": [
    "index.html",
    "text/html; charset=utf-8"
  ],
  "/style.css": [
    "style.css",
    "text/css; charset=utf-8"
  ],
  "/app.js": [
    "app.js",
    "text/javascript; charset=utf-8"
  ],
  "/api.js": [
    "api.js",
    "text/javascript; charset=utf-8"
  ],
  "/form.js": [
    "form.js",
    "text/javascript; charset=utf-8"
  ],
  "/report.js": [
    "report.js",
    "text/javascript; charset=utf-8"
  ],
  "/sample.js": [
    "sample.js",
    "text/javascript; charset=utf-8"
  ],
  "/download.js": [
    "download.js",
    "text/javascript; charset=utf-8"
  ],
  "/webmcp.js": [
    "webmcp.js",
    "text/javascript; charset=utf-8"
  ]
};
for (const path of ['/', '/board', '/services', '/guide', '/login', ...services.map(item=>`/services/${item.id}`)]) {
  assets[path] = ['platform/page.html', 'text/html; charset=utf-8'];
}
for (const file of ['platform.js', 'board.js', 'catalog.js', 'platform.css']) {
  assets[`/platform/${file}`] = [`platform/${file}`, file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8'];
}
export function createApp({key = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL, fetcher = fetch, boardFile} = {}) {
  const board = createBoard(boardFile);
  // ponytail: one local request at a time; use authenticated per-user quotas before hosting.
  let busy = false;
  return http.createServer(async (req,res) => {
    const reply = (status, data, type='application/json; charset=utf-8') => {
      res.writeHead(status, {'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
        'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});
      res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
    };
    const expectedHost = `127.0.0.1:${req.socket.localPort}`;
    if (req.headers.host !== expectedHost) return reply(403,{error:'허용되지 않은 호스트입니다.'});
    try {
      const pathname = new URL(req.url, `http://${expectedHost}`).pathname;
      if(req.method === 'GET' && Object.hasOwn(assets, pathname)) {
        const [file,type] = assets[pathname];
        return reply(200,await readFile(new URL(`../frontend/${file}`,import.meta.url)),type);
      }
      if(req.method === 'GET' && req.url === '/api/status') return reply(200,{configured:Boolean(key && model)});
      if(req.method === 'GET' && pathname === '/api/posts') return reply(200,{posts:await board.list()});
      if(req.method !== 'POST' || !['/api/review','/api/prompt','/api/posts'].includes(req.url)) return reply(404,{error:'페이지를 찾을 수 없습니다.'});
      if(req.headers.origin !== `http://${expectedHost}` || !req.headers['content-type']?.startsWith('application/json')) return reply(403,{error:'이 화면에서 다시 요청해 주세요.'});
      let size = 0; const chunks = [];
      for await(const chunk of req) {
        size += chunk.length;
        if(size > (req.url === '/api/posts' ? 300000 : 100000)) { reply(413,{error:'입력 용량이 너무 큽니다.'}); return; }
        chunks.push(chunk);
      }
      let data;
      try {data=JSON.parse(Buffer.concat(chunks).toString());if(req.url !== '/api/posts')validate(data);} catch(error) {return reply(400,{error:error instanceof SyntaxError ? '입력 형식이 올바르지 않습니다.' : error.message});}
      if(req.url === '/api/posts') {
        try {return reply(201,{post:await board.add(data)});}
        catch(error) {if(error instanceof TypeError)return reply(400,{error:error.message});throw error;}
      }
      if(req.url === '/api/prompt') return reply(200,{text:prompt(data)});
      if(data.consent !== true) return reply(400,{error:'외부 AI 전송 동의가 필요합니다.'});
      if(!key || !model) return reply(503,{error:'AI 연결 전입니다. API 키와 모델 설정이 필요합니다.'});
      if(busy) return reply(429,{error:'앞선 분석이 진행 중입니다. 완료 후 다시 요청해 주세요.'});
      busy = true;
      try {reply(200,await review(data,{key,model,fetcher}));}
      catch(error) {reply(502,{error:['TimeoutError','AbortError'].includes(error.name) ? 'AI 응답 시간이 초과되었습니다. 자동 재시도하지 않았습니다.' : error.message});}
      finally {busy=false;}
    } catch {if(!res.headersSent) reply(500,{error:'처리 중 문제가 생겼습니다. 입력은 그대로 두고 다시 확인해 주세요.'});}
  });
}
