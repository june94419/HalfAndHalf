import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import * as Linking from 'expo-linking';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PENDING_CODE_KEY }       from './src/screens/InviteScreen';
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

// ── 카카오 로그인 후 복귀 시 대기 중인 초대 코드를 InviteScreen 으로 라우팅 ──
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
      // InviteScreen 이 재마운트되면 coupleData 재조회 후 Game 으로 진입
      navigation.navigate('Invite', { code: pendingCode });
    } catch {}
  }, [user]);

  return null;
}

// ── 내비게이션 루트 (AuthProvider 안 + NavigationContainer 안에서 실행) ──
function InnerApp() {
  return (
    <>
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

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer linking={linking}>
        <InnerApp />
      </NavigationContainer>
    </AuthProvider>
  );
}
