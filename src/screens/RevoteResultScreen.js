import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../../firebase';
import { QUESTIONS } from '../data/questions';

export default function RevoteResultScreen({ route, navigation }) {
  const { roomCode, nickname, debateQuestion } = route.params;
  const [before, setBefore] = useState({ A: 0, B: 0 });
  const [after, setAfter] = useState({ A: 0, B: 0 });
  const [players, setPlayers] = useState([]);

  const q = QUESTIONS[debateQuestion];

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsub = onValue(roomRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.val();
      const allPlayers = Object.keys(data.players || {});
      setPlayers(allPlayers);

      const origAnswers = data.answers?.[debateQuestion] || {};
      const rvAnswers = data.revoteAnswers?.[debateQuestion] || {};

      setBefore({
        A: Object.values(origAnswers).filter((v) => v === 'A').length,
        B: Object.values(origAnswers).filter((v) => v === 'B').length,
      });
      setAfter({
        A: Object.values(rvAnswers).filter((v) => v === 'A').length,
        B: Object.values(rvAnswers).filter((v) => v === 'B').length,
      });
    });
    return () => unsub();
  }, []);

  async function handleResult() {
    await update(ref(db, `rooms/${roomCode}`), { status: 'results' });
    navigation.replace('Result', { roomCode, nickname });
  }

  const total = players.length || 1;
  const changed = (before.A !== after.A || before.B !== after.B);
  const winner = after.A > after.B ? 'A' : after.B > after.A ? 'B' : 'tie';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>📊 재투표 결과</Text>
      </View>

      <Text style={styles.title}>마음이 바뀌었나요?</Text>
      <Text style={styles.qText}>{q.question}</Text>

      {/* 비교 카드 */}
      <View style={styles.compareWrap}>
        {/* 전 */}
        <View style={styles.compareCard}>
          <Text style={styles.compareLabel}>토론 전</Text>
          <View style={styles.compareBar}>
            <View style={[styles.segA, { flex: before.A || 0.01 }]} />
            <View style={[styles.segB, { flex: before.B || 0.01 }]} />
          </View>
          <View style={styles.compareRow}>
            <Text style={styles.cntA}>A {before.A}명</Text>
            <Text style={styles.cntB}>B {before.B}명</Text>
          </View>
        </View>

        <Text style={styles.arrow}>→</Text>

        {/* 후 */}
        <View style={[styles.compareCard, styles.compareCardHighlight]}>
          <Text style={styles.compareLabel}>토론 후</Text>
          <View style={styles.compareBar}>
            <View style={[styles.segA, { flex: after.A || 0.01 }]} />
            <View style={[styles.segB, { flex: after.B || 0.01 }]} />
          </View>
          <View style={styles.compareRow}>
            <Text style={styles.cntA}>A {after.A}명</Text>
            <Text style={styles.cntB}>B {after.B}명</Text>
          </View>
        </View>
      </View>

      {/* 한 줄 코멘트 */}
      <View style={styles.commentBox}>
        {!changed && <Text style={styles.commentText}>🔥 아무도 마음을 바꾸지 않았어! 신념의 대결!</Text>}
        {changed && winner === 'tie' && <Text style={styles.commentText}>🤝 토론 후에도 여전히 50:50! 팽팽하다!</Text>}
        {changed && winner === 'A' && <Text style={styles.commentText}>🍕 토론 후 A팀이 더 강해졌어!</Text>}
        {changed && winner === 'B' && <Text style={styles.commentText}>🧀 토론 후 B팀이 역전했어!</Text>}
      </View>

      <TouchableOpacity style={styles.btn} onPress={handleResult} activeOpacity={0.85}>
        <Text style={styles.btnText}>📊 최종 결과 보기</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#141414',
    paddingHorizontal: 24, paddingTop: 24,
    justifyContent: 'space-between', paddingBottom: 30,
  },
  badge: {
    backgroundColor: '#2A2A2A', alignSelf: 'flex-start',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 16,
  },
  badgeText: { color: '#FFD60A', fontSize: 13, fontWeight: '800' },
  title: { fontSize: 26, fontWeight: '900', color: '#fff', marginBottom: 8 },
  qText: { color: '#888', fontSize: 15, marginBottom: 28 },
  compareWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  compareCard: {
    flex: 1, backgroundColor: '#1F1F1F',
    borderRadius: 18, padding: 18, gap: 12,
  },
  compareCardHighlight: { borderWidth: 2, borderColor: '#FFD60A' },
  compareLabel: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  compareBar: {
    flexDirection: 'row', height: 10,
    borderRadius: 5, overflow: 'hidden',
  },
  segA: { backgroundColor: '#E63946' },
  segB: { backgroundColor: '#FFD60A' },
  compareRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cntA: { color: '#E63946', fontSize: 13, fontWeight: '700' },
  cntB: { color: '#FFD60A', fontSize: 13, fontWeight: '700' },
  arrow: { color: '#555', fontSize: 22, fontWeight: '900' },
  commentBox: {
    backgroundColor: '#1F1F1F',
    borderRadius: 14, padding: 18, alignItems: 'center',
  },
  commentText: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  btn: {
    backgroundColor: '#FFD60A',
    borderRadius: 16, paddingVertical: 18, alignItems: 'center',
  },
  btnText: { color: '#1A1A1A', fontSize: 18, fontWeight: '800' },
});
