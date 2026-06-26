import { ref, get, set } from 'firebase/database';
import { db } from '../../firebase';
import { BALANCE_QUESTIONS } from '../data/balanceQuestions';

let _cache = null;
let _inflight = null;

const READ_TIMEOUT_MS = 5000;
const ts = () => new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm 타임스탬프

// 캐시된 질문 동기 반환 — 캐시 미스 시 로컬 데이터 폴백 (항상 유효한 배열 반환)
export function getCachedQuestionsSync() {
  return _cache ?? BALANCE_QUESTIONS;
}

/**
 * Firebase /questions 로드. 없으면 최초 시드.
 *
 * 방어 설계:
 * - get()에 5초 타임아웃: 네트워크 무응답 → 즉시 로컬 폴백
 * - 시드는 fire-and-forget: set() 완료 대기 없이 즉시 로컬 캐시 사용
 * - JSON.parse(JSON.stringify()) 정제: undefined 필드 제거 → Firebase 거부 방지
 * - 어떤 경로로 실패해도 _cache = BALANCE_QUESTIONS 보장 → 로딩 화면 가둠 불가
 */
export function loadQuestions() {
  if (_cache) {
    console.log(`[${ts()}][questionsDB] ✅ 캐시 히트: ${_cache.length}개`);
    return Promise.resolve(_cache);
  }
  if (_inflight) {
    console.log(`[${ts()}][questionsDB] ⏳ inflight 재사용 (중복 호출)`);
    return _inflight;
  }

  console.log(`[${ts()}][questionsDB] 🚀 Firebase /questions 읽기 시작`);
  _inflight = (async () => {
    try {
      // ① 5초 타임아웃 경쟁
      const snap = await Promise.race([
        get(ref(db, 'questions')),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error('read_timeout')), READ_TIMEOUT_MS)
        ),
      ]);

      if (snap.exists()) {
        // ② Firebase 데이터 정상 수신
        const raw = snap.val();
        _cache = Object.values(raw);
        const dist = _cache.reduce((a, q) => { a[q.type] = (a[q.type] ?? 0) + 1; return a; }, {});
        console.log(`[${ts()}][questionsDB] ✅ Firebase 수신: ${_cache.length}개 | 카테고리:`, JSON.stringify(dist));
      } else {
        // ③ 비어있음 → fire-and-forget 시드
        console.log(`[${ts()}][questionsDB] ⚠ /questions 비어있음 → 시드 트리거`);
        const obj = {};
        BALANCE_QUESTIONS.forEach(q => {
          try { obj[String(q.id)] = JSON.parse(JSON.stringify(q)); } catch {}
        });
        set(ref(db, 'questions'), obj).catch(e =>
          console.warn(`[${ts()}][questionsDB] 시드 실패:`, e?.message)
        );
        _cache = BALANCE_QUESTIONS;
        console.log(`[${ts()}][questionsDB] 로컬 캐시 적재: ${_cache.length}개`);
      }
    } catch (e) {
      // ④ 타임아웃 또는 오류 → 로컬 강제 폴백
      console.warn(`[${ts()}][questionsDB] ❌ 오류 → 로컬 폴백 (${e?.message})`);
      _cache = BALANCE_QUESTIONS;
    }

    _inflight = null;
    console.log(`[${ts()}][questionsDB] 반환: ${_cache?.length ?? 0}개`);
    return _cache; // 항상 유효한 배열 (절대 null 불가)
  })();

  return _inflight;
}

// 카테고리별 20개 무작위 추출 — allQuestions가 null이어도 안전
export function pickQuestions(allQuestions, type) {
  const src = allQuestions ?? BALANCE_QUESTIONS;
  const filtered = src.filter(q => q.type === type);
  console.log(`[${ts()}][questionsDB] pickQuestions('${type}'): 전체 ${src.length}개 중 ${filtered.length}개 필터`);
  return [...filtered].sort(() => Math.random() - 0.5).slice(0, 20);
}

// questionIds 배열 순서로 질문 객체 복원
export function getQuestionsByIds(allQuestions, ids) {
  const src = allQuestions ?? BALANCE_QUESTIONS;
  const map = {};
  src.forEach(q => { map[q.id] = q; });
  return ids.map(id => map[Number(id)]).filter(Boolean);
}
