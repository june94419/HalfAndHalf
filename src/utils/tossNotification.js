import { Platform } from 'react-native';
import { requestNotificationAgreement, getAnonymousKey } from '@apps-in-toss/web-framework';
import { ref, update } from 'firebase/database';
import { db } from '../../firebase';

// ── 토스 콘솔 > 스마트발송 캠페인 코드 ────────────────────────────────────
// 정식 출시 후 templateCode 발급 시 교체
export const TOSS_TEMPLATE_CODE = 'halfandhalf-BANBAN_PARTNER_COMPLETE';

const LOCAL_KEY = 'banban_toss_hash';

function saveTossHashLocally(hash) {
  try { localStorage.setItem(LOCAL_KEY, hash); } catch {}
}

export function loadTossHashLocally() {
  try { return localStorage.getItem(LOCAL_KEY) ?? null; } catch { return null; }
}

/**
 * [User A] 로비 진입 시 호출
 *
 * 1. requestNotificationAgreement → 토스 알림 동의 팝업 (신규 동의 / 기존 동의 모두 처리)
 * 2. 동의 완료 시 getAnonymousKey() → localStorage 임시 보관
 * 3. coupleCode 확정 후 persistTossHashToCoupleDB()로 DB에 영구 저장
 *
 * templateCode가 아직 검토 중이어도 onError 에서 조용히 무시하므로 앱 크래시 없음.
 *
 * @returns {() => void} 브릿지 리스너 cleanup 함수
 */
export function initTossNotificationConsent() {
  if (Platform.OS !== 'web') return () => {};

  let cleanup = () => {};
  try {
    cleanup = requestNotificationAgreement({
      options: { templateCode: TOSS_TEMPLATE_CODE },
      onEvent: async ({ type }) => {
        if (type === 'agreementRejected') return;
        try {
          const result = await getAnonymousKey();
          if (result && result !== 'ERROR' && result.type === 'HASH') {
            saveTossHashLocally(result.hash);
          }
        } catch {}
      },
      onError: () => {},
    });
  } catch {}

  return cleanup;
}

/**
 * [User A] 커플 방 생성 직후 호출 (ResultScreen.handleTossShare)
 *
 * localStorage에 보관된 tossHash를 Firebase couples 엔트리에 영구 저장한다.
 * User B 제출 완료 시 이 값을 읽어 스마트발송 트리거에 활용한다.
 */
export async function persistTossHashToCoupleDB(coupleCode) {
  const hash = loadTossHashLocally();
  if (!hash || !coupleCode) return;
  try {
    await update(ref(db, `couples/${coupleCode}`), {
      creatorTossHash: hash,
      creatorNotificationAgreed: true,
    });
  } catch {}
}

/**
 * [User A] 20문항 완료 직후 호출 (GameScreen.handleSoloComplete)
 *
 * 알림 동의 팝업을 띄우고, 동의 시 Toss 익명 해시(Smart Delivery 발송 타겟 ID)를
 * Firebase `couples/${coupleCode}/creatorPushToken` 에 저장한다.
 *
 * 실제 푸시 발송은 Cloud Functions 가 `notifyCreatorAt` 필드 변경을 감지해서 처리한다.
 * (Toss SDK 는 클라이언트에서 직접 push 발송 API 를 제공하지 않음)
 *
 * fire-and-forget: 동의 여부와 무관하게 게임 플로우를 차단하지 않는다.
 */
export function registerCreatorPushConsent(coupleCode) {
  if (Platform.OS !== 'web') return;
  try {
    requestNotificationAgreement({
      options: { templateCode: TOSS_TEMPLATE_CODE },
      onEvent: async ({ type }) => {
        if (type === 'agreementRejected') return;
        try {
          const result = await getAnonymousKey();
          if (result && result !== 'ERROR' && result.type === 'HASH') {
            update(ref(db, `couples/${coupleCode}`), {
              creatorPushToken:           result.hash,
              creatorNotificationAgreed:  true,
            }).catch(() => {});
          }
        } catch {}
      },
      onError: () => {},
    });
  } catch {}
}
