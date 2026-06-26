import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../../firebase';
import { QUESTIONS } from '../data/questions';
import { findDebateTopics } from '../utils/gameUtils';

export default function RoomGameScreen({ route, navigation }) {
  const { roomCode, nickname, isHost } = route.params;
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [players, setPlayers]                 = useState([]);
  const [currentAnswers, setCurrentAnswers]   = useState({});
  const [myAnswer, setMyAnswer]               = useState(null);

  const advancingRef = useRef(false);
  const scaleA = useRef(new Animated.Value(1)).current;
  const scaleB = useRef(new Animated.Value(1)).current;

  const q = QUESTIONS[currentQuestion];
  const answeredCount = Object.keys(currentAnswers).length;

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsub = onValue(roomRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.val();
      const allPlayers = Object.keys(data.players || {});
      const qIdx       = data.currentQuestion ?? 0;
      const allAnswers = data.answers ?? {};
      const qAnswers   = allAnswers[qIdx] ?? {};

      setPlayers(allPlayers);
      setCurrentQuestion(qIdx);
      setCurrentAnswers(qAnswers);
      setMyAnswer(qAnswers[nickname] ?? null);

      if (data.status === 'debate') {
        navigation.replace('Debate', { roomCode, nickname, isHost, debateQuestion: data.debateQuestion });
        return;
      }
      if (data.status === 'results') {
        navigation.replace('Result', { roomCode, nickname });
        return;
      }

      // 호스트가 모든 답변 완료 감지 시 다음 단계로 진행
      const allAnswered = allPlayers.length > 0 && Object.keys(qAnswers).length >= allPlayers.length;
      if (isHost && allAnswered && data.status === 'playing' && !advancingRef.current) {
        advancingRef.current = true;
        advanceGame(qIdx, allAnswers, allPlayers).finally(() => {
          advancingRef.current = false;
        });
      }
    });
    return () => unsub();
  }, []);

  async function advanceGame(qIdx, allAnswers, allPlayers) {
    const nextQ = qIdx + 1;

    if (nextQ < QUESTIONS.length) {
      await update(ref(db, `rooms/${roomCode}`), { currentQuestion: nextQ });
      return;
    }

    // 마지막 문항 완료 → 토론 주제 선정
    const debates = findDebateTopics(allAnswers, allPlayers);

    if (debates.length > 0) {
      await update(ref(db, `rooms/${roomCode}`), {
        status: 'debate',
        debateQuestion: debates[0].questionIndex,
      });
      return;
    }

    // 정확한 동점이 없으면 가장 팽팽했던 문항 선택
    let mostSplit = null;
    let minDiff   = Infinity;
    for (let i = 0; i < QUESTIONS.length; i++) {
      const qA = allAnswers[i] ?? {};
      const countA = Object.values(qA).filter((v) => v === 'A').length;
      const countB = Object.values(qA).filter((v) => v === 'B').length;
      if (countA === 0 || countB === 0) continue; // 만장일치는 제외
      const diff = Math.abs(countA - countB);
      if (diff < minDiff) {
        minDiff   = diff;
        mostSplit = i;
      }
    }

    if (mostSplit !== null) {
      await update(ref(db, `rooms/${roomCode}`), {
        status: 'debate',
        debateQuestion: mostSplit,
      });
    } else {
      await update(ref(db, `rooms/${roomCode}`), { status: 'results' });
    }
  }

  function bounce(animRef, cb) {
    Animated.sequence([
      Animated.timing(animRef, { toValue: 0.93, duration: 70, useNativeDriver: true }),
      Animated.timing(animRef, { toValue: 1,    duration: 70, useNativeDriver: true }),
    ]).start(cb);
  }

  async function handleAnswer(choice) {
    if (myAnswer) return;
    const animRef = choice === 'A' ? scaleA : scaleB;
    bounce(animRef, async () => {
      await update(ref(db, `rooms/${roomCode}/answers/${currentQuestion}`), {
        [nickname]: choice,
      });
    });
  }

  const progress = ((currentQuestion + 1) / QUESTIONS.length) * 100;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* 진행 바 */}
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressLabel}>{currentQuestion + 1} / {QUESTIONS.length}</Text>
      </View>

      {/* 대기 인원 표시 */}
      <View style={styles.waitBadgeRow}>
        <View style={styles.waitBadge}>
          <Text style={styles.waitBadgeText}>
            {answeredCount} / {players.length}명 완료
          </Text>
        </View>
      </View>

      {/* 질문 카드 */}
      <View style={styles.questionCard}>
        <Text style={styles.qNum}>Q{currentQuestion + 1}</Text>
        <Text style={styles.qText}>{q.question}</Text>
      </View>

      {/* 선택 버튼 or 대기 상태 */}
      {!myAnswer ? (
        <View style={styles.btnRow}>
          <Animated.View style={[styles.btnWrap, { transform: [{ scale: scaleA }] }]}>
            <TouchableOpacity
              style={[styles.choiceBtn, styles.btnA]}
              onPress={() => handleAnswer('A')}
              activeOpacity={0.85}
            >
              <Text style={styles.choiceLetter}>A</Text>
              <Text style={styles.choiceText}>{q.a}</Text>
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.vsDivider}>
            <Text style={styles.vsText}>VS</Text>
          </View>

          <Animated.View style={[styles.btnWrap, { transform: [{ scale: scaleB }] }]}>
            <TouchableOpacity
              style={[styles.choiceBtn, styles.btnB]}
              onPress={() => handleAnswer('B')}
              activeOpacity={0.85}
            >
              <Text style={[styles.choiceLetter, styles.choiceLetterDark]}>B</Text>
              <Text style={[styles.choiceText, styles.choiceTextDark]}>{q.b}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      ) : (
        <View style={styles.waitingArea}>
          <View style={styles.myPickBadge}>
            <Text style={styles.myPickLabel}>내 선택</Text>
            <Text style={styles.myPickValue}>
              {myAnswer === 'A' ? `A: ${q.a}` : `B: ${q.b}`}
            </Text>
          </View>

          <View style={styles.waitingCard}>
            <ActivityIndicator color="#FFD60A" size="large" />
            <Text style={styles.waitingTitle}>다른 플레이어 기다리는 중...</Text>
            <Text style={styles.waitingCount}>{answeredCount} / {players.length}명 완료</Text>

            {/* 누가 아직 안 했는지 표시 */}
            <View style={styles.playerStatusList}>
              {players.map((p) => (
                <View key={p} style={styles.playerStatusRow}>
                  <View style={[
                    styles.playerStatusDot,
                    currentAnswers[p] ? styles.dotDone : styles.dotWaiting,
                  ]} />
                  <Text style={styles.playerStatusName}>{p}</Text>
                  <Text style={styles.playerStatusState}>
                    {currentAnswers[p] ? '완료 ✓' : '...'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141414' },

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
  },
  progressTrack: {
    flex: 1, height: 6, backgroundColor: '#2A2A2A',
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#E63946', borderRadius: 3 },
  progressLabel: { color: '#888', fontSize: 13, fontWeight: '700', width: 44, textAlign: 'right' },

  waitBadgeRow: { paddingHorizontal: 20, marginTop: 12 },
  waitBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  waitBadgeText: { color: '#FFD60A', fontSize: 12, fontWeight: '700' },

  questionCard: {
    margin: 20,
    backgroundColor: '#1F1F1F',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  qNum: { color: '#E63946', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  qText: {
    color: '#fff', fontSize: 24, fontWeight: '900',
    textAlign: 'center', lineHeight: 34,
  },

  btnRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 0,
    alignItems: 'stretch',
    flex: 1,
  },
  btnWrap: { flex: 1 },
  choiceBtn: {
    flex: 1, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    paddingVertical: 24, gap: 10,
  },
  btnA: { backgroundColor: '#E63946', marginRight: 6 },
  btnB: { backgroundColor: '#FFD60A', marginLeft: 6 },
  choiceLetter: { color: '#fff', fontSize: 32, fontWeight: '900' },
  choiceLetterDark: { color: '#1A1A1A' },
  choiceText: { color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  choiceTextDark: { color: 'rgba(0,0,0,0.75)' },

  vsDivider: { width: 36, alignItems: 'center', justifyContent: 'center' },
  vsText: { color: '#555', fontSize: 13, fontWeight: '900' },

  waitingArea: { flex: 1, paddingHorizontal: 20, gap: 12 },
  myPickBadge: {
    backgroundColor: '#1F1F1F',
    borderRadius: 16,
    padding: 18,
    borderWidth: 2,
    borderColor: '#E63946',
    alignItems: 'center',
  },
  myPickLabel: { color: '#E63946', fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  myPickValue: { color: '#fff', fontSize: 18, fontWeight: '800' },

  waitingCard: {
    flex: 1,
    backgroundColor: '#1F1F1F',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  waitingTitle: { color: '#888', fontSize: 15, fontWeight: '600' },
  waitingCount: { color: '#FFD60A', fontSize: 18, fontWeight: '900' },

  playerStatusList: { width: '100%', marginTop: 4, gap: 8 },
  playerStatusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#2A2A2A', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  playerStatusDot: { width: 8, height: 8, borderRadius: 4 },
  dotDone:    { backgroundColor: '#22C55E' },
  dotWaiting: { backgroundColor: '#555' },
  playerStatusName: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
  playerStatusState: { color: '#888', fontSize: 12, fontWeight: '600' },
});
