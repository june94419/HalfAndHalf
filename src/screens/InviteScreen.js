import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ref, get } from 'firebase/database';
import { db } from '../../firebase';

export default function InviteScreen({ route, navigation }) {
  const { code } = route.params ?? {};
  const [status, setStatus] = useState('loading'); // 'loading' | 'found' | 'invalid'

  useEffect(() => {
    if (!code) { setStatus('invalid'); return; }
    (async () => {
      try {
        const snap = await get(ref(db, `couples/${code}`));
        if (!snap.exists()) { setStatus('invalid'); return; }
        // TODO: 매칭 플로우 진입 — 상대방 답변 저장 및 비교 화면으로 이동
        // navigation.replace('MatchGame', { coupleCode: code, coupleData: snap.val() });
        console.log('[InviteScreen] 커플 코드 확인됨:', code, snap.val());
        setStatus('found');
      } catch (e) {
        console.error('[InviteScreen] 코드 조회 실패:', e);
        setStatus('invalid');
      }
    })();
  }, [code]);

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#FFD60A" />
        <Text style={styles.loadingText}>초청장 확인 중...</Text>
      </SafeAreaView>
    );
  }

  if (status === 'invalid') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.emoji}>😢</Text>
        <Text style={styles.title}>유효하지 않은 초청장이에요</Text>
        <Text style={styles.sub}>링크가 만료됐거나 올바르지 않아요.{'\n'}연인에게 다시 공유해달라고 부탁해보세요.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.replace('Lobby')}>
          <Text style={styles.btnText}>홈으로 돌아가기</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // status === 'found' — TODO: 실제 매칭 화면으로 교체 예정
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.emoji}>💍</Text>
      <Text style={styles.title}>초청장이 확인됐어요!</Text>
      <Text style={styles.sub}>커플 코드: {code}</Text>
      <Text style={styles.comingSoon}>매칭 화면은 곧 연결됩니다.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#141414', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  loadingText:  { color: '#888', fontSize: 15, marginTop: 16 },
  emoji:        { fontSize: 56, marginBottom: 16 },
  title:        { fontSize: 22, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', marginBottom: 10 },
  sub:          { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  comingSoon:   { fontSize: 13, color: '#FFD60A', fontWeight: '700' },
  btn:          { backgroundColor: '#1F1F1F', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  btnText:      { color: '#888', fontSize: 15, fontWeight: '600' },
});
