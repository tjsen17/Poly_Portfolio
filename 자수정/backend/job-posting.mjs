import http from 'node:http';
import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';

function publicIPv4(address){
  const [a,b,c]=address.split('.').map(Number);
  return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===88&&c===99)||a===100&&b>=64&&b<=127||a===198&&b>=18&&b<=19||a===198&&b===51&&c===100||a===203&&b===0&&c===113);
}

function decodeEntities(text){
  return text.replace(/&#(x[\da-f]+|\d+);?/gi,(_,code)=>String.fromCodePoint(parseInt(code[0].toLowerCase()==='x'?code.slice(1):code,code[0].toLowerCase()==='x'?16:10))).replace(/&(nbsp|amp|lt|gt|quot|#39);/gi,(_,name)=>({nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"})[name.toLowerCase()]);
}

export async function fetchJobPosting(rawUrl, redirects=0){
  if(typeof rawUrl!=='string' || rawUrl.length>2000)throw new Error('공고 링크를 확인해 주세요.');
  let url;try{url=new URL(rawUrl);}catch{throw new Error('올바른 공고 링크를 입력해 주세요.');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port||isIP(url.hostname)||!url.hostname.includes('.')||url.hostname.endsWith('.local'))throw new Error('공개된 채용 공고 링크만 사용할 수 있습니다.');
  const addresses=await lookup(url.hostname,{family:4,all:true});
  if(!addresses.length||addresses.some(({address})=>!publicIPv4(address)))throw new Error('접근할 수 없는 공고 주소입니다.');
  const address=addresses[0].address;
  const response=await new Promise((resolve,reject)=>{
    const request=(url.protocol==='https:'?https:http).get(url,{lookup:(_hostname,options,callback)=>options.all?callback(null,[{address,family:4}]):callback(null,address,4),headers:{'User-Agent':'Jasujeong/1.0 (+job-posting-import)','Accept':'text/html,text/plain','Accept-Encoding':'identity'},timeout:8000},res=>{
      const chunks=[];let size=0;
      res.on('data',chunk=>{size+=chunk.length;if(size>250000){request.destroy(new Error('공고 페이지가 너무 큽니다.'));return;}chunks.push(chunk);});
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
      res.on('error',reject);
    });
    request.on('timeout',()=>request.destroy(new Error('공고 페이지 응답 시간이 초과됐습니다.')));
    request.on('error',reject);
  });
  if(response.status>=300&&response.status<400&&response.headers.location){
    if(redirects>=2)throw new Error('공고 링크의 이동 횟수가 너무 많습니다.');
    return fetchJobPosting(new URL(response.headers.location,url).href,redirects+1);
  }
  if(response.status!==200)throw new Error('공고 페이지에 접근하지 못했습니다. 아래 입력란에 직접 붙여 넣어 주세요.');
  const type=response.headers['content-type']||'';
  if(!/^text\/(html|plain)/i.test(type))throw new Error('텍스트 공고 페이지만 가져올 수 있습니다.');
  if(response.headers['content-encoding']&&!/^identity$/i.test(response.headers['content-encoding']))throw new Error('압축된 공고 페이지를 읽지 못했습니다. 아래에 직접 붙여 넣어 주세요.');
  const charset=type.match(/charset=([^;\s]+)/i)?.[1]||'utf-8';
  let html;try{html=new TextDecoder(charset).decode(response.body);}catch{html=response.body.toString('utf8');}
  const source=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]||html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]||html;
  const text=decodeEntities(source.replace(/<(script|style|noscript|svg|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<br\s*\/?\s*>|<\/(p|div|li|h[1-6]|section)>/gi,'\n').replace(/<[^>]+>/g,' ')).replace(/[\t \r]+/g,' ').replace(/\n\s*\n+/g,'\n').trim();
  if(text.length<20)throw new Error('공고 본문을 읽지 못했습니다. 아래 입력란에 직접 붙여 넣어 주세요.');
  return text.slice(0,12000);
}
