// api/neis/calendar.js
// 서울과학고 학사일정 — 나이스 공개 API 프록시 (사용자 토큰 불필요)

const ATPT_OFCDC_SC_CODE = 'B10';        // 서울특별시교육청
const SD_SCHUL_CODE = '7010084';         // 서울과학고등학교

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const KEY = process.env.NEIS_API_KEY;
  if (!KEY) {
    return res.status(500).json({ error: 'NEIS_API_KEY 환경변수가 없습니다' });
  }

  // 조회 기간: 쿼리로 받거나 기본값 = 올해 1년치
  const year = new Date().getFullYear();
  const from = req.query.from || `${year}0101`;
  const to = req.query.to || `${year}1231`;

  const url = new URL('https://open.neis.go.kr/hub/SchoolSchedule');
  url.searchParams.set('KEY', KEY);
  url.searchParams.set('Type', 'json');
  url.searchParams.set('pIndex', '1');
  url.searchParams.set('pSize', '1000');
  url.searchParams.set('ATPT_OFCDC_SC_CODE', ATPT_OFCDC_SC_CODE);
  url.searchParams.set('SD_SCHUL_CODE', SD_SCHUL_CODE);
  url.searchParams.set('AA_FROM_YMD', from);
  url.searchParams.set('AA_TO_YMD', to);

  try {
    const r = await fetch(url.toString());
    const data = await r.json();

    // 나이스는 데이터 없어도 200 OK + RESULT 코드로 알려줌
    if (data.RESULT) {
      if (data.RESULT.CODE === 'INFO-200') {
        return res.status(200).json({ events: [] }); // 데이터 없음 = 정상
      }
      // 그 외 = 진짜 에러 (키 틀림 / 학교코드 틀림 등)
      return res.status(400).json({ error: data.RESULT.MESSAGE, code: data.RESULT.CODE });
    }

    const rows = data.SchoolSchedule?.[1]?.row || [];
    const events = rows.map((row) => ({
      date: row.AA_YMD,                 // YYYYMMDD
      name: row.EVENT_NM,               // 행사명
      content: row.EVENT_CNTNT || '',   // 행사내용
    }));

    // 학사일정은 자주 안 바뀌니 1시간 캐싱 (나이스 호출 절약)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({ events });

  } catch (err) {
    console.error('[neis/calendar] error:', err);
    return res.status(500).json({ error: err.message });
  }
}