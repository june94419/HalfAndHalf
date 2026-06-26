import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../../firebase';

export default function RoomLobbyScreen({ route, navigation }) {
  const { roomCode, nickname, isHost } = route.params;
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsub = onValue(roomRef, (snap) => {
      if (!snap.exists()) {
        navigation.replace('Home');
        return;
      }
      const data = snap.val();
      setPlayers(Object.keys(data.players || {}));

      if (data.status === 'playing') {
        navigation.replace('Game', { roomCode, nickname, isHost });
      }
    });
    return () => unsub();
  }, []);

  async function handleStart() {
    if (players.length < 2) {
      Alert.alert('앗!', '최소 2명이 있어야 시작할 수 있어요.\n친구에게 방 코드를 공유해보세요!');
      return;
    }
    await update(ref(db, `rooms/${roomCode}`), {
      status: 'playing',
      currentQuestion: 0,
    });
  }

  async function handleShare() {
    try {
      await Share.share({ message: `반반 밸런스 게임에 초대합니다! 방 코드: ${roomCode}` });
    } catch {}
  }

  async function handleCopyCode() {
    await Clipboard.setStringAsync(roomCode);
    Alert.alert('복사 완료!', `방 코드 ${roomCode}가 복사됐어요.`);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.replace('Home')} style={styles.exitBtn}>
          <Text style={styles.exitText}>← 나가기</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>대기실</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* 방 코드 카드 */}
      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>방 코드</Text>
        <Text style={styles.code}>{roomCode}</Text>
        <View style={styles.codeActions}>
          <TouchableOpacity style={styles.codeBtn} onPress={handleCopyCode} activeOpacity={0.8}>
            <Text style={styles.codeBtnText}>복사</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.codeBtn, styles.codeBtnShare]} onPress={handleShare} activeOpacity={0.8}>
            <Text style={styles.codeBtnShareText}>공유</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 참가자 목록 */}
      <View style={styles.playerSection}>
        <Text style={styles.sectionLabel}>
          참가자 {players.length}명 <Text style={styles.maxLabel}>/ 최대 10명</Text>
        </Text>
        <ScrollView style={styles.playerList} showsVerticalScrollIndicator={false}>
          {players.map((p) => (
            <View key={p} style={styles.playerRow}>
              <View style={[styles.avatar, p === players[0] && styles.avatarHost]}>
                <Text style={styles.avatarText}>{p[0]?.toUpperCase()}</Text>
              </View>
              <Text style={styles.playerName}>{p}</Text>
              <View style={styles.badges}>
                {p === nickname && (
                  <View style={styles.meBadge}>
                    <Text style={styles.meBadgeText}>나</Text>
                  </View>
                )}
                {p === players[0] && (
                  <View style={styles.hostBadge}>
                    <Text style={styles.hostBadgeText}>방장</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* 하단 버튼 */}
      {isHost ? (
        <View style={styles.bottomArea}>
          <Text style={styles.bottomHint}>
            {players.length < 2
              ? '친구에게 방 코드를 공유하세요!'
              : '모든 참가자가 준비됐으면 시작하세요!'}
          </Text>
          <TouchableOpacity
            style={[styles.startBtn, players.length < 2 && styles.startBtnDim]}
            onPress={handleStart}
            activeOpacity={0.85}
          >
            <Text style={styles.startBtnText}>🎲 게임 시작!</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.bottomArea}>
          <View style={styles.waitingBox}>
            <Text style={styles.waitingDot}>●</Text>
            <Text style={styles.waitingText}>방장이 게임을 시작할 때까지 기다려주세요...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141414' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  exitBtn: { width: 60 },
  exitText: { color: '#888', fontSize: 15 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },

  codeCard: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: '#1F1F1F',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD60A',
  },
  codeLabel: { color: '#FFD60A', fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  code: { color: '#fff', fontSize: 40, fontWeight: '900', letterSpacing: 8, marginBottom: 16 },
  codeActions: { flexDirection: 'row', gap: 10 },
  codeBtn: {
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  codeBtnShare: { backgroundColor: '#FFD60A' },
  codeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  codeBtnShareText: { color: '#1A1A1A', fontWeight: '700', fontSize: 14 },

  playerSection: {
    flex: 1,
    marginHorizontal: 20,
    marginTop: 24,
  },
  sectionLabel: { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 12 },
  maxLabel: { color: '#555', fontWeight: '500' },
  playerList: { flex: 1 },

  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarHost: { backgroundColor: '#3A2800', borderWidth: 2, borderColor: '#FFD60A' },
  avatarText: { color: '#FFD60A', fontSize: 16, fontWeight: '900' },
  playerName: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' },
  badges: { flexDirection: 'row', gap: 6 },
  meBadge: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1, borderColor: '#333',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  meBadgeText: { color: '#888', fontSize: 11, fontWeight: '700' },
  hostBadge: {
    backgroundColor: '#1A1200',
    borderWidth: 1, borderColor: '#FFD60A',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  hostBadgeText: { color: '#FFD60A', fontSize: 11, fontWeight: '700' },

  bottomArea: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 12 },
  bottomHint: { color: '#666', fontSize: 13, textAlign: 'center', marginBottom: 12 },
  startBtn: {
    backgroundColor: '#E63946',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  startBtnDim: { opacity: 0.45 },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: '900' },

  waitingBox: {
    backgroundColor: '#1F1F1F',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  waitingDot: { color: '#FFD60A', fontSize: 10 },
  waitingText: { color: '#888', fontSize: 14, fontWeight: '600', flex: 1 },
});
