import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import { BALANCE_QUESTIONS } from '../data/balanceQuestions';
import ScreenShell from '../components/ScreenShell';
import { trackEvent } from '../utils/analytics';

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
    trackEvent('game_start_button_clicked', { category: type });
    const filtered = BALANCE_QUESTIONS.filter(q => q.type === type);
    const shuffled = [...filtered].sort(() => 0.5 - Math.random());
    const questions = shuffled.slice(0, 20);
    navigation.navigate('Game', { questions, category: type });
  };

  return (
    <ScreenShell>
      <View style={styles.landingZone}>
        <Image
          source={
            Platform.OS === 'web'
              ? { uri: '/main-logo.png' }
              : require('../../assets/main-logo.png')
          }
          style={styles.mainLogo}
          resizeMode="contain"
        />
        <Text style={styles.mainTitle}>
          🤔 어떤 밸런스 게임을{'\n'}플레이하시겠습니까?
        </Text>

        <TouchableOpacity style={[styles.largeCard, styles.moneyCard]} onPress={() => startGame('돈')}>
          <Text style={styles.cardEmoji}>💰</Text>
          <Text style={styles.cardTitle}>돈 &amp; 재테크</Text>
          <Text style={styles.cardSub}>통장 공개부터 소비 철학까지, 돈 앞에서 드러나는 우리의 민낯</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.largeCard, styles.familyCard]} onPress={() => startGame('시댁')}>
          <Text style={styles.cardEmoji}>🏠</Text>
          <Text style={styles.cardTitle}>서로의 가족</Text>
          <Text style={styles.cardSub}>명절·용돈·동거… 현실 부부의 가장 뜨거운 갈등 지점</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.largeCard, styles.lifeCard]} onPress={() => startGame('라이프')}>
          <Text style={styles.cardEmoji}>🌿</Text>
          <Text style={styles.cardTitle}>라이프스타일</Text>
          <Text style={styles.cardSub}>잠버릇부터 여행 스타일까지, 함께 살아야 보이는 것들</Text>
        </TouchableOpacity>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  landingZone: { width: '100%', alignItems: 'center' },
  mainLogo: { width: '100%', maxWidth: 320, height: 180, marginBottom: 16 },
  mainTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', textAlign: 'center', marginBottom: 20, lineHeight: 32 },
  largeCard: { borderWidth: 2, borderRadius: 20, padding: 16, marginBottom: 12, alignItems: 'center' },
  moneyCard: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  familyCard: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  lifeCard:   { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' },
  cardEmoji: { fontSize: 32, marginBottom: 4 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 2 },
  cardSub: { fontSize: 12, color: '#666', textAlign: 'center' },
});
