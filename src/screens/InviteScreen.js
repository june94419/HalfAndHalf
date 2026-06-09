import React, { useEffect, useState } from 'react';
import {
  View, Text, ActivityIndicator, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInAnonymously } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { auth, db } from '../../firebase';
import { BALANCE_QUESTIONS } from '../data/balanceQuestions';

// App.js 의 PostLoginHandler 와 공유하는 스토리지 키 (카카오 OAuth 복귀용, 유지)
export const PENDING_CODE_KEY = 'banban_pending_couple_code';

export default function InviteScreen({ route, navigation }) {
  const { code } = route.params ?? {};

  const [status, setCoupleStatus] = useState('loading'); // 'loading' | 'ready' | 'invalid'
  const [coupleData, setCoupleData] = useState(null);
  const [isStarting, setIsStarting] = useState(false);

  // ── couples/${code} fetch ─────────────────────────────────────────
  useEffect(() => {
    if (!code) { setCoupleStatus('invalid'); return; }
    (async () => {
      try {
        const snap = await get(ref(db, `couples/${code}`));
        if (!snap.exists()) { setCoupleStatus('invalid'); return; }
        setCoupleData(snap.val());
        setCoupleStatus('ready');
      } catch (e) {
        console.error('[InviteScreen] DB 조회 실패:', e);
        setCoupleStatus('invalid');
      }
    })();
  }, [code]);

  // ── 시작 버튼: 익명 로그인 → 즉시 GameScreen 진입 ────────────────
  const handleStart = async () => {
    if (!code || !coupleData || isStarting) return;
    setIsStarting(true);
    try {
      // 페이지 리다이렉트 없이 즉시 완료되는 익명 로그인
      await signInAnonymously(auth);

      const answersMap  = coupleData.creatorAnswers ?? {};
      const questionIds = Object.keys(answersMap).map(Number);
      const questions   = questionIds
        .map(id => BALANCE_QUESTIONS.find(q => q.id === id))
        .filter(Boolean);
      const category = questions[0]?.type ?? '돈';

      navigation.replace('Game', {
        coupleCode: code,
        mode:       'partner',
        questions,
        category,
      });
    } catch (e) {
      console.error('[InviteScreen] 시작 실패:', e);
      setIsStarting(false);
    }
  };

  // ── 로딩 중 ──────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#FFD60A" />
        <Text style={styles.loadingText}>초청장 확인 중...</Text>
      </SafeAreaView>
    );
  }

  // ── 유효하지 않은 코드 ───────────────────────────────────────────
  if (status === 'invalid') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.emoji}>😢</Text>
        <Text style={styles.title}>만료되거나 잘못된{'\n'}초대장입니다.</Text>
        <Text style={styles.sub}>
          링크가 만료됐거나 올바르지 않아요.{'\n'}
          연인에게 다시 공유해달라고 부탁해보세요.
        </Text>
        <TouchableOpacity style={styles.ghostBtn} onPress={() => navigation.replace('Lobby')}>
          <Text style={styles.ghostBtnText}>로비로 가기</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── 유효한 초청장 ────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.badge}>💌 초청장 도착</Text>
        <Text style={styles.emoji}>💍</Text>
        <Text style={styles.title}>결혼 가치관 초청장이{'\n'}도착했습니다!</Text>
        <Text style={styles.sub}>
          연인이 결혼 가치관 테스트 20문항을 완료했어요.{'\n'}
          지금 바로 속마음을 맞춰보세요!
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.startBtn, isStarting && styles.startBtnDisabled]}
        onPress={handleStart}
        disabled={isStarting}
        activeOpacity={0.85}
      >
        {isStarting
          ? <ActivityIndicator color="#191600" />
          : <Text style={styles.startBtnText}>속마음 맞추러 가기 💍</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.ghostBtn} onPress={() => navigation.replace('Lobby')}>
        <Text style={styles.ghostBtnText}>나중에 할게요</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#141414',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 28, gap: 12,
  },
  loadingText: { color: '#888', fontSize: 15, marginTop: 16 },

  card: {
    width: '100%', backgroundColor: '#1F1F1F',
    borderRadius: 24, padding: 28, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FFD60A',
    marginBottom: 8,
  },
  badge:  { color: '#FFD60A', fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 16 },
  emoji:  { fontSize: 52, marginBottom: 12 },
  title:  { fontSize: 22, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', lineHeight: 32, marginBottom: 12 },
  sub:    { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },

  startBtn:         { width: '100%', backgroundColor: '#FEE500', paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  startBtnDisabled: { opacity: 0.5 },
  startBtnText:     { color: '#191600', fontSize: 16, fontWeight: '900' },

  ghostBtn:     { width: '100%', borderWidth: 1.5, borderColor: '#2A2A2A', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  ghostBtnText: { color: '#555', fontSize: 14, fontWeight: '600' },
});
