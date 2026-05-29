import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../../firebase';
import { QUESTIONS } from '../data/questions';
import { findDebateTopics } from '../utils/gameUtils';
import HalfPizza from '../components/HalfPizza';

const { width } = Dimensions.get('window');
const TOTAL = QUESTIONS.length;

export default function GameScreen({ route, navigation }) {
  const { roomCode, nickname, isHost } = route.params;
  const [qIndex, setQIndex] = useState(0);
  const [myAnswer, setMyAnswer] = useState(null);
  const [answers, setAnswers] = useState({});
  const [players, setPlayers] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const scaleA = useRef(new Animated.Value(1)).current;
  const scaleB = useRef(new Animated.Value(1)).current;
  const qIndexRef = useRef(qIndex);

  // qIndex가 변경될 때마다 (직접 선택 or Firebase 신호 수신) selectedOption 초기화
  // Android에서는 비동기 handleAnswer의 setMyAnswer(choice) 호출이 qIndex 전환 이후에도
  // 늦게 도달해 이전 선택이 다음 문항에 남는 경우가 있어, setTimeout으로 한 번 더 강제 초기화.
  useEffect(() => {
    qIndexRef.current = qIndex;
    setMyAnswer(null);
    setIsLocked(false);

    const timer = setTimeout(() => {
      setMyAnswer(null);
      setIsLocked(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [qIndex]);

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsub = onValue(roomRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.val();
      const allPlayers = Object.keys(data.players || {});
      setPlayers(allPlayers);

      const qIdx = data.currentQuestion ?? 0;
      setQIndex(qIdx);

      const allAnswers = data.answers || {};
      setAnswers(allAnswers);

      const myAns = allAnswers[qIdx]?.[nickname] ?? null;
      setMyAnswer(myAns);

      const currentAnswers = allAnswers[qIdx] || {};
      const allDone = allPlayers.length > 0 && allPlayers.every((p) => currentAnswers[p]);
      setIsLocked(allDone);

      if (allDone) {
        if (isHost) {
          const nextQ = qIdx + 1;
          if (nextQ >= TOTAL) {
            const debateTopics = findDebateTopics(allAnswers, allPlayers);
            const debateQ = debateTopics.length > 0 ? debateTopics[0].questionIndex : null;
            update(ref(db, `rooms/${roomCode}`), {
              status: debateQ !== null ? 'debate' : 'results',
              debateQuestion: debateQ,
            });
          } else {
            update(ref(db, `rooms/${roomCode}`), { currentQuestion: nextQ });
          }
        }
      }

      if (data.status === 'debate') {
        navigation.replace('Debate', { roomCode, nickname, isHost });
      } else if (data.status === 'results') {
        navigation.replace('Result', { roomCode, nickname });
      }
    });
    return () => unsub();
  }, []);

  async function handleAnswer(choice) {
    if (isLocked || myAnswer === choice) return;
    const answeredQ = qIndex;
    Animated.sequence([
      Animated.timing(choice === 'A' ? scaleA : scaleB, {
        toValue: 0.93, duration: 80, useNativeDriver: true,
      }),
      Animated.timing(choice === 'A' ? scaleA : scaleB, {
        toValue: 1, duration: 80, useNativeDriver: true,
      }),
    ]).start();
    await update(ref(db, `rooms/${roomCode}/answers/${answeredQ}`), { [nickname]: choice });
    // await 완료 시점에 이미 다음 문항으로 전환됐을 수 있으므로 인덱스가 같을 때만 반영
    if (qIndexRef.current === answeredQ) {
      setMyAnswer(choice);
    }
  }

  const q = QUESTIONS[qIndex];
  const currentAnswers = answers[qIndex] || {};
  const countA = Object.values(currentAnswers).filter((v) => v === 'A').length;
  const countB = Object.values(currentAnswers).filter((v) => v === 'B').length;
  const answeredCount = Object.keys(currentAnswers).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 진행률 */}
      <View style={styles.progressWrap}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((qIndex + 1) / TOTAL) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{qIndex + 1} / {TOTAL}</Text>
      </View>

      {/* 질문 카드 */}
      <View style={styles.questionCard}>
        <View style={styles.qHeader}>
          <HalfPizza size={28} />
          <Text style={styles.qNum}>Q{qIndex + 1}</Text>
        </View>
        <Text style={styles.qText}>{q.question}</Text>

        {/* 실시간 답변 현황 */}
        {myAnswer && (
          <View style={styles.liveBar}>
            <View style={[styles.liveSegA, { flex: countA || 0.01 }]} />
            <View style={[styles.liveSegB, { flex: countB || 0.01 }]} />
          </View>
        )}
        {myAnswer && (
          <Text style={styles.liveText}>
            🍕 {countA}명 · 🧀 {countB}명  ({answeredCount}/{players.length}명 답변)
          </Text>
        )}
      </View>

      {/* 선택 버튼 */}
      <View style={styles.btnRow}>
        <Animated.View style={[{ flex: 1 }, { transform: [{ scale: scaleA }] }]}>
          <TouchableOpacity
            style={[
              styles.choiceBtn,
              styles.choiceBtnA,
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

        <View style={styles.vsDivider}>
          <Text style={styles.vsText}>VS</Text>
        </View>

        <Animated.View style={[{ flex: 1 }, { transform: [{ scale: scaleB }] }]}>
          <TouchableOpacity
            style={[
              styles.choiceBtn,
              styles.choiceBtnB,
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
          <Text style={styles.waitText}>⏳ 다른 플레이어 답변 기다리는 중...</Text>
          <Text style={styles.waitSub}>{answeredCount}/{players.length}명 완료 · 마음이 바뀌면 다시 선택 가능!</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414', paddingHorizontal: 20, paddingTop: 16 },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
  progressBar: {
    flex: 1, height: 6, backgroundColor: '#2A2A2A',
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#E63946', borderRadius: 3 },
  progressText: { color: '#888', fontSize: 13, fontWeight: '700', minWidth: 40 },

  questionCard: {
    backgroundColor: '#1F1F1F',
    borderRadius: 24,
    padding: 28,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  qHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  qNum: { color: '#E63946', fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  qText: { color: '#fff', fontSize: 22, fontWeight: '800', lineHeight: 32 },

  liveBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 20,
    marginBottom: 8,
  },
  liveSegA: { backgroundColor: '#E63946' },
  liveSegB: { backgroundColor: '#FFD60A' },
  liveText: { color: '#888', fontSize: 13, fontWeight: '500' },

  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 0, flex: 1, maxHeight: 220 },
  choiceBtn: {
    flex: 1,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    gap: 8,
  },
  choiceBtnA: { backgroundColor: '#E63946', marginRight: 6 },
  choiceBtnB: { backgroundColor: '#FFD60A', marginLeft: 6 },
  choiceSelected: { borderWidth: 3, borderColor: '#fff' },
  choiceSelectedB: { borderWidth: 3, borderColor: '#1A1A1A' },
  choiceDim: { opacity: 0.4 },
  choiceSoftDim: { opacity: 0.65 },
  choiceLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '800' },
  choiceText: { color: '#fff', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  choiceTextDark: { color: '#1A1A1A', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  checkMark: { color: '#fff', fontSize: 22, fontWeight: '900' },
  checkMarkDark: { color: '#1A1A1A', fontSize: 22, fontWeight: '900' },
  vsDivider: { width: 28, alignItems: 'center', justifyContent: 'center' },
  vsText: { color: '#555', fontSize: 13, fontWeight: '900' },

  waitBox: {
    backgroundColor: '#1F1F1F',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  waitText: { color: '#888', fontSize: 14 },
  waitSub: { color: '#FFD60A', fontSize: 13, fontWeight: '700', marginTop: 6 },
});
