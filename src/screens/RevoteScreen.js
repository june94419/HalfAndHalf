import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../../firebase';
import { QUESTIONS } from '../data/questions';

export default function RevoteScreen({ route, navigation }) {
  const { roomCode, nickname, isHost, debateQuestion } = route.params;
  const [myAnswer, setMyAnswer] = useState(null);
  const [revoteAnswers, setRevoteAnswers] = useState({});
  const [players, setPlayers] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const scaleA = React.useRef(new Animated.Value(1)).current;
  const scaleB = React.useRef(new Animated.Value(1)).current;

  const q = QUESTIONS[debateQuestion];

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsub = onValue(roomRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.val();
      const allPlayers = Object.keys(data.players || {});
      setPlayers(allPlayers);
      const rv = data.revoteAnswers?.[debateQuestion] || {};
      setRevoteAnswers(rv);
      setMyAnswer(rv[nickname] ?? null);

      const allDone = allPlayers.length > 0 && allPlayers.every((p) => rv[p]);
      setIsLocked(allDone);
      if (allDone && isHost) {
        update(ref(db, `rooms/${roomCode}`), { status: 'revote_results' });
      }

      if (data.status === 'revote_results') {
        navigation.replace('RevoteResult', { roomCode, nickname, debateQuestion });
      }
    });
    return () => unsub();
  }, []);

  async function handleAnswer(choice) {
    if (isLocked || myAnswer === choice) return;
    Animated.sequence([
      Animated.timing(choice === 'A' ? scaleA : scaleB, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.timing(choice === 'A' ? scaleA : scaleB, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    await update(ref(db, `rooms/${roomCode}/revoteAnswers/${debateQuestion}`), { [nickname]: choice });
    setMyAnswer(choice);
  }

  const answeredCount = Object.keys(revoteAnswers).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>🗳️ 재투표</Text>
      </View>

      <Text style={styles.title}>토론 후 마음이 바뀌었나요?</Text>

      <View style={styles.qCard}>
        <Text style={styles.qNum}>Q{debateQuestion + 1}</Text>
        <Text style={styles.qText}>{q.question}</Text>
      </View>

      <View style={styles.btnRow}>
        <Animated.View style={[{ flex: 1 }, { transform: [{ scale: scaleA }] }]}>
          <TouchableOpacity
            style={[
              styles.choiceBtn, styles.choiceBtnA,
              myAnswer === 'A' && styles.choiceSelected,
              myAnswer === 'B' && (isLocked ? styles.choiceDim : styles.choiceSoftDim),
            ]}
            onPress={() => handleAnswer('A')}
            disabled={isLocked}
            activeOpacity={0.85}
          >
            <Text style={styles.choiceLabel}>A</Text>
            <Text style={styles.choiceText}>{q.a}</Text>
            {myAnswer === 'A' && <Text style={styles.checkMark}>✓</Text>}
          </TouchableOpacity>
        </Animated.View>
        <View style={styles.vsWrap}>
          <Text style={styles.vsText}>VS</Text>
        </View>
        <Animated.View style={[{ flex: 1 }, { transform: [{ scale: scaleB }] }]}>
          <TouchableOpacity
            style={[
              styles.choiceBtn, styles.choiceBtnB,
              myAnswer === 'B' && styles.choiceSelectedB,
              myAnswer === 'A' && (isLocked ? styles.choiceDim : styles.choiceSoftDim),
            ]}
            onPress={() => handleAnswer('B')}
            disabled={isLocked}
            activeOpacity={0.85}
          >
            <Text style={styles.choiceLabel}>B</Text>
            <Text style={styles.choiceTextDark}>{q.b}</Text>
            {myAnswer === 'B' && <Text style={styles.checkMarkDark}>✓</Text>}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {!!myAnswer && !isLocked && (
        <View style={styles.waitBox}>
          <Text style={styles.waitText}>⏳ 다른 플레이어 재투표 기다리는 중...</Text>
          <Text style={styles.waitSub}>{answeredCount}/{players.length}명 완료 · 마음이 바뀌면 다시 선택 가능!</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414', paddingHorizontal: 20, paddingTop: 24 },
  badge: {
    backgroundColor: '#2A2A2A', alignSelf: 'flex-start',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 16,
  },
  badgeText: { color: '#FFD60A', fontSize: 13, fontWeight: '800' },
  title: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 24 },
  qCard: {
    backgroundColor: '#1F1F1F', borderRadius: 20,
    padding: 22, marginBottom: 28,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  qNum: { color: '#E63946', fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  qText: { color: '#fff', fontSize: 20, fontWeight: '800', lineHeight: 28 },
  btnRow: { flexDirection: 'row', alignItems: 'center', flex: 1, maxHeight: 200 },
  choiceBtn: {
    flex: 1, borderRadius: 18, padding: 20,
    alignItems: 'center', justifyContent: 'center', minHeight: 150, gap: 8,
  },
  choiceBtnA: { backgroundColor: '#E63946', marginRight: 6 },
  choiceBtnB: { backgroundColor: '#FFD60A', marginLeft: 6 },
  choiceSelected: { borderWidth: 3, borderColor: '#fff' },
  choiceSelectedB: { borderWidth: 3, borderColor: '#1A1A1A' },
  choiceDim: { opacity: 0.4 },
  choiceSoftDim: { opacity: 0.65 },
  choiceLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '800' },
  choiceText: { color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  choiceTextDark: { color: '#1A1A1A', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  checkMark: { color: '#fff', fontSize: 22, fontWeight: '900' },
  checkMarkDark: { color: '#1A1A1A', fontSize: 22, fontWeight: '900' },
  vsWrap: { width: 28, alignItems: 'center' },
  vsText: { color: '#555', fontSize: 12, fontWeight: '900' },
  waitBox: {
    backgroundColor: '#1F1F1F', borderRadius: 14,
    padding: 16, alignItems: 'center', marginTop: 20,
  },
  waitText: { color: '#888', fontSize: 14 },
  waitSub: { color: '#FFD60A', fontSize: 13, fontWeight: '700', marginTop: 6 },
});
