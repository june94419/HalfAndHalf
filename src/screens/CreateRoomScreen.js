import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ref, set, get } from 'firebase/database';
import { db } from '../../firebase';
import { generateRoomCode } from '../utils/gameUtils';

export default function CreateRoomScreen({ navigation }) {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    const name = nickname.trim();
    if (!name) return Alert.alert('닉네임을 입력해주세요!');
    if (name.length > 8) return Alert.alert('닉네임은 8자 이하로 입력해주세요.');

    setLoading(true);
    try {
      let code;
      let exists = true;
      while (exists) {
        code = generateRoomCode();
        const snap = await get(ref(db, `rooms/${code}`));
        exists = snap.exists();
      }

      await set(ref(db, `rooms/${code}`), {
        host: name,
        status: 'lobby',
        currentQuestion: 0,
        debateQuestion: null,
        createdAt: Date.now(),
        players: { [name]: { nickname: name, joinedAt: Date.now() } },
      });

      navigation.replace('Lobby', { roomCode: code, nickname: name, isHost: true });
    } catch (e) {
      Alert.alert('오류', '방 생성에 실패했어요. 다시 시도해주세요.');
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

        <Text style={styles.title}>방 만들기</Text>
        <Text style={styles.sub}>나만의 피자 파티를 시작해봐! 🍕</Text>

        <View style={styles.inputWrap}>
          <Text style={styles.label}>닉네임</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 피자왕, 치즈러버..."
            placeholderTextColor="#555"
            value={nickname}
            onChangeText={setNickname}
            maxLength={8}
            autoFocus
          />
          <Text style={styles.hint}>{nickname.length}/8</Text>
        </View>

        <TouchableOpacity
          style={[styles.btn, (!nickname.trim() || loading) && styles.btnDisabled]}
          onPress={handleCreate}
          disabled={!nickname.trim() || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>🎲 방 코드 생성하기</Text>}
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
  inputWrap: { marginBottom: 32 },
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
    backgroundColor: '#E63946',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
