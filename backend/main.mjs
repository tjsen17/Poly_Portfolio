// 서버 실행 진입점: 프로젝트 루트에서 실행하세요.
import {createApp} from './app.mjs';

const server = createApp();
server.on('error', error => {
  console.error(`시작 실패: ${error.code}`);
  process.exitCode = 1;
});
server.listen(4317, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4317'));
