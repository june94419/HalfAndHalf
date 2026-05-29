import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ref, onValue, update, remove } from 'firebase/database';
import { db } from '../../firebase';

export default function LobbyScreen({ route, navigation }) {
  const { roomCode, nickname, isHost } = route.params;
  const [players, setPlayers] = useState([]);
  const [host, setHost] = useState('');
  const [status, setStatus] = useState('lobby');

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsub = onValue(roomRef, (snap) => {
      if (!snap.exists()) {
        Alert.alert('방이 사라졌어요');
        navigation.replace('Home');
        return;
      }
      const data = snap.val();
      setStatus(data.status);
      setHost(data.host || '');
      setPlayers(Object.keys(data.players || {}));

      if (data.status === 'playing') {
        navigation.replace('Game', { roomCode, nickname, isHost });
      }
    });
    return () => unsub();
  }, []);

  async function handleStart() {
    if (players.length < 2) {
      Alert.alert('앗!', '최소 2명이 있어야 게임을 시작할 수 있어요.');
      return;
    }
    await update(ref(db, `rooms/${roomCode}`), { status: 'playing', currentQuestion: 0 });
  }

  async function handleLeave() {
    await remove(ref(db, `rooms/${roomCode}/players/${nickname}`));
    if (isHost) await remove(ref(db, `rooms/${roomCode}`));
    navigation.replace('Home');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>대기실 🍕</Text>
          <Text style={styles.sub}>친구들을 기다리는 중...</Text>
        </View>
        <TouchableOpacity onPress={handleLeave}>
          <Text style={styles.leaveText}>나가기</Text>
        </TouchableOpacity>
      </View>

      {/* 방 코드 */}
      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>방 코드</Text>
        <Text style={styles.code}>{roomCode}</Text>
        <Text style={styles.codeHint}>친구에게 이 코드를 알려줘!</Text>
      </View>

      {/* 참가자 목록 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>참가자 {players.length}/10</Text>
        <FlatList
          data={players}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <View style={styles.playerRow}>
              <View style={[styles.dot, item === nickname && styles.dotMe]} />
              <Text style={[styles.playerName, item === nickname && styles.playerNameMe]}>
                {item}
                {item === nickname && '  (나)'}
              </Text>
              {item === host && <Text style={styles.hostBadge}>방장</Text>}
            </View>
          )}
          style={styles.list}
        />
      </View>

      {isHost ? (
        <TouchableOpacity
          style={[styles.btn, players.length < 2 && styles.btnDisabled]}
          onPress={handleStart}
          disabled={players.length < 2}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>🎮 게임 시작!</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.waitingBox}>
          <Text style={styles.waitingText}>⏳ 방장이 게임을 시작할 때까지 기다려줘...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414', paddingHorizontal: 24, paddingTop: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  title: { fontSize: 30, fontWeight: '900', color: '#fff' },
  sub: { color: '#888', fontSize: 14, marginTop: 4 },
  leaveText: { color: '#E63946', fontSize: 15, fontWeight: '700' },
  codeCard: {
    backgroundColor: '#E63946',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 28,
  },
  codeLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  code: { fontSize: 44, fontWeight: '900', color: '#fff', letterSpacing: 8 },
  codeHint: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 8 },
  section: { flex: 1 },
  sectionTitle: { color: '#FFD60A', fontSize: 13, fontWeight: '700', letterSpacing: 1, marginBottom: 14 },
  list: { flex: 1 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    gap: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#444' },
  dotMe: { backgroundColor: '#FFD60A' },
  playerName: { flex: 1, color: '#ccc', fontSize: 16, fontWeight: '600' },
  playerNameMe: { color: '#FFD60A' },
  hostBadge: {
    backgroundColor: '#E63946',
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  btn: {
    backgroundColor: '#FFD60A',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 20,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#1A1A1A', fontSize: 18, fontWeight: '800' },
  waitingBox: {
    backgroundColor: '#2A2A2A',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 20,
  },
  waitingText: { color: '#888', fontSize: 14 },
});
