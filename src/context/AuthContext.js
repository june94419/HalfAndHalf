import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const AuthContext = createContext(null);

// ── 카카오 앱 키 (.env.local) ──────────────────────────────────────
const KAKAO_REST_API_KEY  = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY  ?? '';
const KAKAO_CLIENT_SECRET = process.env.EXPO_PUBLIC_KAKAO_CLIENT_SECRET ?? '';

// ── 카카오 OAuth 엔드포인트 ────────────────────────────────────────
const KAKAO_AUTH_URL      = 'https://kauth.kakao.com/oauth/authorize';
const KAKAO_TOKEN_URL     = 'https://kauth.kakao.com/oauth/token';
const KAKAO_USER_INFO_URL = 'https://kapi.kakao.com/v2/user/me';

// ── Redirect URI ───────────────────────────────────────────────────
// 카카오 콘솔 > 카카오 로그인 > Redirect URI 에 동일한 값을 등록하세요.
//   개발: http://localhost:8081
//   운영: https://your-domain.com
const REDIRECT_URI = typeof window !== 'undefined'
  ? window.location.origin
  : 'http://localhost:8081';

const SESSION_KEY = 'kakao_auth_session';

// ── localStorage 세션 헬퍼 ─────────────────────────────────────────
function saveSession(data) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch {}
}
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

// ── 카카오 응답 정규화 ──────────────────────────────────────────────
function normalizeKakaoUser(raw) {
  const account = raw.kakao_account ?? {};
  const profile  = account.profile   ?? {};
  return {
    id:           `kakao_${raw.id}`,
    kakaoId:      raw.id,
    name:         profile.nickname          ?? null,
    profileImage: profile.profile_image_url ?? null,
    provider:     'kakao',
  };
}

// ── 카카오 사용자 정보 조회 ────────────────────────────────────────
async function fetchKakaoUser(accessToken) {
  const res = await fetch(KAKAO_USER_INFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`카카오 사용자 정보 조회 실패 (${res.status})`);
  return normalizeKakaoUser(await res.json());
}

// ── 인가 코드 → 토큰 교환 ─────────────────────────────────────────
async function exchangeCode(code) {
  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    client_id:     KAKAO_REST_API_KEY,
    client_secret: KAKAO_CLIENT_SECRET,
    redirect_uri:  REDIRECT_URI,
    code,
  });
  const res  = await fetch(KAKAO_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body:    body.toString(),
  });
  const text = await res.text();
  console.log('[Auth] 토큰 교환 status:', res.status, '/ body:', text);
  if (!res.ok) throw new Error(`토큰 교환 실패 (${res.status}): ${text}`);
  const json = JSON.parse(text);
  if (!json.access_token) throw new Error('access_token 없음');
  return json;
}

// ── AuthProvider ──────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const params   = new URLSearchParams(window.location.search);
        const code     = params.get('code');
        const error    = params.get('error');
        const isInvite = typeof window !== 'undefined' &&
          (window.location.pathname.startsWith('/invite') || (code && code.startsWith('ROOM_')));

        // ── 커플 초대 링크(ROOM_*)는 카카오 OAuth 처리 대상에서 제외 ─
        if (isInvite) {
          const session = loadSession();
          if (session?.user) setUser(session.user);
          setLoading(false);
          return;
        }

        // ── 카카오 리디렉트 콜백 처리 ──────────────────────────────
        if (error) {
          console.error('[Auth] 카카오 OAuth 에러:', error, params.get('error_description') ?? '');
          window.history.replaceState({}, '', '/');

        } else if (code) {
          console.log('[Auth] 인가 코드 감지 → 토큰 교환');
          window.history.replaceState({}, '', '/'); // 새로고침 시 재처리 방지

          const tokens = await exchangeCode(code);

          let kakaoUser;
          try {
            kakaoUser = await fetchKakaoUser(tokens.access_token);
            console.log('[Auth] 사용자 정보 조회 성공:', kakaoUser.id);
          } catch (err) {
            console.error('[Auth] 사용자 정보 조회 실패 (로그인 계속):', err.message);
            kakaoUser = { id: `kakao_${Date.now()}`, provider: 'kakao' };
          }

          saveSession({
            accessToken:  tokens.access_token,
            refreshToken: tokens.refresh_token ?? null,
            user:         kakaoUser,
          });
          setUser(kakaoUser);
          return;
        }

        // ── 기존 세션 복원 ─────────────────────────────────────────
        const session = loadSession();
        console.log('[Auth] 세션 로드:', session ? '있음' : '없음');

        if (session?.user) {
          console.log('[Auth] 세션 복원 (캐시):', session.user.id);
          setUser(session.user);
        } else if (session?.accessToken) {
          try {
            const kakaoUser = await fetchKakaoUser(session.accessToken);
            saveSession({ ...session, user: kakaoUser });
            setUser(kakaoUser);
          } catch {
            clearSession();
          }
        }

      } catch (err) {
        console.error('[Auth] 초기화 오류:', err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 카카오 로그인: 카카오 OAuth 페이지로 리디렉트
  const signInWithKakao = useCallback(() => {
    const url = new URL(KAKAO_AUTH_URL);
    url.searchParams.set('client_id',     KAKAO_REST_API_KEY);
    url.searchParams.set('redirect_uri',  REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope',         'profile_nickname,profile_image');
    console.log('[Auth] 카카오 로그인 리디렉트 →', url.toString());
    window.location.href = url.toString();
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setUser(null);
    console.log('[Auth] 로그아웃 완료');
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signInWithKakao, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth는 AuthProvider 안에서만 사용할 수 있습니다.');
  return context;
}
