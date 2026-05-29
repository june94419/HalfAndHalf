import React, { createContext, useContext, useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { auth } from '../../firebase';

// Web OAuth 팝업 완료 처리 (웹 플랫폼 전용)
WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext(null);

// ─────────────────────────────────────────────────────────────────────────────
// TODO: Firebase 콘솔 > Authentication > Sign-in method > Google 활성화 후
//       Google Cloud Console > 사용자 인증 정보에서 클라이언트 ID를 복사하여 교체하세요.
//
//  · webClientId    : OAuth 2.0 웹 클라이언트 ID
//  · iosClientId    : iOS 클라이언트 ID (번들 ID: com.halfandhalf.app)
//  · androidClientId: Android 클라이언트 ID (SHA-1 등록 필요)
//
//  또한, Firebase 콘솔 > Authentication > 승인된 도메인에
//  "auth.expo.io" 를 추가해야 Expo Go에서 리디렉션이 정상 동작합니다.
// ─────────────────────────────────────────────────────────────────────────────
const GOOGLE_WEB_CLIENT_ID = 'TODO_WEB_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = 'TODO_IOS_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = 'TODO_ANDROID_CLIENT_ID.apps.googleusercontent.com';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Google 로그인: useIdTokenAuthRequest는 Firebase에 필요한 id_token을 직접 반환
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  // Firebase Auth 상태 구독 - 앱 시작 시 기존 로그인 여부 확인
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Google OAuth 응답 처리 → Firebase 자격증명 교환
  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential).catch((error) => {
        console.error('[Auth] Google signInWithCredential 실패:', error.message);
      });
    }
  }, [response]);

  const signInWithGoogle = async () => {
    await promptAsync();
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth는 AuthProvider 안에서만 사용할 수 있습니다.');
  return context;
}
