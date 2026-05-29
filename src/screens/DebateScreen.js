import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../../firebase';
import { QUESTIONS } from '../data/questions';

export default function DebateScreen({ route, navigation }) {
  const { roomCode, nickname, isHost } = route.params;
  const [debateQ, setDebateQ] = useState(null);
  const [answers, setAnswers] = useState({});
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsub = onValue(roomRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.val();
      setDebateQ(data.debateQuestion);
      setAnswers(data.answers || {});
      setPlayers(Object.keys(data.players || {}));

      if (data.status === 'revote') {
        navigation.replace('Revote', { roomCode, nickname, isHost, debateQuestion: data.debateQuestion });
      }
      if (data.status === 'results') {
        navigation.replace('Result', { roomCode, nickname });
      }
    });
    return () => unsub();
  }, []);

  if (debateQ === null) return null;
  const q = QUESTIONS[debateQ];
  const currentAnswers = answers[debateQ] || {};
  const countA = Object.values(currentAnswers).filter((v) => v === 'A').length;
  const countB = Object.values(currentAnswers).filter((v) => v === 'B').length;

  async function handleStartRevote() {
    await update(ref(db, `rooms/${roomCode}`), { status: 'revote' });
  }

  async function handleSkip() {
    await update(ref(db, `rooms/${roomCode}`), { status: 'results' });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>🔥 핫 토론 주제!</Text>
      </View>

      <Text style={styles.title}>딱 50:50으로 갈렸어!</Text>
      <Text style={styles.sub}>이 질문, 토론 한번 해볼까?</Text>

      <View style={styles.card}>
        <Text style={styles.qNum}>Q{debateQ + 1}</Text>
        <Text style={styles.qText}>{q.question}</Text>

        <View style={styles.splitRow}>
          <View style={[styles.splitBox, styles.splitA]}>
            <Text style={styles.splitLabel}>A</Text>
            <Text style={styles.splitChoice}>{q.a}</Text>
            <Text style={styles.splitCount}>{countA}명</Text>
          </View>
          <Text style={styles.colon}>:</Text>
          <View style={[styles.splitBox, styles.splitB]}>
            <Text style={styles.splitLabelDark}>B</Text>
            <Text style={styles.splitChoiceDark}>{q.b}</Text>
            <Text style={styles.splitCountDark}>{countB}명</Text>
          </View>
        </View>
      </View>

      <Text style={styles.instruction}>
        💬 친구들과 왜 그 선택을 했는지 이야기해봐!{'\n'}토론이 끝나면 재투표로 마음이 바뀌었는지 확인해봐.
      </Text>

      {isHost ? (
        <View style={styles.btnGroup}>
          <TouchableOpacity style={styles.btnRevote} onPress={handleStartRevote} activeOpacity={0.85}>
            <Text style={styles.btnRevoteText}>🗳️ 재투표 시작!</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSkip} onPress={handleSkip} activeOpacity={0.85}>
            <Text style={styles.btnSkipText}>결과 바로 보기 →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.waitBox}>
          <Text style={styles.waitText}>⏳ 방장이 재투표를 시작할 때까지 기다려줘...</Text>
        </View>
      )}
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
    backgroundColor: '#E63946',
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 16,
  },
  badgeText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 6 },
  sub: { color: '#888', fontSize: 15, marginBottom: 24 },
  card: {
    backgroundColor: '#1F1F1F',
    borderRadius: 24,
    padding: 24,
    borderWidth: 2,
    borderColor: '#E63946',
  },
  qNum: { color: '#E63946', fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 10 },
  qText: { color: '#fff', fontSize: 20, fontWeight: '800', lineHeight: 28, marginBottom: 24 },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  splitBox: {
    flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', gap: 4,
  },
  splitA: { backgroundColor: '#E63946' },
  splitB: { backgroundColor: '#FFD60A' },
  splitLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '800' },
  splitLabelDark: { color: 'rgba(0,0,0,0.4)', fontSize: 12, fontWeight: '800' },
  splitChoice: { color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  splitChoiceDark: { color: '#1A1A1A', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  splitCount: { color: 'rgba(255,255,255,0.8)', fontSize: 20, fontWeight: '900' },
  splitCountDark: { color: 'rgba(0,0,0,0.6)', fontSize: 20, fontWeight: '900' },
  colon: { color: '#555', fontSize: 22, fontWeight: '900' },
  instruction: {
    color: '#666',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    paddingVertical: 10,
  },
  btnGroup: { gap: 12 },
  btnRevote: {
    backgroundColor: '#FFD60A',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  btnRevoteText: { color: '#1A1A1A', fontSize: 18, fontWeight: '800' },
  btnSkip: {
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSkipText: { color: '#888', fontSize: 15, fontWeight: '600' },
  waitBox: {
    backgroundColor: '#1F1F1F',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  waitText: { color: '#888', fontSize: 14 },
});
