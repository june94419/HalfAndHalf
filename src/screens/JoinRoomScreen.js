import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ref, get, update } from 'firebase/database';
import { db } from '../../firebase';

export default function JoinRoomScreen({ navigation }) {
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    const roomCode = code.trim().toUpperCase();
    const name = nickname.trim();
    if (!roomCode || roomCode.length !== 6) return Alert.alert('6자리 방 코드를 입력해주세요!');
    if (!name) return Alert.alert('닉네임을 입력해주세요!');
    if (name.length > 8) return Alert.alert('닉네임은 8자 이하로 입력해주세요.');

    setLoading(true);
    try {
      const snap = await get(ref(db, `rooms/${roomCode}`));
      if (!snap.exists()) {
        Alert.alert('앗!', '존재하지 않는 방 코드예요.');
        return;
      }
      const room = snap.val();
      if (room.status !== 'lobby') {
        Alert.alert('앗!', '이미 게임이 시작된 방이에요.');
        return;
      }
      const players = room.players || {};
      if (Object.keys(players).length >= 10) {
        Alert.alert('앗!', '방이 꽉 찼어요! (최대 10명)');
        return;
      }
      if (players[name]) {
        Alert.alert('앗!', '이미 같은 닉네임이 있어요. 다른 닉네임을 써주세요.');
        return;
      }

      await update(ref(db, `rooms/${roomCode}/players`), {
        [name]: { nickname: name, joinedAt: Date.now() },
      });

      navigation.replace('Lobby', { roomCode, nickname: name, isHost: false });
    } catch (e) {
      Alert.alert('오류', '방 참가에 실패했어요. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>

        <Text style={styles.title}>방 참가하기</Text>
        <Text style={styles.sub}>피자 파티에 합류해봐! 🧀</Text>

        <View style={styles.inputWrap}>
          <Text style={styles.label}>방 코드 (6자리)</Text>
          <TextInput
            style={styles.input}
            placeholder="예: AB3K9Z"
            placeholderTextColor="#555"
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            maxLength={6}
            autoCapitalize="characters"
            autoFocus
          />
        </View>

        <View style={styles.inputWrap}>
          <Text style={styles.label}>닉네임</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 치즈마니아, 핫소스..."
            placeholderTextColor="#555"
            value={nickname}
            onChangeText={setNickname}
            maxLength={8}
          />
          <Text style={styles.hint}>{nickname.length}/8</Text>
        </View>

        <TouchableOpacity
          style={[styles.btn, (code.length < 6 || !nickname.trim() || loading) && styles.btnDisabled]}
          onPress={handleJoin}
          disabled={code.length < 6 || !nickname.trim() || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#1A1A1A" />
            : <Text style={styles.btnText}>🍕 입장하기</Text>}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414' },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  back: { marginBottom: 30 },
  backText: { color: '#888', fontSize: 16 },
  title: { fontSize: 36, fontWeight: '900', color: '#fff', marginBottom: 6 },
  sub: { fontSize: 15, color: '#888', marginBottom: 40 },
  inputWrap: { marginBottom: 24 },
  label: { color: '#FFD60A', fontSize: 13, fontWeight: '700', marginBottom: 10, letterSpacing: 1 },
  input: {
    backgroundColor: '#2A2A2A',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
    borderWidth: 2,
    borderColor: '#333',
  },
  hint: { color: '#555', fontSize: 12, textAlign: 'right', marginTop: 6 },
  btn: {
    backgroundColor: '#FFD60A',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#1A1A1A', fontSize: 18, fontWeight: '800' },
});
