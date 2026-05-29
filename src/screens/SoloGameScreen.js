import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ref, update, increment } from 'firebase/database';
import { db } from '../../firebase';
import { QUESTIONS } from '../data/questions';
import HalfPizza from '../components/HalfPizza';

const TOTAL = QUESTIONS.length;

export default function SoloGameScreen({ navigation }) {
  const [qIndex, setQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [disabled, setDisabled] = useState(false);

  const scaleA = useRef(new Animated.Value(1)).current;
  const scaleB = useRef(new Animated.Value(1)).current;

  const q = QUESTIONS[qIndex];

  function bounce(animRef, cb) {
    Animated.sequence([
      Animated.timing(animRef, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.timing(animRef, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(cb);
  }

  function handleAnswer(choice) {
    if (disabled) return;
    setDisabled(true);

    const animRef = choice === 'A' ? scaleA : scaleB;
    bounce(animRef, () => {
      // Firebase 누적 카운트 (fire-and-forget)
      update(ref(db, `global_stats/${q.id}`), { [choice]: increment(1) }).catch(() => {});

      const newAnswers = [...userAnswers, { id: q.id, selection: choice }];

      if (qIndex + 1 >= TOTAL) {
        navigation.replace('SoloResult', { userAnswers: newAnswers });
        return;
      }

      setUserAnswers(newAnswers);
      setQIndex(qIndex + 1);
      setDisabled(false);
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 진행률 바 */}
      <View style={styles.progressWrap}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((qIndex + 1) / TOTAL) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{qIndex + 1} / {TOTAL}</Text>
      </View>

      {/* 솔로 배지 */}
      <View style={styles.soloBadge}>
        <Text style={styles.soloBadgeText}>🍕 혼자하기</Text>
      </View>

      {/* 질문 카드 */}
      <View style={styles.questionCard}>
        <View style={styles.qHeader}>
          <HalfPizza size={28} />
          <Text style={styles.qNum}>Q{qIndex + 1}</Text>
        </View>
        <Text style={styles.qText}>{q.question}</Text>
      </View>

      {/* 선택 버튼 */}
      <View style={styles.btnRow}>
        <Animated.View style={[styles.btnWrapper, { transform: [{ scale: scaleA }] }]}>
          <TouchableOpacity
            style={[styles.choiceBtn, styles.choiceBtnA]}
            onPress={() => handleAnswer('A')}
            disabled={disabled}
            activeOpacity={0.85}
          >
            <Text style={styles.choiceLabel}>A</Text>
            <Text style={styles.choiceText}>{q.a}</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.vsDivider}>
          <Text style={styles.vsText}>VS</Text>
        </View>

        <Animated.View style={[styles.btnWrapper, { transform: [{ scale: scaleB }] }]}>
          <TouchableOpacity
            style={[styles.choiceBtn, styles.choiceBtnB]}
            onPress={() => handleAnswer('B')}
            disabled={disabled}
            activeOpacity={0.85}
          >
            <Text style={styles.choiceLabelDark}>B</Text>
            <Text style={styles.choiceTextDark}>{q.b}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  backBtn: { padding: 4 },
  backText: { color: '#888', fontSize: 22, fontWeight: '700' },
  progressBar: {
    flex: 1, height: 6,
    backgroundColor: '#2A2A2A',
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#E63946', borderRadius: 3 },
  progressText: { color: '#888', fontSize: 13, fontWeight: '700', minWidth: 40 },

  soloBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1A1200',
    borderWidth: 1.5,
    borderColor: '#FFD60A',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 20,
  },
  soloBadgeText: { color: '#FFD60A', fontSize: 12, fontWeight: '800', letterSpacing: 1 },

  questionCard: {
    backgroundColor: '#1F1F1F',
    borderRadius: 24,
    padding: 28,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  qHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  qNum: {
    color: '#E63946', fontSize: 13, fontWeight: '800',
    letterSpacing: 2,
  },
  qText: { color: '#fff', fontSize: 22, fontWeight: '800', lineHeight: 32 },

  btnRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  btnWrapper: { flex: 1 },
  choiceBtn: {
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 160,
  },
  choiceBtnA: { backgroundColor: '#E63946', marginRight: 6 },
  choiceBtnB: { backgroundColor: '#FFD60A', marginLeft: 6 },

  choiceLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '800' },
  choiceLabelDark: { color: 'rgba(0,0,0,0.3)', fontSize: 13, fontWeight: '800' },
  choiceText: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  choiceTextDark: { color: '#1A1A1A', fontSize: 18, fontWeight: '800', textAlign: 'center' },

  vsDivider: { width: 28, alignItems: 'center', justifyContent: 'center' },
  vsText: { color: '#555', fontSize: 13, fontWeight: '900' },
});
