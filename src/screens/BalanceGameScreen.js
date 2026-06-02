import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Easing, ScrollView, Platform,
} from 'react-native';
import { db } from '../../firebase';
import { ref, onValue, runTransaction } from 'firebase/database';
import AdBanner from '../components/AdBanner';

// ── 카테고리 설정 ─────────────────────────────────────────────────
const CATEGORY_CONFIG = {
  연인: { emoji: '💕', label: '연인', sub: '커플 데이트 밸런스 게임', color: '#D6407A', bg: '#FFF0F6', light: '#FFF7FB' },
  친구: { emoji: '🤝', label: '친구', sub: '친구와 함께하는 밸런스 게임', color: '#2563EB', bg: '#EFF6FF', light: '#F5F9FF' },
};

// ── 카테고리별 질문 ──────────────────────────────────────────────
const QUESTIONS = {
  연인: [
    {
      id: 'couple_1', category: '💕 첫 데이트 메뉴',
      question: '첫 데이트 저녁\n어디서 먹을까?',
      optionA: { label: '스테이크', sub: '분위기 있게', emoji: '🥩', color: '#8B0000', bg: '#FFF5F5' },
      optionB: { label: '파스타', sub: '이탈리안 감성', emoji: '🍝', color: '#CC6600', bg: '#FFF9F0' },
    },
    {
      id: 'couple_2', category: '💕 커플 치킨',
      question: '연인과 먹을 치킨은?',
      optionA: { label: '순살 치킨', sub: '편하게 먹기', emoji: '🍗', color: '#E6920A', bg: '#FFF8E1' },
      optionB: { label: '뼈 치킨', sub: '본연의 맛', emoji: '🍖', color: '#C0392B', bg: '#FFF5F3' },
    },
    {
      id: 'couple_3', category: '💕 야식 타임',
      question: '연인과 야식으로 먹을 음식은?',
      optionA: { label: '떡볶이', sub: '매콤달콤하게', emoji: '🌶️', color: '#CC2200', bg: '#FFF5F3' },
      optionB: { label: '족발', sub: '든든하게', emoji: '🐷', color: '#8B4513', bg: '#FFF9F5' },
    },
    {
      id: 'couple_4', category: '💕 카페 데이트',
      question: '카페 데이트 음료는?',
      optionA: { label: '아이스 아메리카노', sub: '쌉싸름하게', emoji: '☕', color: '#4A2C00', bg: '#FFF9F0' },
      optionB: { label: '달달한 라떼', sub: '부드럽고 달콤하게', emoji: '🧋', color: '#B5765B', bg: '#FFF5EE' },
    },
    {
      id: 'couple_5', category: '💕 기념일 케이크',
      question: '기념일 케이크 어떤 걸로?',
      optionA: { label: '생크림 케이크', sub: '달콤하고 촉촉하게', emoji: '🎂', color: '#D6407A', bg: '#FFF0F6' },
      optionB: { label: '치즈케이크', sub: '진하고 고소하게', emoji: '🍰', color: '#DAA520', bg: '#FFFBF0' },
    },
  ],
  친구: [
    {
      id: 'friend_1', category: '🍗 치킨 대결',
      question: '친구들이랑 시킬 치킨은?',
      optionA: { label: '황금올리브', sub: 'BHC 치킨', emoji: '🍗', color: '#E6920A', bg: '#FFF8E1' },
      optionB: { label: '뿌링클', sub: 'BBQ 치킨', emoji: '🍗', color: '#D6407A', bg: '#FFF0F6' },
    },
    {
      id: 'friend_2', category: '🍔 버거 대결',
      question: '친구들이랑 먹을 버거는?',
      optionA: { label: '빅맥', sub: '맥도날드', emoji: '🍔', color: '#C49000', bg: '#FFFBEA' },
      optionB: { label: '불고기버거', sub: '롯데리아', emoji: '🍔', color: '#C0392B', bg: '#FFF5F5' },
    },
    {
      id: 'friend_3', category: '🍺 술자리 안주',
      question: '술자리 안주는 뭐로?',
      optionA: { label: '닭발', sub: '매콤하게', emoji: '🔥', color: '#CC2200', bg: '#FFF5F3' },
      optionB: { label: '삼겹살', sub: '구워 먹기', emoji: '🥓', color: '#8B4513', bg: '#FFF9F5' },
    },
    {
      id: 'friend_4', category: '🍕 피자 대결',
      question: '단체 피자는 어디서?',
      optionA: { label: '도미노', sub: '크리스피 도우', emoji: '🍕', color: '#006491', bg: '#F0F8FF' },
      optionB: { label: '피자헛', sub: '판피자', emoji: '🍕', color: '#AA0000', bg: '#FFF5F5' },
    },
    {
      id: 'friend_5', category: '🍜 라면 대결',
      question: '편의점 라면은 뭐로?',
      optionA: { label: '신라면', sub: '농심', emoji: '🍜', color: '#CC2200', bg: '#FFF5F3' },
      optionB: { label: '진라면', sub: '오뚜기', emoji: '🍜', color: '#E07B00', bg: '#FFF9F0' },
    },
  ],
};

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export default function BalanceGameScreen() {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [currentIdx, setCurrentIdx]   = useState(0);
  const [voted, setVoted]             = useState(null);
  const [votes, setVotes]             = useState({ a: 0, b: 0 });
  const [pctA, setPctA]               = useState(50);
  const [pctB, setPctB]               = useState(50);
  const [showResult, setShowResult]   = useState(false);

  const animA = useRef(new Animated.Value(50)).current;
  const animB = useRef(new Animated.Value(50)).current;

  const questions = selectedCategory ? QUESTIONS[selectedCategory] : [];
  const question  = questions[currentIdx];

  // 카테고리 선택 시 게임 상태 초기화
  const handleCategorySelect = useCallback((cat) => {
    setSelectedCategory(cat);
    setCurrentIdx(0);
    setVoted(null);
    setShowResult(false);
    animA.setValue(50);
    animB.setValue(50);
  }, [animA, animB]);

  // Firebase 실시간 투표 구독
  useEffect(() => {
    if (!question) return;
    setVoted(null);
    setShowResult(false);
    animA.setValue(50);
    animB.setValue(50);

    const votesRef = ref(db, `balance_votes/${question.id}`);
    const unsub = onValue(
      votesRef,
      (snap) => { const d = snap.val() ?? {}; setVotes({ a: d.a ?? 0, b: d.b ?? 0 }); },
      (err)  => console.warn('[Game] Firebase 구독 오류:', err.message),
    );
    return () => unsub();
  }, [currentIdx, selectedCategory]);

  const animateBars = useCallback((a, b) => {
    const total = a + b;
    if (total === 0) return;
    const pA = Math.round((a / total) * 100);
    const pB = 100 - pA;
    setPctA(pA);
    setPctB(pB);
    Animated.parallel([
      Animated.timing(animA, { toValue: pA, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(animB, { toValue: pB, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, [animA, animB]);

  const handleVote = useCallback(async (option) => {
    if (voted) return;
    setVoted(option);
    setShowResult(true);
    const newA = votes.a + (option === 'A' ? 1 : 0);
    const newB = votes.b + (option === 'B' ? 1 : 0);
    setVotes({ a: newA, b: newB });
    animateBars(newA, newB);
    try {
      const field = option === 'A' ? 'a' : 'b';
      await runTransaction(ref(db, `balance_votes/${question.id}/${field}`), (cur) => (cur ?? 0) + 1);
    } catch (err) {
      console.warn('[Game] 투표 저장 실패 (로컬 반영):', err.message);
    }
  }, [voted, votes, question?.id, animateBars]);

  const handleNext = () => setCurrentIdx((i) => (i + 1) % questions.length);

  // ── Phase 1: 카테고리 선택 화면 ───────────────────────────────
  if (!selectedCategory) {
    return (
      <View style={styles.screen}>
        <View style={styles.frame}>
          <View style={styles.phaseOneWrap}>
            {/* 헤더 */}
            <View style={styles.header}>
              <Text style={styles.logo}>반반 🍕</Text>
              <Text style={styles.logoSub}>음식 밸런스 게임</Text>
              <Text style={styles.selectHint}>어떤 유형으로 즐길까요?</Text>
            </View>

            {/* 카테고리 선택 버튼 — 두 버튼 모두 표시 */}
            <View style={styles.catBtnsWrap}>
              {(['연인', '친구'] ).map((cat) => {
                const cfg = CATEGORY_CONFIG[cat];
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catBtn, { backgroundColor: cfg.bg, borderColor: cfg.color }]}
                    onPress={() => handleCategorySelect(cat)}
                    activeOpacity={0.80}
                  >
                    <Text style={styles.catBtnEmoji}>{cfg.emoji}</Text>
                    <Text style={[styles.catBtnLabel, { color: cfg.color }]}>{cfg.label}</Text>
                    <Text style={styles.catBtnSub}>{cfg.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ① 광고 배너 — 최하단 고정 */}
          <AdBanner height={60} />
        </View>
      </View>
    );
  }

  // ── Phase 2: 게임 화면 (선택된 카테고리만 표시) ───────────────
  const cfg   = CATEGORY_CONFIG[selectedCategory];
  const total = votes.a + votes.b;
  const qNum  = currentIdx + 1;

  return (
    <View style={styles.screen}>
      <View style={styles.frame}>
        {/* 선택된 카테고리 뱃지 + 카테고리 변경 링크 */}
        <TouchableOpacity
          style={[styles.activeCatBadge, { backgroundColor: cfg.bg, borderColor: cfg.color }]}
          onPress={() => setSelectedCategory(null)}
          activeOpacity={0.8}
        >
          <Text style={[styles.activeCatText, { color: cfg.color }]}>
            {cfg.emoji} {cfg.label} 모드 • Q{qNum}/{questions.length}
          </Text>
          <Text style={[styles.activeCatChange, { color: cfg.color }]}>변경 ›</Text>
        </TouchableOpacity>

        {/* ② 스크롤 영역 — 상단 광고 제거, 카드 공간 확장 */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.gameScroll}
          showsVerticalScrollIndicator={false}
        >
          {/* 질문 카드 */}
          <View style={[styles.questionCard, { borderColor: cfg.color + '33' }]}>
            <Text style={[styles.category, { color: cfg.color }]}>{question.category}</Text>
            <Text style={styles.questionText}>{question.question}</Text>
            {!voted && <Text style={styles.hint}>카드를 클릭해서 투표하세요</Text>}
          </View>

          {/* ③ 선택 카드 — 사라진 버튼 공간만큼 확장 */}
          <View style={styles.cardsRow}>
            <TouchableOpacity
              style={[
                styles.card,
                { backgroundColor: question.optionA.bg },
                voted === 'A' && styles.cardWinner,
                voted === 'B' && styles.cardLoser,
              ]}
              onPress={() => handleVote('A')}
              activeOpacity={0.82}
              disabled={!!voted}
            >
              <Text style={styles.cardEmoji}>{question.optionA.emoji}</Text>
              <Text style={[styles.cardLabel, { color: question.optionA.color }]}>
                {question.optionA.label}
              </Text>
              <Text style={styles.cardSub}>{question.optionA.sub}</Text>
              {showResult && (
                <Text style={[styles.cardPct, { color: question.optionA.color }]}>{pctA}%</Text>
              )}
            </TouchableOpacity>

            <View style={styles.vsBadge}>
              <Text style={styles.vsText}>VS</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.card,
                { backgroundColor: question.optionB.bg },
                voted === 'B' && styles.cardWinner,
                voted === 'A' && styles.cardLoser,
              ]}
              onPress={() => handleVote('B')}
              activeOpacity={0.82}
              disabled={!!voted}
            >
              <Text style={styles.cardEmoji}>{question.optionB.emoji}</Text>
              <Text style={[styles.cardLabel, { color: question.optionB.color }]}>
                {question.optionB.label}
              </Text>
              <Text style={styles.cardSub}>{question.optionB.sub}</Text>
              {showResult && (
                <Text style={[styles.cardPct, { color: question.optionB.color }]}>{pctB}%</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* 투표 결과 */}
          {showResult && (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>📊 투표 결과</Text>
              <View style={styles.barTrack}>
                <Animated.View style={[styles.barFill, { flex: animA, backgroundColor: question.optionA.color }]} />
                <Animated.View style={[styles.barFill, { flex: animB, backgroundColor: question.optionB.color }]} />
              </View>
              <View style={styles.barLabels}>
                <Text style={[styles.barLabelText, { color: question.optionA.color }]}>
                  {question.optionA.label} {pctA}%
                </Text>
                <Text style={[styles.barLabelText, { color: question.optionB.color }]}>
                  {pctB}% {question.optionB.label}
                </Text>
              </View>
              <Text style={styles.totalText}>총 {total.toLocaleString()}명 참여</Text>
              <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
                <Text style={styles.nextBtnText}>다음 질문 →</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* ④ 광고 배너 — 최하단 고정 (ScrollView 밖) */}
        <AdBanner height={60} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EFEFEF',
    alignItems: 'center',
  },
  frame: {
    width: '100%',
    maxWidth: 450,
    flex: 1,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: { boxShadow: '0 0 40px rgba(0,0,0,0.10)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 20 },
    }),
  },

  // ── Phase 1 ─────────────────────────────────────────────────────
  phaseOneWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: { alignItems: 'center', marginBottom: 36 },
  logo:   { fontSize: 32, fontWeight: '900', color: '#1A1A1A', letterSpacing: -0.5 },
  logoSub: { fontSize: 14, color: '#999', fontWeight: '500', marginTop: 4 },
  selectHint: { fontSize: 15, color: '#555', fontWeight: '600', marginTop: 12 },

  // 카테고리 선택 버튼 — 터치 가독성 대폭 개선
  catBtnsWrap: { gap: 14 },
  catBtn: {
    width: '100%',
    minHeight: 140,          // ← 충분한 터치 높이
    borderRadius: 24,
    borderWidth: 2.5,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  catBtnEmoji: { fontSize: 52, lineHeight: 62 },
  catBtnLabel: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  catBtnSub:   { fontSize: 14, color: '#888', fontWeight: '500' },

  // ── Phase 2 ─────────────────────────────────────────────────────
  activeCatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    borderWidth: 1.5,
  },
  activeCatText:   { fontSize: 14, fontWeight: '700' },
  activeCatChange: { fontSize: 12, fontWeight: '600', opacity: 0.7 },

  gameScroll: { paddingHorizontal: 0, paddingBottom: 32 },

  // 질문 카드
  questionCard: {
    marginHorizontal: 16, marginTop: 10,
    backgroundColor: '#FAFAFA', borderRadius: 16, padding: 22,
    alignItems: 'center', borderWidth: 1.5,
  },
  category:     { fontSize: 12, color: '#888', fontWeight: '700', marginBottom: 8, letterSpacing: 0.5 },
  questionText: { fontSize: 20, fontWeight: '800', color: '#1A1A1A', textAlign: 'center', lineHeight: 30 },
  hint:         { fontSize: 12, color: '#BBBBBB', marginTop: 10, fontWeight: '500' },

  // ③ 선택 카드 — 확장된 사이즈 (버튼 공간 흡수)
  cardsRow: {
    flexDirection: 'row',
    marginHorizontal: 16, marginTop: 14,
    gap: 8, alignItems: 'stretch',
  },
  card: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 32,     // ← 이전 24 → 32
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 210,          // ← 이전 170 → 210
    justifyContent: 'center',
    gap: 9,
  },
  cardWinner: {
    borderColor: '#1A1A1A',
    ...Platform.select({
      web: { boxShadow: '0 4px 20px rgba(0,0,0,0.16)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 12 },
    }),
  },
  cardLoser:  { opacity: 0.35 },
  cardEmoji:  { fontSize: 50, lineHeight: 60 },   // ← 이전 42 → 50
  cardLabel:  { fontSize: 17, fontWeight: '800', textAlign: 'center' },   // ← 이전 15 → 17
  cardSub:    { fontSize: 12, color: '#AAAAAA', fontWeight: '500', textAlign: 'center' },
  cardPct:    { fontSize: 28, fontWeight: '900', marginTop: 4 },          // ← 이전 24 → 28

  // VS 배지
  vsBadge: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  vsText: { fontSize: 11, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 },

  // 결과 카드
  resultCard: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: '#FAFAFA', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: '#F0F0F0', gap: 12,
  },
  resultTitle:   { fontSize: 15, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' },
  barTrack:      { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: '#EEEEEE' },
  barFill:       { borderRadius: 7 },
  barLabels:     { flexDirection: 'row', justifyContent: 'space-between' },
  barLabelText:  { fontSize: 13, fontWeight: '700' },
  totalText:     { fontSize: 12, color: '#AAAAAA', textAlign: 'center', fontWeight: '500' },

  // 다음 버튼
  nextBtn:     { backgroundColor: '#1A1A1A', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  nextBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
