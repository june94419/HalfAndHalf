import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import HalfPizza from '../components/HalfPizza';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { signInWithKakao } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  const handleKakaoLogin = async () => {
    setSigningIn(true);
    try {
      await signInWithKakao();
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      <View style={styles.container}>
        {/* 로고 영역 */}
        <View style={styles.logoArea}>
          <View style={styles.pizzaWrap}>
            <HalfPizza size={140} />
          </View>
          <Text style={styles.appName}>반반</Text>
          <Text style={styles.appSub}>Half & Half</Text>
          <Text style={styles.tagline}>친구들과 즐기는 밸런스 게임</Text>
        </View>

        {/* 로그인 버튼 영역 */}
        <View style={styles.loginArea}>
          <Text style={styles.loginPrompt}>로그인하고 게임 시작!</Text>

          {/* 카카오 로그인 */}
          <TouchableOpacity
            style={[styles.socialBtn, styles.kakaoBtn, signingIn && styles.btnDisabled]}
            onPress={handleKakaoLogin}
            activeOpacity={0.85}
            disabled={signingIn}
          >
            {signingIn ? (
              <ActivityIndicator color="#191919" size="small" />
            ) : (
              <Text style={styles.kakaoIcon}>K</Text>
            )}
            <Text style={styles.kakaoBtnText}>카카오로 계속하기</Text>
          </TouchableOpacity>

          {/* TODO: Apple 로그인 (iOS App Store 정책상 필수) */}
          {/* <TouchableOpacity style={[styles.socialBtn, styles.appleBtn]}>
            <Text style={styles.appleBtnText}>Apple로 계속하기</Text>
          </TouchableOpacity> */}
        </View>

        <Text style={styles.terms}>
          로그인하면 서비스 이용약관 및{'\n'}개인정보처리방침에 동의하게 됩니다.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#141414',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 40,
  },

  // 로고
  logoArea: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  pizzaWrap: {
    marginBottom: 24,
  },
  appName: {
    fontSize: 56,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  appSub: {
    fontSize: 18,
    color: '#FFD60A',
    fontWeight: '700',
    letterSpacing: 4,
    marginTop: -4,
  },
  tagline: {
    fontSize: 14,
    color: '#666',
    marginTop: 14,
    fontWeight: '500',
  },

  // 로그인 버튼 영역
  loginArea: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  loginPrompt: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 0.5,
  },

  // 공통 소셜 버튼
  socialBtn: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  btnDisabled: {
    opacity: 0.6,
  },

  // Kakao
  kakaoBtn: {
    backgroundColor: '#FEE500',
  },
  kakaoIcon: {
    fontSize: 18,
    fontWeight: '900',
    color: '#191919',
  },
  kakaoBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.85)',
  },

  // 이용약관
  terms: {
    color: '#444',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
    fontWeight: '500',
  },
});
