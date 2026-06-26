import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { signInAnonymously } from 'firebase/auth';
import { get, ref, set, update } from 'firebase/database';
import { getAnonymousKey } from '@apps-in-toss/web-framework';
import { auth, db } from '../../firebase';
import { getCachedQuestionsSync } from '../utils/questionsDB';
import { registerCreatorPushConsent } from '../utils/tossNotification';
import ScreenShell from '../components/ScreenShell';
import { trackEvent } from '../utils/analytics';

export default function GameScreen({ route, navigation }) {
  const { questions: passedQuestions, category: passedCategory, roomId, coupleCode, mode } = route.params;

  const [questions, setQuestions]         = useState(passedQuestions ?? []);
  const [category, setCategory]           = useState(passedCategory ?? '');
  const [loading, setLoading]             = useState(!!roomId);
  const [submitting, setSubmitting]       = useState(false);
  const [currentIndex, setCurrentIndex]   = useState(0);
  const [voted, setVoted]                 = useState(false);
  const [selectedChoice, setSelectedChoice] = useState(null); // 'A' | 'B' | 'skipped' | null
  const [history, setHistory]             = useState([]);

  const autoAdvanceRef        = useRef(null);  // 자동 전환 타이머 ID
  const isSoloCompletingRef   = useRef(false); // 중복 완료 제출 방지 자물쇠

  const handleGoLobby = () => {
    if (typeof window !== 'undefined' && window.history) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    navigation.navigate('Lobby');
  };

  useEffect(() => {
    if (!roomId) return;
    (async () => {
      try {
        const snap = await get(ref(db, `rooms/${roomId}`));
        if (!snap.exists()) { handleGoLobby(); return; }
        const data = snap.val();
        const roomQuestions = Object.keys(data.answersA)
          .map(idStr => getCachedQuestionsSync().find(q => q.id === Number(idStr)))
          .filter(Boolean);
        setQuestions(roomQuestions);
        setCategory(data.category);
        setLoading(false);
      } catch (e) {
        console.error('Failed to load room:', e);
        handleGoLobby();
      }
    })();
  }, []);

  useEffect(() => {
    if (!loading && questions.length > 0) {
      trackEvent('game_started', { category, mode: mode ?? 'solo', total_questions: questions.length });
    }
  }, [loading]);

  // 타이머 정리
  useEffect(() => () => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
  }, []);

  const currentQuestion = questions[currentIndex];

  // ── A: 솔로 게임 완료 → couples 방 생성 → 즉시 Result 이동 ─────
  const handleSoloComplete = async (finalHistory) => {
    // 중복 실행 자물쇠 — 리렌더링으로 인한 재진입 원천 차단
    if (isSoloCompletingRef.current) return;
    isSoloCompletingRef.current = true;

    setSubmitting(true);

    // ① 코드·익명 로그인 동기 준비
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code  = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

    const creatorAnswers = finalHistory.reduce((acc, { questionId, choice }) => {
      acc[questionId] = choice; return acc;
    }, {});

    // ② Toss 해시 취득 (2초 타임아웃, 실패 시 '' 폴백 — Firebase 저장 절대 블로킹 안 함)
    let creatorTossHash = '';
    try {
      const keyResult = await Promise.race([
        getAnonymousKey(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('hash_timeout')), 2000)),
      ]);
      if (keyResult && keyResult !== 'ERROR' && keyResult?.type === 'HASH') {
        creatorTossHash = keyResult.hash ?? '';
      }
    } catch { /* 폴백: '' */ }

    // ③ Firebase 익명 로그인 (실패 시 uid = 'anon_fallback')
    let uid = 'anon_fallback';
    try {
      const { user } = await signInAnonymously(auth);
      uid = user.uid;
    } catch { /* uid 폴백 유지 */ }

    // ④ Firebase set — await로 저장 완료 확인 후 화면 이동 (fire-and-forget 제거)
    // 저장 실패 시에도 Result로 이동하되 에러 로그 기록
    try {
      await set(ref(db, `couples/${code}`), {
        creatorId:       uid,
        creatorTossHash: creatorTossHash || '',
        creatorAnswers,
        questionIds:     finalHistory.map(h => h.questionId),
        category,
        status:          'waiting',
        createdAt:       new Date().toISOString(),
      });
    } catch (e) {
      console.error('[GameScreen] Firebase 저장 실패:', e);
    }

    // ⑤ 알림 동의 요청 — fire-and-forget 유지 (게임 플로우 비차단)
    registerCreatorPushConsent(code);

    // ⑥ 저장 후 Result로 이동. 자물쇠 해제.
    isSoloCompletingRef.current = false;
    navigation.replace('Result', {
      coupleCode: code,
      isCreator:  true,
      history:    finalHistory,
      category,
    });
  };

  // ── 다음 문항으로 실제 전환 ───────────────────────────────────
  const doAdvance = (finalHistory) => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
      setVoted(false);
      setSelectedChoice(null);
    } else {
      if (mode === 'partner' && coupleCode) {
        handleSubmit(finalHistory);
      } else if (roomId) {
        navigation.replace('Result', { roomId, history: finalHistory });
      } else {
        handleSoloComplete(finalHistory);
      }
    }
  };

  // ── 답변 선택 → 강조 표시 후 700ms 자동 전환 ─────────────────
  const handleVote = (choice) => {
    if (voted) return;
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    const newHistory = [...history, { questionId: currentQuestion.id, choice }];
    setVoted(true);
    setSelectedChoice(choice);
    setHistory(newHistory);
    autoAdvanceRef.current = setTimeout(() => doAdvance(newHistory), 300);
  };

  // ── 건너뛰기 (300ms 후 전환) ──────────────────────────────────
  const handleSkip = () => {
    if (voted) return;
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    const newHistory = [...history, { questionId: currentQuestion.id, choice: 'skipped' }];
    setVoted(true);
    setSelectedChoice('skipped');
    setHistory(newHistory);
    autoAdvanceRef.current = setTimeout(() => doAdvance(newHistory), 400);
  };

  // ── 이전 문항으로 ─────────────────────────────────────────────
  // - voted=true  (선택 직후 700ms 이내): 취소하고 현재 문항 재선택 가능
  // - voted=false (아직 미선택): 직전 문항으로 이동하여 재선택 가능
  const handleBack = () => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    if (voted) {
      setVoted(false);
      setSelectedChoice(null);
      setHistory(prev => prev.slice(0, -1));
    } else {
      if (currentIndex === 0) return;
      setHistory(prev => prev.slice(0, -1));
      setCurrentIndex(prev => prev - 1);
      setVoted(false);
      setSelectedChoice(null);
    }
  };

  // ── 파트너 모드 최종 제출 ──────────────────────────────────────
  const handleSubmit = async (finalHistory) => {
    setSubmitting(true);
    trackEvent('partner_answers_submitted', { coupleCode });
    try {
      const partnerAnswers = finalHistory.reduce((acc, { questionId, choice }) => {
        acc[questionId] = choice;
        return acc;
      }, {});
      // notifyCreatorAt + status='completed' 를 동시 기록.
      // Cloud Functions 가 이 필드 변경을 감지 →
      //   couples/${coupleCode}/creatorPushToken 을 읽어 Toss Smart Delivery API 로 A에게 푸시 발송.
      // 알림 문구: "연인분이 답변을 완료했어요! 두 분의 가치관 반반 리포트를 확인해보세요."
      await update(ref(db, `couples/${coupleCode}`), {
        partnerId:        auth.currentUser?.uid ?? 'anon',
        partnerAnswers,
        status:           'completed',
        notifyCreatorAt:  new Date().toISOString(),
        // Cloud Functions 가 이 필드 변경 감지 → creatorPushToken 으로 Toss Smart Delivery 발송
        // 푸시 문구: "연인이 밸런스 게임을 완료하였습니다!"
      });
      navigation.replace('Result', { coupleCode, isPartner: true });
    } catch (e) {
      console.error('[GameScreen] 파트너 제출 실패:', e);
      navigation.replace('Result', { coupleCode, isPartner: true });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || submitting) {
    return (
      <ScreenShell>
        <View style={s.loadingZone}>
          <ActivityIndicator size="large" color="#1A1A1A" />
          <Text style={s.loadingText}>{submitting ? '결과 저장 중...' : '게임 불러오는 중...'}</Text>
        </View>
      </ScreenShell>
    );
  }

  const isASelected = selectedChoice === 'A';
  const isBSelected = selectedChoice === 'B';
  const canGoBack   = currentIndex > 0 || voted;

  return (
    <ScreenShell contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 진행 표시 */}
        <View style={s.progressHeader}>
          {canGoBack ? (
            <TouchableOpacity style={s.backBtn} onPress={handleBack} activeOpacity={0.7}>
              <Text style={s.backBtnText}>◀ 이전 질문으로</Text>
            </TouchableOpacity>
          ) : <View style={s.backBtnPlaceholder} />}
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${((currentIndex + 1) / questions.length) * 100}%` }]} />
          </View>
          <Text style={s.progressText}>{currentIndex + 1} / {questions.length}</Text>
        </View>

        {/* 카테고리 뱃지 */}
        <View style={s.tagBadge}>
          <Text style={s.tagText}>{currentQuestion.tag}</Text>
        </View>

        {/* 질문 */}
        <View style={s.questionBox}>
          <Text style={s.questionGuideText}>
            Q. {currentQuestion.criteria || '둘 중 당신의 선택은?'}
          </Text>
        </View>

        {/* 선택지 A */}
        <TouchableOpacity
          style={[
            s.optionButton, s.optionA,
            voted && !isASelected && s.optionDimmed,
            voted && isASelected  && s.optionASelected,
          ]}
          onPress={() => handleVote('A')}
          disabled={voted}
          activeOpacity={0.82}
        >
          <View style={[s.optionBadge, s.optionBadgeA, voted && isASelected && s.optionBadgeASelected]}>
            <Text style={[s.optionBadgeText, voted && isASelected && s.optionBadgeTextSelected]}>
              {isASelected ? '✓ A' : 'A'}
            </Text>
          </View>
          <Text style={[s.questionText, voted && isASelected && s.questionTextSelected]}>
            {currentQuestion.questionA}
          </Text>
          <Text style={s.descText}>{currentQuestion.descA}</Text>
        </TouchableOpacity>

        {/* VS 구분선 */}
        <View style={s.vsRow}>
          <View style={s.vsDivider} />
          <View style={s.vsCircle}><Text style={s.vsText}>VS</Text></View>
          <View style={s.vsDivider} />
        </View>

        {/* 선택지 B */}
        <TouchableOpacity
          style={[
            s.optionButton, s.optionB,
            voted && !isBSelected && s.optionDimmed,
            voted && isBSelected  && s.optionBSelected,
          ]}
          onPress={() => handleVote('B')}
          disabled={voted}
          activeOpacity={0.82}
        >
          <View style={[s.optionBadge, s.optionBadgeB, voted && isBSelected && s.optionBadgeBSelected]}>
            <Text style={[s.optionBadgeText, voted && isBSelected && s.optionBadgeTextSelected]}>
              {isBSelected ? '✓ B' : 'B'}
            </Text>
          </View>
          <Text style={[s.questionText, voted && isBSelected && s.questionTextSelected]}>
            {currentQuestion.questionB}
          </Text>
          <Text style={s.descText}>{currentQuestion.descB}</Text>
        </TouchableOpacity>

        {/* 건너뛰기 버튼 (미선택 상태에서만) */}
        {!voted && (
          <TouchableOpacity style={s.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
            <Text style={s.skipBtnText}>이 질문은 건너뛰기</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const s = StyleSheet.create({
  loadingZone:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText:   { marginTop: 12, fontSize: 14, color: '#6B7280' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },

  // 진행바 + 이전 버튼
  progressHeader:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  backBtn:             { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#F3F4F6' },
  backBtnText:         { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  backBtnPlaceholder:  { width: 54 },
  progressBar:         { flex: 1, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  progressFill:        { height: '100%', backgroundColor: '#1A1A1A', borderRadius: 3 },
  progressText:        { fontSize: 12, fontWeight: '700', color: '#9CA3AF', minWidth: 36, textAlign: 'right' },

  // 뱃지 & 질문
  tagBadge:          { alignSelf: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginBottom: 12 },
  tagText:           { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  questionBox:       { backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, padding: 16, marginBottom: 16, alignItems: 'center' },
  questionGuideText: { fontSize: 15, fontWeight: '800', color: '#111827', textAlign: 'center', lineHeight: 24, wordBreak: 'keep-all', overflowWrap: 'break-word' },

  // 선택지 공통
  optionButton:  { borderWidth: 1.5, borderRadius: 20, padding: 20, alignItems: 'center', minHeight: 120 },
  optionDimmed:  { opacity: 0.4 },

  // A 기본 / 선택됨
  optionA:         { backgroundColor: '#FFF9F9', borderColor: '#FECDD3' },
  optionASelected: {
    backgroundColor: '#FFF1F2', borderColor: '#E11D48', borderWidth: 3,
    shadowColor: '#E11D48', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22, shadowRadius: 10, elevation: 5,
  },

  // B 기본 / 선택됨
  optionB:         { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' },
  optionBSelected: {
    backgroundColor: '#EFF6FF', borderColor: '#2563EB', borderWidth: 3,
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22, shadowRadius: 10, elevation: 5,
  },

  // 뱃지
  optionBadge:         { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 10 },
  optionBadgeA:        { backgroundColor: '#FEE2E2' },
  optionBadgeB:        { backgroundColor: '#DBEAFE' },
  optionBadgeASelected: { backgroundColor: '#E11D48' },
  optionBadgeBSelected: { backgroundColor: '#2563EB' },
  optionBadgeText:      { fontSize: 11, fontWeight: '800', color: '#4B5563' },
  optionBadgeTextSelected: { color: '#FFFFFF' },

  questionText:         { fontSize: 15, fontWeight: '900', color: '#1A1A1A', textAlign: 'center', marginBottom: 6, lineHeight: 22, wordBreak: 'keep-all', overflowWrap: 'break-word' },
  questionTextSelected: { color: '#1A1A1A' },
  descText:             { fontSize: 12, color: '#6B7280', textAlign: 'center', lineHeight: 18, wordBreak: 'keep-all', overflowWrap: 'break-word' },

  // VS 구분선
  vsRow:    { flexDirection: 'row', alignItems: 'center', marginVertical: -14, zIndex: 10 },
  vsDivider: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  vsCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', marginHorizontal: 8 },
  vsText:   { color: '#FFF', fontSize: 10, fontWeight: '900' },

  // 건너뛰기 버튼
  skipBtn:     { marginTop: 20, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  skipBtnText: { fontSize: 13, color: '#9CA3AF', fontWeight: '600', textDecorationLine: 'underline' },
});
