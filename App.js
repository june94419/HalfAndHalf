import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { graniteEvent, getQueryParameters } from '@apps-in-toss/web-framework';
import { get, ref } from 'firebase/database';
import { db } from './firebase';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PENDING_CODE_KEY }       from './src/screens/InviteScreen';
import { initGA }                 from './src/utils/analytics';
import LobbyScreen  from './src/screens/LobbyScreen';
import GameScreen   from './src/screens/GameScreen';
import ResultScreen from './src/screens/ResultScreen';
import InviteScreen from './src/screens/InviteScreen';

const Stack = createNativeStackNavigator();

// ── 딥링크 prefix ────────────────────────────────────────────────────
const linking = {
  prefixes: [
    Linking.createURL('/'),
    'banban://',
    'halfandhalf://',
    'https://banban.io.kr',
    'https://half-and-half-nine.vercel.app',
  ],
  config: {
    screens: {
      Lobby:  { path: '' },
      Game:   { path: 'game' },
      Result: { path: 'result' },
      Invite: { path: 'invite', parse: { code: (c) => c } },
    },
  },
};

// ── 토스 하드웨어/상단 뒤로가기 브릿지 ────────────────────────────────
// 안드로이드 하드웨어 뒤로가기 및 토스 상단 네이티브 뒤로가기 버튼을
// React Navigation 스택과 연결한다.
function TossBackBridge() {
  const navigation = useNavigation();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let unsubscribe;
    try {
      unsubscribe = graniteEvent.addEventListener('backEvent', {
        onEvent: () => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        },
      });
    } catch {}
    return () => { try { unsubscribe?.(); } catch {} };
  }, [navigation]);

  return null;
}

// ── 토스 딥링크 진입점 파서 ─────────────────────────────────────────
// intoss://halfandhalf?code=XXX 또는 supertoss://apps/public/halfandhalf?code=XXX 진입 시
// Toss WebView 는 path 를 제거하고 쿼리만 root URL 에 붙여 전달한다.
// getQueryParameters() (Toss 브릿지 우선) + URLSearchParams (웹 폴백) 이중 보호.
//
// Firebase 상태 분기:
//   status === 'completed' → A 가 푸시 클릭 후 재진입 → ResultScreen 직행 (로비·초대 화면 생략)
//   status !== 'completed' → B 가 초대 링크 클릭 → InviteScreen 으로 이동
function TossDeepLinkHandler() {
  const navigation = useNavigation();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let code = null;
    try {
      const params = getQueryParameters();
      code = params?.code ?? null;
    } catch {}
    if (!code && typeof window !== 'undefined') {
      code = new URLSearchParams(window.location.search).get('code') ?? null;
    }
    if (!code) return;

    // Firebase 상태 확인 후 즉시 분기
    // completed → PartnerCompleteScreen("결과 확인하기" 버튼) 직행 (A 푸시 클릭 포함)
    // 그 외    → B 초대 화면
    (async () => {
      try {
        const snap = await get(ref(db, `couples/${code}`));
        if (snap.exists() && snap.val()?.status === 'completed') {
          navigation.replace('Result', { coupleCode: code, isPartner: true });
          return;
        }
      } catch {}
      navigation.replace('Invite', { code });
    })();
  }, []);

  return null;
}

// ── 로그인 후 대기 중인 초대 코드를 InviteScreen 으로 라우팅
// NavigationContainer 안에서만 useNavigation 을 쓸 수 있으므로 별도 컴포넌트로 분리
function PostLoginHandler() {
  const { user } = useAuth();
  const navigation = useNavigation();

  useEffect(() => {
    if (!user) return;
    try {
      const pendingCode = localStorage.getItem(PENDING_CODE_KEY);
      if (!pendingCode) return;
      localStorage.removeItem(PENDING_CODE_KEY);
      navigation.navigate('Invite', { code: pendingCode });
    } catch {}
  }, [user]);

  return null;
}

// ── 내비게이션 루트 (AuthProvider 안 + NavigationContainer 안에서 실행) ──
function InnerApp() {
  return (
    <>
      <TossBackBridge />
      <TossDeepLinkHandler />
      <PostLoginHandler />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Lobby"   component={LobbyScreen} />
        <Stack.Screen name="Game"    component={GameScreen} />
        <Stack.Screen name="Result"  component={ResultScreen} />
        <Stack.Screen name="Invite"  component={InviteScreen} />
      </Stack.Navigator>
    </>
  );
}

// 외부 웹 환경 감지 — Toss 인앱 WebView와 명확히 구분
// Toss 인앱: window.toss 또는 Granite 런타임 존재, 혹은 외부 도메인 불일치
// 외부 웹: banban.io.kr / vercel.app / localhost 등 실제 외부 도메인에서만 true
function isExternalWebEnv() {
  if (typeof window === 'undefined') return false;
  // 토스 인앱 브리지/런타임 감지 → Toss 환경 확정
  if (window.toss || window.__granite || window.__GRANITE__) return false;
  const hostname = window.location?.hostname ?? '';
  // 빈 hostname 또는 file: 프로토콜 → Toss 내부 번들 서빙으로 간주
  if (!hostname || window.location?.protocol === 'file:') return false;
  // 허용된 외부 도메인 목록 (이 외는 Toss 인앱 내부 URL로 간주)
  return (
    hostname === 'banban.io.kr' ||
    hostname.endsWith('.banban.io.kr') ||
    hostname.includes('vercel.app') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.')
  );
}

// Kakao SDK 동적 주입 + 초기화 — 외부 웹 전용
// ─ 정적 <script integrity="..."> 없이 JS createElement 로 생성 → SRI 검사 완전 우회
// ─ Toss 인앱에서는 Toss share() API 사용하므로 Kakao SDK 불필요
function loadKakaoSDK() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  // 토스 인앱 환경 → 기존 순정 로직 보존, Kakao 주입 생략
  if (!isExternalWebEnv()) return;
  // 이미 로드됐으면 스킵
  if (document.querySelector('script[data-kakao-sdk]')) return;
  try {
    const script = document.createElement('script');
    script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
    script.setAttribute('data-kakao-sdk', '1');
    // integrity / crossorigin 속성 미설정 — SRI 오류 원천 차단
    script.onload = () => {
      try {
        if (window.Kakao?.isInitialized?.()) return;
        const jsKey = process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? '';
        if (jsKey) window.Kakao?.init?.(jsKey);
      } catch {}
    };
    script.onerror = () => {};
    document.head.appendChild(script);
  } catch {}
}

export default function App() {
  initGA();

  useEffect(() => {
    loadKakaoSDK();
  }, []);

  return (
    <AuthProvider>
      <NavigationContainer linking={linking}>
        <InnerApp />
      </NavigationContainer>
    </AuthProvider>
  );
}
