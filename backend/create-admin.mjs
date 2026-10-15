import {createPrivateStore} from './private.mjs';
import {createInterface} from 'node:readline/promises';
if(!process.stdin.isTTY){console.error('대화형 터미널에서 npm run create-admin을 실행하세요.');process.exit(1);}
const prompt=createInterface({input:process.stdin,output:process.stdout});
const email=await prompt.question('운영자 이메일: '),name=await prompt.question('운영자 표시 이름: ');prompt.close();
process.stdout.write('비밀번호 (10자 이상, 입력 숨김): ');process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
const password=await new Promise((resolve,reject)=>{let value='';function read(chunk){for(const char of chunk){if(char==='\u0003'){process.stdin.off('data',read);reject(new Error('취소했습니다.'));return;}if(char==='\r'||char==='\n'){process.stdin.off('data',read);resolve(value);return;}if(char==='\u007f'||char==='\b')value=value.slice(0,-1);else if(char>=' '&&value.length<128)value+=char;}}process.stdin.on('data',read);}).finally(()=>{process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');});
try{await createPrivateStore().register({email,name,password},'operator');console.log('운영자 계정을 만들었습니다. /login에서 로그인하세요.');}catch(error){console.error(error.message);process.exitCode=1;}
