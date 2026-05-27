// api/neis/meal.js — 급식 (나이스 공개 API 프록시)
const ATPT_OFCDC_SC_CODE = 'B10';        // 서울특별시교육청
const SD_SCHUL_CODE = '7010084';         // 서울과학고등학교
const MEAL_TYPE = { '1': '아침', '2': '점심', '3': '저녁' };

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const KEY = process.env.NEIS_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'NEIS_API_KEY 환경변수가 없습니다' });

  const url = new URL('https://open.neis.go.kr/hub/mealServiceDietInfo');
  url.searchParams.set('KEY', KEY);
  url.searchParams.set('Type', 'json');
  url.searchParams.set('pSize', '100');
  url.searchParams.set('ATPT_OFCDC_SC_CODE', ATPT_OFCDC_SC_CODE);
  url.searchParams.set('SD_SCHUL_CODE', SD_SCHUL_CODE);

  // date=YYYYMMDD (하루) | from&to (기간) | 기본=오늘
  if (req.query.from && req.query.to) {
    url.searchParams.set('MLSV_FROM_YMD', req.query.from);
    url.searchParams.set('MLSV_TO_YMD', req.query.to);
  } else {
    const t = new Date();
    const today = `${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, '0')}${String(t.getDate()).padStart(2, '0')}`;
    url.searchParams.set('MLSV_YMD', req.query.date || today);
  }

  try {
    const r = await fetch(url.toString());
    const data = await r.json();

    if (data.RESULT) {
      if (data.RESULT.CODE === 'INFO-200') return res.status(200).json({ meals: [] }); // 데이터 없음
      return res.status(400).json({ error: data.RESULT.MESSAGE, code: data.RESULT.CODE });
    }

    const rows = data.mealServiceDietInfo?.[1]?.row || [];
    const meals = rows.map((row) => ({
      date: row.MLSV_YMD,                    // YYYYMMDD
      type: row.MMEAL_SC_CODE,               // '1' | '2' | '3'
      typeName: MEAL_TYPE[row.MMEAL_SC_CODE] || row.MMEAL_SC_NM,
      dishes: row.DDISH_NM
        .split('<br/>')
        .map((s) => s.replace(/\s*\(.*?\)/g, '').trim())  // 알레르기 번호 (1.2.) 제거
        .filter(Boolean),
      calorie: row.CAL_INFO || '',
    }));

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({ meals });
  } catch (err) {
    console.error('[neis/meal] error:', err);
    return res.status(500).json({ error: err.message });
  }
}