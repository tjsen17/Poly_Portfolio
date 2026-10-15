// 서버 API 통신
export async function post(path,input){const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const result=await response.json();if(!response.ok)throw new Error(result.error || '요청에 실패했습니다.');return result;}
