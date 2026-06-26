import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import HalfPizza from '../components/HalfPizza';

export default function LoginScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <View style={styles.logoArea}>
          <View style={styles.pizzaWrap}>
            <HalfPizza size={140} />
          </View>
          <Text style={styles.appName}>반반</Text>
          <Text style={styles.appSub}>Half & Half</Text>
          <Text style={styles.tagline}>친구들과 즐기는 밸런스 게임</Text>
        </View>
        <View style={styles.loginArea}>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => navigation?.replace?.('Lobby')}
            activeOpacity={0.85}
          >
            <Text style={styles.startBtnText}>시작하기</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.terms}>
          시작하면 서비스 이용약관 및{'\n'}개인정보처리방침에 동의하게 됩니다.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141414' },
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 32, paddingTop: 60, paddingBottom: 40,
  },
  logoArea: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  pizzaWrap: { marginBottom: 24 },
  appName: { fontSize: 56, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1 },
  appSub: { fontSize: 18, color: '#FFD60A', fontWeight: '700', letterSpacing: 4, marginTop: -4 },
  tagline: { fontSize: 14, color: '#666', marginTop: 14, fontWeight: '500' },
  loginArea: { width: '100%', marginBottom: 24 },
  startBtn: {
    width: '100%', height: 54, borderRadius: 16,
    backgroundColor: '#FFD60A', alignItems: 'center', justifyContent: 'center',
  },
  startBtnText: { fontSize: 16, fontWeight: '700', color: '#191919' },
  terms: { color: '#444', fontSize: 11, textAlign: 'center', lineHeight: 17, fontWeight: '500' },
});
