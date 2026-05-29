import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ref, get } from 'firebase/database';
import { db } from '../../firebase';
import { QUESTIONS } from '../data/questions';
import HalfPizza from '../components/HalfPizza';

// 대중 통계에서 다수 선택지 계산
function getMajority(stats) {
  const a = stats?.A ?? 0;
  const b = stats?.B ?? 0;
  if (a === 0 && b === 0) return null;
  return a >= b ? 'A' : 'B';
}

// 피자 조각 애니메이션 게이지
function PizzaGauge({ pct }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View style={gaugeStyles.wrap}>
      <View style={gaugeStyles.track}>
        <Animated.View style={[gaugeStyles.fill, { width }]} />
        {/* 피자 조각 눈금 */}
        {Array.from({ length: 19 }).map((_, i) => (
          <View
            key={i}
            style={[gaugeStyles.tick, { left: `${(i + 1) * 5}%` }]}
          />
        ))}
      </View>
      <View style={gaugeStyles.labelRow}>
        <Text style={gaugeStyles.pctText}>{pct}%</Text>
        <HalfPizza size={36} />
      </View>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  wrap: { marginVertical: 24 },
  track: {
    height: 36,
    backgroundColor: '#2A2A2A',
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    height: '100%',
    backgroundColor: '#E63946',
    borderRadius: 18,
  },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(20,20,20,0.4)',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  pctText: { color: '#E63946', fontSize: 36, fontWeight: '900' },
});

// 개별 문항 결과 행
function QuestionRow({ q, mySelection, majority, stats }) {
  const isMatch = mySelection === majority;
  const total = (stats?.A ?? 0) + (stats?.B ?? 0);
  const pctA = total > 0 ? Math.round(((stats?.A ?? 0) / total) * 100) : 0;
  const pctB = total > 0 ? 100 - pctA : 0;

  return (
    <View style={rowStyles.container}>
      <View style={rowStyles.header}>
        <Text style={rowStyles.qNum}>Q{q.id + 1}</Text>
        <Text style={rowStyles.qText} numberOfLines={1}>{q.question}</Text>
        <Text style={isMatch ? rowStyles.matchBadge : rowStyles.diffBadge}>
          {isMatch ? '일치 ✓' : '다름'}
        </Text>
      </View>
      <View style={rowStyles.bar}>
        <View style={[rowStyles.segA, { flex: pctA || 0.01 }]} />
        <View style={[rowStyles.segB, { flex: pctB || 0.01 }]} />
      </View>
      <View style={rowStyles.labels}>
        <Text style={rowStyles.labelA}>
          {mySelection === 'A' ? '▶ ' : ''}{q.a}  {pctA}%
        </Text>
        <Text style={rowStyles.labelB}>
          {pctB}%  {q.b}{mySelection === 'B' ? ' ◀' : ''}
        </Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    backgroundColor: '#1F1F1F',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  qNum: { color: '#E63946', fontSize: 12, fontWeight: '800', minWidth: 28 },
  qText: { color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 },
  matchBadge: {
    color: '#FFD60A', fontSize: 11, fontWeight: '800',
    backgroundColor: '#1A1200', borderWidth: 1, borderColor: '#FFD60A',
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2,
  },
  diffBadge: {
    color: '#555', fontSize: 11, fontWeight: '800',
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333',
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2,
  },
  bar: {
    flexDirection: 'row', height: 6, borderRadius: 3,
    overflow: 'hidden', marginBottom: 6,
  },
  segA: { backgroundColor: '#E63946' },
  segB: { backgroundColor: '#FFD60A' },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  labelA: { color: '#E63946', fontSize: 12, fontWeight: '700' },
  labelB: { color: '#FFD60A', fontSize: 12, fontWeight: '700' },
});

// 일치율에 따른 결과 메시지
function getResultMessage(matchCount, total) {
  const pct = Math.round((matchCount / total) * 100);
  if (pct >= 80) return { title: '🎉 국민 입맛 인증!', sub: '대한민국 평균과 거의 똑같아요' };
  if (pct >= 60) return { title: '😊 꽤 평균적이에요!', sub: '대중과 꽤 비슷한 취향이네요' };
  if (pct >= 40) return { title: '🤔 반반이네요!', sub: '평균과 비슷한 부분도 다른 부분도 있어요' };
  if (pct >= 20) return { title: '😎 마이웨이 스타일!', sub: '당신만의 개성 있는 취향이에요' };
  return { title: '🦄 독보적인 개성!', sub: '대한민국 평균과 완전히 다른 독특한 취향!' };
}

export default function SoloResultScreen({ route, navigation }) {
  const { userAnswers } = route.params; // [{ id, selection }]
  const [globalStats, setGlobalStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const snap = await get(ref(db, 'global_stats'));
        setGlobalStats(snap.val() || {});
      } catch (_) {
        setGlobalStats({});
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#FFD60A" size="large" />
          <Text style={styles.loadingText}>결과 분석 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 일치 개수 계산
  const matchCount = userAnswers.reduce((acc, ans) => {
    const stats = globalStats?.[ans.id];
    const majority = getMajority(stats);
    return majority && ans.selection === majority ? acc + 1 : acc;
  }, 0);

  const total = userAnswers.length;
  const matchPct = Math.round((matchCount / total) * 100);
  const { title, sub } = getResultMessage(matchCount, total);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* 헤더 */}
        <Text style={styles.headerTitle}>결과 분석</Text>

        {/* 메인 결과 카드 */}
        <View style={styles.mainCard}>
          <HalfPizza size={120} />
          <View style={styles.resultDivider} />
          <Text style={styles.resultTitle}>{title}</Text>
          <Text style={styles.resultSub}>{sub}</Text>

          <PizzaGauge pct={matchPct} />

          <Text style={styles.matchStat}>
            <Text style={styles.matchNum}>{total}</Text>
            <Text style={styles.matchLabel}>개 문항 중 대중과 </Text>
            <Text style={styles.matchNum}>{matchCount}</Text>
            <Text style={styles.matchLabel}>개 일치</Text>
          </Text>
          <Text style={styles.matchDesc}>
            당신은{' '}
            <Text style={styles.pctHighlight}>{matchPct}% 확률</Text>
            {'\n'}로 대한민국 평균 입맛!
          </Text>
        </View>

        {/* 문항별 결과 */}
        <Text style={styles.sectionTitle}>📊 문항별 비교</Text>
        {QUESTIONS.map((q) => {
          const ans = userAnswers.find((a) => a.id === q.id);
          if (!ans) return null;
          const stats = globalStats?.[q.id] ?? { A: 0, B: 0 };
          const majority = getMajority(stats);
          return (
            <QuestionRow
              key={q.id}
              q={q}
              mySelection={ans.selection}
              majority={majority}
              stats={stats}
            />
          );
        })}

        {/* 홈으로 버튼 */}
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => navigation.popToTop()}
          activeOpacity={0.85}
        >
          <Text style={styles.homeBtnText}>🏠 홈으로 돌아가기</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414' },
  scroll: { paddingHorizontal: 20, paddingTop: 20 },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: '#888', fontSize: 16, fontWeight: '600' },

  headerTitle: {
    color: '#888', fontSize: 13, fontWeight: '800',
    letterSpacing: 2, textAlign: 'center', marginBottom: 20,
  },

  mainCard: {
    backgroundColor: '#1F1F1F',
    borderRadius: 24,
    padding: 28,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
  },
  resultDivider: {
    width: 40, height: 3, borderRadius: 2,
    backgroundColor: '#2E2E2E', marginVertical: 16,
  },
  resultTitle: {
    color: '#fff', fontSize: 26, fontWeight: '900',
    textAlign: 'center', marginBottom: 8,
  },
  resultSub: {
    color: '#888', fontSize: 14, fontWeight: '600',
    textAlign: 'center',
  },

  matchStat: { marginTop: 4 },
  matchNum: { color: '#E63946', fontSize: 20, fontWeight: '900' },
  matchLabel: { color: '#aaa', fontSize: 15, fontWeight: '600' },

  matchDesc: {
    color: '#aaa', fontSize: 15, fontWeight: '600',
    textAlign: 'center', lineHeight: 24, marginTop: 10,
  },
  pctHighlight: { color: '#FFD60A', fontSize: 18, fontWeight: '900' },

  sectionTitle: {
    color: '#fff', fontSize: 16, fontWeight: '800',
    marginBottom: 16, letterSpacing: 0.5,
  },

  homeBtn: {
    backgroundColor: '#FFD60A',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  homeBtnText: { color: '#1A1A1A', fontSize: 17, fontWeight: '900' },
});
