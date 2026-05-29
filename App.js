import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import CreateRoomScreen from './src/screens/CreateRoomScreen';
import JoinRoomScreen from './src/screens/JoinRoomScreen';
import LobbyScreen from './src/screens/LobbyScreen';
import GameScreen from './src/screens/GameScreen';
import ResultScreen from './src/screens/ResultScreen';
import DebateScreen from './src/screens/DebateScreen';
import RevoteScreen from './src/screens/RevoteScreen';
import RevoteResultScreen from './src/screens/RevoteResultScreen';
import SoloGameScreen from './src/screens/SoloGameScreen';
import SoloResultScreen from './src/screens/SoloResultScreen';

const Stack = createNativeStackNavigator();

// Firebase Auth 상태 로딩 중 표시 (앱 최초 진입 시 깜빡임 방지)
function LoadingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#141414', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color="#FFD60A" size="large" />
    </View>
  );
}

// 인증 상태에 따라 Login 스택 또는 Main 스택을 결정
function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        // ── 인증된 사용자: 메인 앱 화면 ──────────────────────────
        <>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ animation: 'fade' }}
          />
          <Stack.Screen name="CreateRoom" component={CreateRoomScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="JoinRoom" component={JoinRoomScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="Lobby" component={LobbyScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="Game" component={GameScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="Result" component={ResultScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="Debate" component={DebateScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="Revote" component={RevoteScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="RevoteResult" component={RevoteResultScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="SoloGame" component={SoloGameScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="SoloResult" component={SoloResultScreen} options={{ animation: 'slide_from_right' }} />
        </>
      ) : (
        // ── 미인증: 로그인 화면 ──────────────────────────────────
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ animation: 'fade' }}
        />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
