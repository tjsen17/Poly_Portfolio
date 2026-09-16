// 입력 형식과 길이 검사
export function validate(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('입력 형식을 확인해 주세요.');
  for (const [key, label, min, max] of [['job','채용 공고',20,12000],['essay','자소서',50,12000]]) {
    if (typeof data[key] !== 'string' || data[key].trim().length < min || data[key].length > max)
      throw new Error(`${label}는 ${min}~${max.toLocaleString()}자로 입력해 주세요.`);
  }
  if (typeof data.focus !== 'string' || data.focus.length > 1000) throw new Error('요청 사항은 1,000자 이내로 입력해 주세요.');
  return {job:data.job.trim(), essay:data.essay.trim(), focus:data.focus.trim()};
}

