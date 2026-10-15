export function verificationMailer({apiKey=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM,baseUrl=process.env.PUBLIC_BASE_URL,fetcher=fetch}={}){
  if(!apiKey||!from||!baseUrl)return null;
  const origin=new URL(baseUrl);
  if(origin.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(origin.hostname))throw new Error('PUBLIC_BASE_URL은 HTTPS 주소여야 합니다.');
  return async (email,token)=>{
    const link=new URL('/verify',origin);link.searchParams.set('token',token);
    const response=await fetcher('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({from,to:[email],subject:'자수정 이메일 인증',text:`자수정 회원가입을 완료하려면 아래 링크를 열어 인증해 주세요. 링크는 24시간 동안 유효합니다.\n\n${link}`}),
      signal:AbortSignal.timeout(10000)
    });
    if(!response.ok)throw new Error('인증 메일 발송 실패');
  };
}
