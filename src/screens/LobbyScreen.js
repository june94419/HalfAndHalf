import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BALANCE_QUESTIONS } from '../data/balanceQuestions';
import ScreenShell from '../components/ScreenShell';

export default function LobbyScreen({ navigation }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const roomId = new URLSearchParams(window.location.search).get('room');
    if (roomId) {
      window.history.replaceState({}, document.title, window.location.pathname);
      navigation.replace('Game', { roomId });
    }
  }, []);

  const startGame = (type) => {
    const filtered = BALANCE_QUESTIONS.filter(q => q.type === type);
    const shuffled = [...filtered].sort(() => 0.5 - Math.random());
    const questions = shuffled.slice(0, 20);
    navigation.navigate('Game', { questions, category: type });
  };

  return (
    <ScreenShell>
      <View style={styles.landingZone}>
        <Text style={styles.mainTitle}>
          🤔 어떤 밸런스 게임을{'\n'}플레이하시겠습니까?
        </Text>

        <TouchableOpacity style={[styles.largeCard, styles.coupleCard]} onPress={() => startGame('연인')}>
          <Text style={styles.cardEmoji}>💕</Text>
          <Text style={styles.cardTitle}>연애 · 사랑</Text>
          <Text style={styles.cardSub}>환상과 현실 사이, 우리가 사랑할 때 마주하는 순간들</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.largeCard, styles.friendCard]} onPress={() => startGame('친구')}>
          <Text style={styles.cardEmoji}>🤝</Text>
          <Text style={styles.cardTitle}>우정 · 관계</Text>
          <Text style={styles.cardSub}>술자리 의리 테스트부터 숨겨진 손절 타이밍까지</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.largeCard, styles.foodCard]} onPress={() => startGame('음식')}>
          <Text style={styles.cardEmoji}>🍕</Text>
          <Text style={styles.cardTitle}>푸드 · 취향</Text>
          <Text style={styles.cardSub}>치킨 뼈순살부터 민초파까지, 절대 양보 못 할 맛의 기준</Text>
        </TouchableOpacity>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  landingZone: { width: '100%' },
  mainTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', textAlign: 'center', marginBottom: 20, lineHeight: 32 },
  largeCard: { borderWidth: 2, borderRadius: 20, padding: 16, marginBottom: 12, alignItems: 'center' },
  coupleCard: { backgroundColor: '#FFF5F5', borderColor: '#FFE3E3' },
  friendCard: { backgroundColor: '#F0F7FF', borderColor: '#D0E7FF' },
  foodCard: { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' },
  cardEmoji: { fontSize: 32, marginBottom: 4 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 2 },
  cardSub: { fontSize: 12, color: '#666', textAlign: 'center' },
});
