import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { get, ref } from 'firebase/database';
import { db } from '../../firebase';
import ScreenShell from '../components/ScreenShell';
import { trackEvent } from '../utils/analytics';
import { loadQuestions, pickQuestions, getCachedQuestionsSync } from '../utils/questionsDB';
import { BALANCE_QUESTIONS } from '../data/balanceQuestions';

export default function LobbyScreen({ navigation }) {
  const [starting, setStarting] = useState(null);  // UI 인디케이터용 상태
  const isStartingRef = useRef(false);              // 중복 실행 원천 차단 자물쇠 (클로저 오염 면역)

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);

    // 레거시 룸 시스템
    const roomId = params.get('room');
    if (roomId) {
      window.history.replaceState({}, document.title, window.location.pathname);
      navigation.replace('Game', { roomId });
      return;
    }

    // 커플 초대 코드 — TossDeepLinkHandler(getQueryParameters) 실패 시 2차 보호
    // Firebase 상태 확인: completed → PartnerCompleteScreen, waiting → B 초대 화면
    const code = params.get('code');
    if (code) {
      window.history.replaceState({}, document.title, window.location.pathname);
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
    }
  }, []);

  // Firebase 질문 사전 로드 (백그라운드, UX 블로킹 없음)
  useEffect(() => {
    loadQuestions().catch(() => {});
  }, []);

  const startGame = async (type) => {
    // ── useRef 이중 자물쇠 — 렌더링 꼬임·stale closure 에 의한 중복 실행 원천 차단 ──
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setStarting(type);
    trackEvent('game_start_button_clicked', { category: type });

    // 멱살 폴백: 이유를 불문하고 유저를 게임으로 강제 이동시키는 최후 수단
    const forceNavigate = (questions) => {
      navigation.navigate('Game', { questions, category: type });
    };
    const localEscape = () => {
      console.log(`[LobbyScreen] 🚨 로컬 폴백 탈출: ${type}`);
      const q = pickQuestions(getCachedQuestionsSync(), type);
      forceNavigate(q.length ? q : BALANCE_QUESTIONS.filter(x => x.type === type).slice(0, 20));
    };

    try {
      console.log(`[LobbyScreen] startGame 시작: ${type}`);

      // ① Firebase 로드 + 3초 탈출 타임아웃 (questionsDB 5초 타임아웃보다 짧게)
      const allQ = await Promise.race([
        loadQuestions(),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error('lobby_escape_timeout')), 3000)
        ),
      ]);

      console.log(`[LobbyScreen] loadQuestions 반환: ${allQ?.length ?? 0}개`);

      const questions = pickQuestions(allQ, type);
      console.log(`[LobbyScreen] pickQuestions('${type}'): ${questions.length}개`);

      if (!questions.length) throw new Error(`no_questions_for_type:${type}`);
      forceNavigate(questions);
    } catch (e) {
      console.error('[CRITICAL] 로비 카테고리 에러 원인:', e?.message ?? e, '| type:', type);
      localEscape(); // 어떤 에러에도 유저를 절대 가두지 않는다
    } finally {
      setStarting(null);
      isStartingRef.current = false; // 자물쇠 해제 — 다음 게임 플레이 대비
    }
  };

  return (
    <ScreenShell contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.landingZone}>
          <Image
            source={
              Platform.OS === 'web'
                ? { uri: '/main-logo.png' }
                : require('../../assets/main-logo.png')
            }
            style={styles.mainLogo}
            resizeMode="contain"
          />
          <Text style={styles.mainTitle}>
            🤔 어떤 밸런스 게임을{'\n'}플레이하시겠습니까?
          </Text>

          <TouchableOpacity
            style={[styles.largeCard, styles.moneyCard, starting && styles.cardDisabled]}
            onPress={() => startGame('돈')}
            disabled={!!starting}
            activeOpacity={0.85}
          >
            {starting === '돈'
              ? <ActivityIndicator color="#1A1A1A" size="small" />
              : <>
                  <Text style={styles.cardEmoji}>💰</Text>
                  <Text style={styles.cardTitle}>돈 &amp; 재테크</Text>
                  <Text style={styles.cardSub}>통장 공개부터 소비 철학까지, 돈 앞에서 드러나는 우리의 민낯</Text>
                </>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.largeCard, styles.familyCard, starting && styles.cardDisabled]}
            onPress={() => startGame('시댁')}
            disabled={!!starting}
            activeOpacity={0.85}
          >
            {starting === '시댁'
              ? <ActivityIndicator color="#1A1A1A" size="small" />
              : <>
                  <Text style={styles.cardEmoji}>🏠</Text>
                  <Text style={styles.cardTitle}>서로의 가족</Text>
                  <Text style={styles.cardSub}>명절·용돈·동거… 현실 부부의 가장 뜨거운 갈등 지점</Text>
                </>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.largeCard, styles.lifeCard, starting && styles.cardDisabled]}
            onPress={() => startGame('라이프')}
            disabled={!!starting}
            activeOpacity={0.85}
          >
            {starting === '라이프'
              ? <ActivityIndicator color="#1A1A1A" size="small" />
              : <>
                  <Text style={styles.cardEmoji}>🌿</Text>
                  <Text style={styles.cardTitle}>라이프스타일</Text>
                  <Text style={styles.cardSub}>잠버릇부터 여행 스타일까지, 함께 살아야 보이는 것들</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  landingZone: { width: '100%', alignItems: 'center' },
  mainLogo: { width: '100%', maxWidth: 320, height: 180, marginBottom: 16 },
  mainTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', textAlign: 'center', marginBottom: 20, lineHeight: 32, wordBreak: 'keep-all', overflowWrap: 'break-word' },
  largeCard: { width: '100%', borderWidth: 2, borderRadius: 20, padding: 16, marginBottom: 12, alignItems: 'center', minHeight: 90, justifyContent: 'center' },
  cardDisabled: { opacity: 0.6 },
  moneyCard: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  familyCard: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  lifeCard:   { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' },
  cardEmoji: { fontSize: 32, marginBottom: 4 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 2 },
  cardSub: { fontSize: 12, color: '#666', textAlign: 'center', lineHeight: 18, wordBreak: 'keep-all', overflowWrap: 'break-word' },
});