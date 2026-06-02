import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { get, ref } from 'firebase/database';
import { db } from '../../firebase';
import { BALANCE_QUESTIONS } from '../data/balanceQuestions';
import ScreenShell from '../components/ScreenShell';

export default function GameScreen({ route, navigation }) {
  const { questions: passedQuestions, category: passedCategory, roomId } = route.params;

  const [questions, setQuestions] = useState(passedQuestions ?? []);
  const [category, setCategory] = useState(passedCategory ?? '');
  const [loading, setLoading] = useState(!!roomId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [voted, setVoted] = useState(false);
  const [voteStats, setVoteStats] = useState({ a: 0, b: 0 });
  const [history, setHistory] = useState([]);

  // roomId가 있으면 Firebase에서 방 데이터를 읽어 질문 세트를 구성
  useEffect(() => {
    if (!roomId) return;
    (async () => {
      try {
        const snap = await get(ref(db, `rooms/${roomId}`));
        if (!snap.exists()) { navigation.navigate('Lobby'); return; }
        const data = snap.val();
        const roomQuestions = Object.keys(data.answersA)
          .map(idStr => BALANCE_QUESTIONS.find(q => q.id === Number(idStr)))
          .filter(Boolean);
        setQuestions(roomQuestions);
        setCategory(data.category);
        setLoading(false);
      } catch (e) {
        console.error('Failed to load room:', e);
        navigation.navigate('Lobby');
      }
    })();
  }, []);

  const currentQuestion = questions[currentIndex];

  const handleVote = (choice) => {
    if (voted) return;
    const randomA = Math.floor(Math.random() * 41) + 30;
    setVoteStats({ a: randomA, b: 100 - randomA });
    setVoted(true);
    setHistory(prev => [...prev, { questionId: currentQuestion.id, choice }]);
  };

  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
      setVoted(false);
    } else {
      navigation.replace('Result', roomId ? { roomId, history } : { category, history });
    }
  };

  const resetButton = (
    <TouchableOpacity style={styles.resetButton} onPress={() => navigation.navigate('Lobby')}>
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
    <ScreenShell rightAction={resetButton}>
      <View style={styles.gameZone}>
        <View style={styles.tagBadge}>
          <Text style={styles.tagText}>
            {currentQuestion.tag} ({currentIndex + 1} / {questions.length})
          </Text>
        </View>

        <View style={styles.questionGuideContainer}>
          <Text style={styles.questionGuideText}>
            Q. {currentQuestion.criteria || '둘 중 당신의 선택은?'}
          </Text>
        </View>

        <View style={styles.balanceContainer}>
          <TouchableOpacity
            style={[styles.optionButton, voted && styles.disabledOption]}
            onPress={() => handleVote('A')}
            disabled={voted}
          >
            <View style={styles.optionBadgeA}><Text style={styles.optionBadgeText}>선택 A</Text></View>
            <Text style={styles.questionText}>{currentQuestion.questionA}</Text>
            <Text style={styles.descText}>{currentQuestion.descA}</Text>
            {voted && <Text style={styles.statText}>{voteStats.a}%의 선택</Text>}
          </TouchableOpacity>

          <View style={styles.vsCircle}>
            <Text style={styles.vsText}>VS</Text>
          </View>

          <TouchableOpacity
            style={[styles.optionButton, styles.optionButtonB, voted && styles.disabledOption]}
            onPress={() => handleVote('B')}
            disabled={voted}
          >
            <View style={styles.optionBadgeB}><Text style={styles.optionBadgeText}>선택 B</Text></View>
            <Text style={styles.questionText}>{currentQuestion.questionB}</Text>
            <Text style={styles.descText}>{currentQuestion.descB}</Text>
            {voted && <Text style={[styles.statText, styles.statTextB]}>{voteStats.b}%의 선택</Text>}
          </TouchableOpacity>
        </View>

        {voted && (
          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>
              {currentIndex + 1 === questions.length ? '모든 가치관 결과 확인 🏁' : '다음 질문 매치 ➡️'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loadingZone: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6B7280' },
  gameZone: { flex: 1, justifyContent: 'center' },
  resetButton: { position: 'absolute', right: 15, backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  resetText: { fontSize: 12, color: '#666', fontWeight: '600' },
  tagBadge: { alignSelf: 'center', backgroundColor: '#1A1A1A', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginBottom: 10 },
  tagText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  questionGuideContainer: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, marginBottom: 14, alignItems: 'center' },
  questionGuideText: { fontSize: 15, fontWeight: '900', color: '#111827', textAlign: 'center', lineHeight: 22 },
  balanceContainer: { flex: 1, maxHeight: 420, justifyContent: 'space-between', position: 'relative' },
  optionButton: { flex: 1, backgroundColor: '#FFF9F9', borderWidth: 2, borderColor: '#FFEBEB', borderRadius: 20, padding: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 6, position: 'relative' },
  optionButtonB: { backgroundColor: '#F9FCFF', borderColor: '#EBF4FF', marginBottom: 0, marginTop: 6 },
  optionBadgeA: { position: 'absolute', top: 10, left: 12, backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  optionBadgeB: { position: 'absolute', top: 10, left: 12, backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  optionBadgeText: { fontSize: 10, fontWeight: '700', color: '#4B5563' },
  disabledOption: { opacity: 0.9 },
  questionText: { fontSize: 15, fontWeight: '900', color: '#1A1A1A', textAlign: 'center', marginBottom: 4, marginTop: 10 },
  descText: { fontSize: 12, color: '#6B7280', textAlign: 'center', paddingHorizontal: 10 },
  statText: { fontSize: 20, fontWeight: '900', color: '#EF4444', marginTop: 8 },
  statTextB: { color: '#3B82F6' },
  vsCircle: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -18 }, { translateY: -18 }], width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  vsText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  nextButton: { backgroundColor: '#1A1A1A', paddingVertical: 14, borderRadius: 14, marginTop: 14, alignItems: 'center' },
  nextButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
