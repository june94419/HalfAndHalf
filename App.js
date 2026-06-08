import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';

import { AuthProvider } from './src/context/AuthContext';
import LobbyScreen    from './src/screens/LobbyScreen';
import GameScreen     from './src/screens/GameScreen';
import ResultScreen   from './src/screens/ResultScreen';
import InviteScreen   from './src/screens/InviteScreen';

const Stack = createNativeStackNavigator();

// ── 딥링크 prefix ────────────────────────────────────────────────────
//   - 앱 실행 시: banban://  또는  halfandhalf://
//   - 웹 실행 시: https://banban.io.kr  또는  현재 origin (개발/Vercel)
const linking = {
  prefixes: [
    Linking.createURL('/'),          // 개발: exp://... / 운영: 앱 scheme
    'banban://',
    'halfandhalf://',
    'https://banban.io.kr',
    'https://half-and-half-nine.vercel.app',
  ],
  config: {
    screens: {
      Lobby: {
        path: '',
      },
      Game: {
        path: 'game',
      },
      Result: {
        path: 'result',
      },
      // /invite?code=ROOM_XXXXXX → InviteScreen({ route.params.code })
      Invite: {
        path: 'invite',
        parse: {
          code: (code) => code,
        },
      },
    },
  },
};

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer linking={linking}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Lobby"   component={LobbyScreen} />
          <Stack.Screen name="Game"    component={GameScreen} />
          <Stack.Screen name="Result"  component={ResultScreen} />
          <Stack.Screen name="Invite"  component={InviteScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>
  );
}
