import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { get, ref, update } from 'firebase/database';
import { auth, db } from '../../firebase';
import { BALANCE_QUESTIONS } from '../data/balanceQuestions';
import ScreenShell from '../components/ScreenShell';
import { trackEvent } from '../utils/analytics';

export default function GameScreen({ route, navigation }) {
  const { questions: passedQuestions, category: passedCategory, roomId, coupleCode, mode } = route.params;

  const [questions, setQuestions]     = useState(passedQuestions ?? []);
  const [category, setCategory]       = useState(passedCategory ?? '');
  const [loading, setLoading]         = useState(!!roomId);
  const [submitting, setSubmitting]   = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [voted, setVoted]             = useState(false);
  const [voteStats, setVoteStats]     = useState({ a: 0, b: 0 });
  const [history, setHistory]         = useState([]);

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
          .map(idStr => BALANCE_QUESTIONS.find(q => q.id === Number(idStr)))
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

  // GA4: 첫 문제 렌더 시 게임 시작 이벤트
  useEffect(() => {
    if (!loading && questions.length > 0) {
      trackEvent('game_started', { category, mode: mode ?? 'solo', total_questions: questions.length });
    }
  }, [loading]);

  const currentQuestion = questions[currentIndex];

  const handleVote = (choice) => {
    if (voted) return;
    const randomA = Math.floor(Math.random() * 41) + 30;
    setVoteStats({ a: randomA, b: 100 - randomA });
    setVoted(true);
    setHistory(prev => [...prev, { questionId: currentQuestion.id, choice }]);
  };

  const handleSubmit = async (finalHistory) => {
    setSubmitting(true);
    trackEvent('partner_answers_submitted', { coupleCode });
    try {
      const partnerAnswers = finalHistory.reduce((acc, { questionId, choice }) => {
        acc[questionId] = choice;
        return acc;
      }, {});
      await update(ref(db, `couples/${coupleCode}`), {
        partnerId:      auth.currentUser?.uid ?? null,
        partnerAnswers,
        status:         'completed',
      });
      navigation.replace('Result', { coupleCode });
    } catch (e) {
      console.error('[GameScreen] 파트너 제출 실패:', e);
      navigation.replace('Result', { coupleCode });
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
      setVoted(false);
      return;
    }
    if (mode === 'partner' && coupleCode) {
      handleSubmit(history);
    } else {
      navigation.replace('Result', roomId ? { roomId, history } : { category, history });
    }
  };

  const resetButton = (
    <TouchableOpacity style={styles.resetButton} onPress={handleGoLobby}>
      <Text style={styles.resetText}>처음으로</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <ScreenShell>
        <View style={styles.loadingZone}>
          <ActivityIndicator size="large" color="#1A1A1A" />
          <Text style={styles.loadingText}>게임 불러오는 중...</Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell rightAction={resetButton} contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 진행 표시 */}
        <View style={styles.progressHeader}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${((currentIndex + 1) / questions.length) * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>{currentIndex + 1} / {questions.length}</Text>
        </View>

        {/* 카테고리 뱃지 */}
        <View style={styles.tagBadge}>
          <Text style={styles.tagText}>{currentQuestion.tag}</Text>
        </View>

        {/* 질문 */}
        <View style={styles.questionBox}>
          <Text style={styles.questionGuideText}>
            Q. {currentQuestion.criteria || '둘 중 당신의 선택은?'}
          </Text>
        </View>

        {/* 선택지 A */}
        <TouchableOpacity
          style={[styles.optionButton, styles.optionA, voted && styles.votedOption]}
          onPress={() => handleVote('A')}
          disabled={voted}
          activeOpacity={0.82}
        >
          <View style={styles.optionBadgeA}><Text style={styles.optionBadgeText}>A</Text></View>
          <Text style={styles.questionText}>{currentQuestion.questionA}</Text>
          <Text style={styles.descText}>{currentQuestion.descA}</Text>
          {voted && <Text style={styles.statTextA}>{voteStats.a}%의 선택</Text>}
        </TouchableOpacity>

        {/* VS 구분선 */}
        <View style={styles.vsRow}>
          <View style={styles.vsDivider} />
          <View style={styles.vsCircle}><Text style={styles.vsText}>VS</Text></View>
          <View style={styles.vsDivider} />
        </View>

        {/* 선택지 B */}
        <TouchableOpacity
          style={[styles.optionButton, styles.optionB, voted && styles.votedOption]}
          onPress={() => handleVote('B')}
          disabled={voted}
          activeOpacity={0.82}
        >
          <View style={styles.optionBadgeB}><Text style={styles.optionBadgeText}>B</Text></View>
          <Text style={styles.questionText}>{currentQuestion.questionB}</Text>
          <Text style={styles.descText}>{currentQuestion.descB}</Text>
          {voted && <Text style={styles.statTextB}>{voteStats.b}%의 선택</Text>}
        </TouchableOpacity>

        {/* 다음 버튼 */}
        {voted && (
          <TouchableOpacity
            style={[styles.nextButton, submitting && styles.nextButtonDisabled]}
            onPress={handleNext}
            disabled={submitting}
            activeOpacity={0.88}
          >
            <Text style={styles.nextButtonText}>
              {submitting
                ? '제출 중...'
                : currentIndex + 1 === questions.length
                  ? '모든 가치관 결과 확인 🏁'
                  : '다음 질문 ➡️'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loadingZone:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText:   { marginTop: 12, fontSize: 14, color: '#6B7280' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },

  // 진행바
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  progressBar:    { flex: 1, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  progressFill:   { height: '100%', backgroundColor: '#1A1A1A', borderRadius: 3 },
  progressText:   { fontSize: 12, fontWeight: '700', color: '#9CA3AF', minWidth: 36, textAlign: 'right' },

  // 뱃지 & 질문
  tagBadge:      { alignSelf: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginBottom: 12 },
  tagText:       { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  questionBox:   { backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, padding: 16, marginBottom: 16, alignItems: 'center' },
  questionGuideText: { fontSize: 15, fontWeight: '800', color: '#111827', textAlign: 'center', lineHeight: 24 },

  // 선택지 버튼
  optionButton:  { borderWidth: 1.5, borderRadius: 20, padding: 20, alignItems: 'center', minHeight: 120 },
  optionA:       { backgroundColor: '#FFF9F9', borderColor: '#FECDD3' },
  optionB:       { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' },
  votedOption:   { opacity: 0.88 },
  optionBadgeA:  { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 10 },
  optionBadgeB:  { backgroundColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 10 },
  optionBadgeText: { fontSize: 11, fontWeight: '800', color: '#4B5563' },
  questionText:  { fontSize: 15, fontWeight: '900', color: '#1A1A1A', textAlign: 'center', marginBottom: 6, lineHeight: 22 },
  descText:      { fontSize: 12, color: '#6B7280', textAlign: 'center', lineHeight: 18 },
  statTextA:     { fontSize: 22, fontWeight: '900', color: '#E11D48', marginTop: 10 },
  statTextB:     { fontSize: 22, fontWeight: '900', color: '#0284C7', marginTop: 10 },

  // VS 구분선 (절대좌표 없이 인라인 배치)
  vsRow:         { flexDirection: 'row', alignItems: 'center', marginVertical: -14, zIndex: 10 },
  vsDivider:     { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  vsCircle:      { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', marginHorizontal: 8 },
  vsText:        { color: '#FFF', fontSize: 10, fontWeight: '900' },

  // 다음 버튼
  nextButton:         { backgroundColor: '#1A1A1A', paddingVertical: 16, borderRadius: 16, marginTop: 20, alignItems: 'center' },
  nextButtonDisabled: { opacity: 0.5 },
  nextButtonText:     { color: '#FFF', fontSize: 15, fontWeight: '700' },

  resetButton: { position: 'absolute', right: 15, backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  resetText:   { fontSize: 11, color: '#6B7280', fontWeight: '600' },
});
