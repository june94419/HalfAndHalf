import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ref, onValue } from 'firebase/database';
import { db } from '../../firebase';
import { QUESTIONS } from '../data/questions';
import { calcMatchRates } from '../utils/gameUtils';

function rateEmoji(rate) {
  if (rate >= 80) return '🔥';
  if (rate >= 60) return '😊';
  if (rate >= 40) return '🤔';
  return '🌀';
}

function rateColor(rate) {
  if (rate >= 80) return '#22C55E';
  if (rate >= 60) return '#FFD60A';
  if (rate >= 40) return '#E67E22';
  return '#E63946';
}

function rateComment(rate) {
  if (rate >= 80) return '환상의 케미!';
  if (rate >= 60) return '꽤 잘 맞아요!';
  if (rate >= 40) return '반반이네요~';
  return '개성 넘치는 조합!';
}

export default function RoomResultScreen({ route, navigation }) {
  const { roomCode, nickname } = route.params;
  const [players, setPlayers]   = useState([]);
  const [answers, setAnswers]   = useState({});
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsub = onValue(roomRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.val();
      setPlayers(Object.keys(data.players || {}));
      setAnswers(data.answers || {});
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#FFD60A" size="large" />
          <Text style={styles.loadingText}>결과 집계 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const matchRates = calcMatchRates(answers, nickname, players);
  const otherPlayers = Object.entries(matchRates).sort((a, b) => b[1] - a[1]);

  // 내 전체 정답률 (대중과 비교)
  const totalQ = QUESTIONS.length;
  const myAnswers = {};
  for (let i = 0; i < totalQ; i++) {
    myAnswers[i] = answers[i]?.[nickname];
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Text style={styles.headerLabel}>🎉 게임 종료!</Text>

        {/* 내 결과 카드 */}
        <View style={styles.mainCard}>
          <Text style={styles.mainCardTitle}>나의 닉네임</Text>
          <Text style={styles.mainCardName}>{nickname}</Text>
          <View style={styles.divider} />
          <Text style={styles.mainCardSub}>{totalQ}문항 완료</Text>
        </View>

        {/* 플레이어별 궁합 */}
        {otherPlayers.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>플레이어별 의견 일치율</Text>
            {otherPlayers.map(([player, rate]) => (
              <View key={player} style={styles.playerCard}>
                <View style={styles.playerInfo}>
                  <View style={styles.playerAvatar}>
                    <Text style={styles.playerAvatarText}>{player[0]?.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.playerName}>{player}</Text>
                  <Text style={styles.playerEmoji}>{rateEmoji(rate)}</Text>
                </View>
                <View style={styles.rateRow}>
                  <View style={styles.rateBarTrack}>
                    <View style={[styles.rateBarFill, {
                      width: `${rate}%`,
                      backgroundColor: rateColor(rate),
                    }]} />
                  </View>
                  <Text style={[styles.rateText, { color: rateColor(rate) }]}>{rate}%</Text>
                </View>
                <Text style={styles.rateComment}>{rateComment(rate)}</Text>
              </View>
            ))}
          </>
        )}

        {/* 문항별 상세 */}
        <Text style={styles.sectionTitle}>문항별 답변</Text>
        {QUESTIONS.map((q, i) => {
          const myAns = answers[i]?.[nickname];
          if (!myAns) return null;
          const allAns = Object.values(answers[i] || {});
          const countA = allAns.filter((v) => v === 'A').length;
          const countB = allAns.filter((v) => v === 'B').length;
          const total = countA + countB;
          const pctA = total > 0 ? Math.round((countA / total) * 100) : 0;
          return (
            <View key={i} style={styles.qCard}>
              <View style={styles.qHeader}>
                <Text style={styles.qNum}>Q{i + 1}</Text>
                <Text style={styles.qText} numberOfLines={1}>{q.question}</Text>
                <View style={[styles.ansBadge, myAns === 'A' ? styles.ansBadgeA : styles.ansBadgeB]}>
                  <Text style={[styles.ansBadgeText, myAns === 'A' ? styles.ansBadgeTextA : styles.ansBadgeTextB]}>
                    {myAns}
                  </Text>
                </View>
              </View>
              <View style={styles.qBar}>
                <View style={[styles.qSegA, { flex: countA || 0.01 }]} />
                <View style={[styles.qSegB, { flex: countB || 0.01 }]} />
              </View>
              <View style={styles.qLabels}>
                <Text style={styles.qLabelA}>{q.a}  {pctA}%</Text>
                <Text style={styles.qLabelB}>{100 - pctA}%  {q.b}</Text>
              </View>
            </View>
          );
        })}

        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => navigation.replace('Home')}
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
  safe: { flex: 1, backgroundColor: '#141414' },
  scroll: { paddingHorizontal: 20, paddingTop: 20 },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: '#888', fontSize: 16, fontWeight: '600' },

  headerLabel: {
    color: '#888', fontSize: 13, fontWeight: '800',
    letterSpacing: 2, textAlign: 'center', marginBottom: 16,
  },

  mainCard: {
    backgroundColor: '#1F1F1F',
    borderRadius: 20, padding: 24,
    alignItems: 'center', marginBottom: 28,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  mainCardTitle: { color: '#666', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  mainCardName: { color: '#fff', fontSize: 32, fontWeight: '900', marginTop: 8 },
  divider: { width: 36, height: 2, backgroundColor: '#2A2A2A', marginVertical: 14 },
  mainCardSub: { color: '#888', fontSize: 14, fontWeight: '600' },

  sectionTitle: {
    color: '#fff', fontSize: 15, fontWeight: '800',
    marginBottom: 12, marginTop: 4,
  },

  playerCard: {
    backgroundColor: '#1F1F1F',
    borderRadius: 16, padding: 16,
    marginBottom: 10, gap: 10,
  },
  playerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center',
  },
  playerAvatarText: { color: '#FFD60A', fontSize: 14, fontWeight: '900' },
  playerName: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' },
  playerEmoji: { fontSize: 22 },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rateBarTrack: { flex: 1, height: 8, backgroundColor: '#2A2A2A', borderRadius: 4, overflow: 'hidden' },
  rateBarFill: { height: '100%', borderRadius: 4 },
  rateText: { fontSize: 15, fontWeight: '900', width: 44, textAlign: 'right' },
  rateComment: { color: '#666', fontSize: 12, fontWeight: '600' },

  qCard: {
    backgroundColor: '#1F1F1F',
    borderRadius: 14, padding: 14,
    marginBottom: 8, gap: 8,
  },
  qHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qNum: { color: '#E63946', fontSize: 12, fontWeight: '800', width: 28 },
  qText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  ansBadge: {
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1,
  },
  ansBadgeA: { backgroundColor: '#1A0000', borderColor: '#E63946' },
  ansBadgeB: { backgroundColor: '#1A1200', borderColor: '#FFD60A' },
  ansBadgeText: { fontSize: 11, fontWeight: '800' },
  ansBadgeTextA: { color: '#E63946' },
  ansBadgeTextB: { color: '#FFD60A' },
  qBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden' },
  qSegA: { backgroundColor: '#E63946' },
  qSegB: { backgroundColor: '#FFD60A' },
  qLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  qLabelA: { color: '#E63946', fontSize: 11, fontWeight: '700' },
  qLabelB: { color: '#FFD60A', fontSize: 11, fontWeight: '700' },

  homeBtn: {
    backgroundColor: '#FFD60A',
    borderRadius: 16, paddingVertical: 18,
    alignItems: 'center', marginTop: 16,
  },
  homeBtnText: { color: '#1A1A1A', fontSize: 17, fontWeight: '900' },
});
