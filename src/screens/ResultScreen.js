import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  ScrollView, StyleSheet, ActivityIndicator,
  Alert, Platform,
} from 'react-native';
import { signInAnonymously } from 'firebase/auth';
import { ref, push, set, get, update, serverTimestamp } from 'firebase/database';
import * as Clipboard from 'expo-clipboard';
import { auth, db } from '../../firebase';
import { BALANCE_QUESTIONS } from '../data/balanceQuestions';
import ScreenShell from '../components/ScreenShell';

const CATEGORY_LABEL = { '돈': '돈 & 재테크', '시댁': '시댁 & 처가', '라이프': '라이프스타일' };
const getChoiceText = (question, choice) => choice === 'A' ? question.questionA : question.questionB;

export default function ResultScreen({ route, navigation }) {
  const { category: passedCategory, history, roomId } = route.params;
  const isUserB = !!roomId;

  // ── UserA 상태 ────────────────────────────────────────────────
  const [createdRoomId, setCreatedRoomId] = useState(null);
  const [roomStatus, setRoomStatus] = useState('creating');
  const [copied, setCopied] = useState(false);
  const [kakaoSharing, setKakaoSharing] = useState(false);
  const [kakaoShared, setKakaoShared] = useState(false);

  // ── UserB 상태 ────────────────────────────────────────────────
  const [compareStatus, setCompareStatus] = useState('saving');
  const [comparison, setComparison] = useState(null);
  const [compromises, setCompromises] = useState({});
  const [savingCompromise, setSavingCompromise] = useState(false);
  const [compromiseSaved, setCompromiseSaved] = useState(false);

  useEffect(() => {
    isUserB ? setupUserB() : createRoom();
  }, []);

  // ── ?room= 파라미터를 지우고 로비로 이동 ─────────────────────
  const goHome = () => {
    if (typeof window !== 'undefined' && window.history) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    navigation.navigate('Lobby');
  };

  // ── 가치관 백서 알림 ──────────────────────────────────────────
  const handleArchivePress = () => {
    const title = '우리만의 가치관 백서';
    const message =
      '두 분이 치열하게 토론하고 합의한 소중한 가치관 데이터는 마이페이지에 보관됩니다.\n마이페이지 기능은 정식 출시 후 로그인 시 제공됩니다! 💕';
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // ── UserA: 방 생성 ────────────────────────────────────────────
  const createRoom = async () => {
    try {
      const { user } = await signInAnonymously(auth);
      const answersA = history.reduce((acc, { questionId, choice }) => {
        acc[questionId] = choice;
        return acc;
      }, {});
      const roomRef = push(ref(db, 'rooms'));
      await set(roomRef, {
        createdAt: serverTimestamp(),
        category: passedCategory,
        userA: user.uid,
        answersA,
      });
      setCreatedRoomId(roomRef.key);
      setRoomStatus('done');
    } catch (e) {
      console.error('Room creation failed:', e);
      setRoomStatus('error');
    }
  };

  const handleShare = async () => {
    const base = typeof window !== 'undefined'
      ? window.location.origin
      : 'https://half-and-half-nine.vercel.app';
    const shareUrl = `${base}?room=${createdRoomId}`;

    // 클립보드 복사 (항상 실행)
    await Clipboard.setStringAsync(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);

    // 카카오톡 공유 (웹 전용)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const Kakao = window.Kakao;
      if (!Kakao) return;
      if (!Kakao.isInitialized()) {
        Kakao.init('5794780a6ba882582fb21d5794ae3007');
      }
      Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: '🤔 우리 연애 가치관은 몇 %나 맞을까?',
          description:
            '연인이 푸드·데이트·재무 취향 20문제를 풀고 기다리고 있어요. 지금 들어와서 조율해 보세요! 💕',
          imageUrl: 'https://half-and-half-nine.vercel.app/favicon.ico',
          link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
        },
        buttons: [
          {
            title: '가치관 조율하러 가기',
            link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
          },
        ],
      });
    }
  };

  // ── 카톡 공유: 커플 코드 생성 → couples/ 저장 → Kakao 피드 발송 ──
  const handleKakaoShare = async () => {
    if (kakaoSharing) return;
    setKakaoSharing(true);
    try {
      // 1. ROOM_ + 대문자 6자리 커플 코드 생성
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let coupleCode = 'ROOM_';
      for (let i = 0; i < 6; i++) coupleCode += chars[Math.floor(Math.random() * 26)];

      // 2. 익명 로그인 & Firebase couples/ 저장
      const { user } = await signInAnonymously(auth);
      const creatorAnswers = history.reduce((acc, { questionId, choice }) => {
        acc[questionId] = choice;
        return acc;
      }, {});
      await set(ref(db, `couples/${coupleCode}`), {
        creatorId: user.uid,
        creatorAnswers,
        status: 'progress',
        createdAt: new Date().toISOString(),
        fakePaid: false,
      });

      // 3. 카카오 공유 (웹 전용)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const Kakao = window.Kakao;
        if (Kakao) {
          if (!Kakao.isInitialized()) Kakao.init('b9f9b7e040f0bea355301a5149a7512b');
          const inviteUrl = `https://banban.io.kr/invite?code=${coupleCode}`;
          Kakao.Share.sendDefault({
            objectType: 'feed',
            content: {
              title: '💍 결혼 가치관 초청장이 도착했습니다.',
              description: '연인분이 결혼 가치관 테스트 20문항을 완료했습니다! 지금 앱을 깔고 속마음을 매칭해보세요.',
              imageUrl: 'https://half-and-half-nine.vercel.app/og-image.png',
              link: { mobileWebUrl: inviteUrl, webUrl: inviteUrl },
            },
            buttons: [{ title: '가치관 매칭하러 가기', link: { mobileWebUrl: inviteUrl, webUrl: inviteUrl } }],
          });
        }
      }

      setKakaoShared(true);
      setTimeout(() => setKakaoShared(false), 3000);
    } catch (e) {
      console.error('Kakao share failed:', e);
      if (Platform.OS === 'web') {
        window.alert('공유에 실패했어요. 다시 시도해주세요.');
      } else {
        Alert.alert('오류', '공유에 실패했어요. 다시 시도해주세요.');
      }
    } finally {
      setKakaoSharing(false);
    }
  };

  // ── UserB: answersB 저장 → 비교 데이터 구성 ──────────────────
  const setupUserB = async () => {
    try {
      const { user } = await signInAnonymously(auth);
      const answersB = history.reduce((acc, { questionId, choice }) => {
        acc[questionId] = choice;
        return acc;
      }, {});
      await update(ref(db, `rooms/${roomId}`), { answersB, userB: user.uid });

      const snap = await get(ref(db, `rooms/${roomId}`));
      if (!snap.exists()) throw new Error('Room not found');
      buildComparison(snap.val());
      setCompareStatus('ready');
    } catch (e) {
      console.error('Setup failed:', e);
      setCompareStatus('error');
    }
  };

  const buildComparison = ({ answersA, answersB, category, compromises: saved }) => {
    const matching = [];
    const different = [];
    Object.keys(answersA).forEach(idStr => {
      const question = BALANCE_QUESTIONS.find(q => q.id === Number(idStr));
      if (!question) return;
      const choiceA = answersA[idStr];
      const choiceB = answersB?.[idStr];
      if (choiceA === choiceB) {
        matching.push({ question, choice: choiceA });
      } else {
        different.push({ question, choiceA, choiceB: choiceB ?? '?' });
      }
    });
    setComparison({ category, matching, different });
    if (saved) setCompromises(saved);
  };

  const handleSaveCompromises = async () => {
    if (savingCompromise) return;
    const entries = Object.entries(compromises).filter(([, v]) => v?.trim());
    if (!entries.length) return;
    setSavingCompromise(true);
    try {
      const updates = {};
      entries.forEach(([qId, text]) => {
        updates[`rooms/${roomId}/compromises/${qId}`] = text.trim();
      });
      await update(ref(db), updates);
      setCompromiseSaved(true);
      setTimeout(() => setCompromiseSaved(false), 3000);
    } catch (e) {
      console.error('Save compromises failed:', e);
    } finally {
      setSavingCompromise(false);
    }
  };

  // ── UserA 렌더 ────────────────────────────────────────────────
  if (!isUserB) {
    return (
      <ScreenShell>
        <View style={styles.centerContainer}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.title}>모든 질문 완료!</Text>
          <Text style={styles.subtitle}>
            {CATEGORY_LABEL[passedCategory] || passedCategory} 카테고리의{'\n'}모든 밸런스 게임을 마쳤어요.
          </Text>

          <View style={styles.shareSection}>
            {roomStatus === 'creating' && (
              <Text style={styles.dimText}>공유 링크 생성 중...</Text>
            )}
            {roomStatus === 'error' && (
              <Text style={styles.errorText}>링크 생성에 실패했습니다.</Text>
            )}
            {roomStatus === 'done' && createdRoomId && (
              <>
                <TouchableOpacity
                  style={[styles.kakaoBtn, kakaoShared && styles.primaryBtnGreen]}
                  onPress={handleKakaoShare}
                  disabled={kakaoSharing}
                >
                  <Text style={styles.kakaoBtnText}>
                    {kakaoShared ? '✅ 초청장을 보냈어요!' : kakaoSharing ? '전송 중...' : '💬 카톡으로 공유하기'}
                  </Text>
                  {!kakaoShared && !kakaoSharing && (
                    <Text style={styles.kakaoBtnSub}>연인에게 결혼 가치관 초청장 발송</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, copied && styles.primaryBtnGreen, { marginTop: 10 }]}
                  onPress={handleShare}
                >
                  <Text style={styles.primaryBtnText}>
                    {copied ? '✅ 링크가 복사됐어요!' : '🔗 링크 복사하기'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <TouchableOpacity style={styles.archiveBtn} onPress={handleArchivePress}>
            <Text style={styles.archiveBtnText}>🔒 우리만의 가치관 백서 확인하기</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.ghostBtn} onPress={goHome}>
            <Text style={styles.ghostBtnText}>홈으로 돌아가기</Text>
          </TouchableOpacity>
        </View>
      </ScreenShell>
    );
  }

  // ── UserB: 로딩 / 에러 ────────────────────────────────────────
  if (compareStatus !== 'ready') {
    return (
      <ScreenShell>
        <View style={styles.centerContainer}>
          {compareStatus === 'error' ? (
            <>
              <Text style={styles.emoji}>😢</Text>
              <Text style={styles.errorText}>결과를 불러오지 못했어요.</Text>
              <TouchableOpacity style={[styles.ghostBtn, { marginTop: 24 }]} onPress={goHome}>
                <Text style={styles.ghostBtnText}>홈으로 돌아가기</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color="#1A1A1A" />
              <Text style={[styles.dimText, { marginTop: 14 }]}>결과 분석 중...</Text>
            </>
          )}
        </View>
      </ScreenShell>
    );
  }

  // ── UserB: 비교 결과 UI ───────────────────────────────────────
  const { matching, different } = comparison;

  return (
    <ScreenShell contentStyle={styles.scrollShell}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 스코어 요약 */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreNum}>{matching.length}</Text>
            <Text style={styles.scoreLabel}>💚 일치</Text>
          </View>
          <View style={styles.scoreDivider} />
          <View style={styles.scoreItem}>
            <Text style={styles.scoreNum}>{different.length}</Text>
            <Text style={styles.scoreLabel}>⚡️ 불일치</Text>
          </View>
        </View>

        {/* 💚 일치 섹션 */}
        {matching.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💚 우리가 통했던 가치관</Text>
            {matching.map(({ question, choice }) => (
              <View key={question.id} style={styles.matchCard}>
                <View style={styles.matchBadge}>
                  <Text style={styles.matchBadgeText}>일치</Text>
                </View>
                <Text style={styles.qCriteria}>{question.criteria}</Text>
                <Text style={styles.matchedChoice}>✓ {getChoiceText(question, choice)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ⚡️ 불일치 섹션 */}
        {different.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚡️ 우리가 달랐던 가치관</Text>
            {different.map(({ question, choiceA, choiceB }) => (
              <View key={question.id} style={styles.diffCard}>
                <View style={styles.diffBadge}>
                  <Text style={styles.diffBadgeText}>불일치</Text>
                </View>
                <Text style={styles.qCriteria}>{question.criteria}</Text>

                <View style={styles.choiceRow}>
                  <View style={styles.tagA}><Text style={styles.tagText}>상대방</Text></View>
                  <Text style={styles.choiceText}>{getChoiceText(question, choiceA)}</Text>
                </View>
                <View style={styles.choiceRow}>
                  <View style={styles.tagB}><Text style={styles.tagText}>나</Text></View>
                  <Text style={styles.choiceText}>{getChoiceText(question, choiceB)}</Text>
                </View>

                <TextInput
                  style={styles.compromiseInput}
                  placeholder="우리의 합의안을 적어보세요..."
                  placeholderTextColor="#9CA3AF"
                  value={compromises[question.id] ?? ''}
                  onChangeText={text =>
                    setCompromises(prev => ({ ...prev, [question.id]: text }))
                  }
                  multiline
                />
              </View>
            ))}
          </View>
        )}

        {/* 타협점 저장 버튼 */}
        {different.length > 0 && (
          <TouchableOpacity
            style={[styles.primaryBtn, compromiseSaved && styles.primaryBtnGreen, { marginBottom: 10 }]}
            onPress={handleSaveCompromises}
            disabled={savingCompromise}
          >
            <Text style={styles.primaryBtnText}>
              {compromiseSaved
                ? '✅ 타협점이 저장됐어요!'
                : savingCompromise
                  ? '저장 중...'
                  : '우리만의 타협점 저장'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.archiveBtn} onPress={handleArchivePress}>
          <Text style={styles.archiveBtnText}>🔒 우리만의 가치관 백서 확인하기</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.ghostBtn} onPress={goHome}>
          <Text style={styles.ghostBtnText}>홈으로 돌아가기</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  // ── 공통 ──────────────────────────────────────────────────────
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '900', color: '#1A1A1A', marginBottom: 12 },
  subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  dimText: { fontSize: 13, color: '#9CA3AF' },
  errorText: { fontSize: 13, color: '#EF4444' },
  primaryBtn: { width: '100%', backgroundColor: '#1A1A1A', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  primaryBtnGreen: { backgroundColor: '#059669' },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  primaryBtnSub: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 4 },
  archiveBtn: { width: '100%', backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E5E7EB', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginBottom: 10 },
  archiveBtnText: { color: '#4B5563', fontSize: 14, fontWeight: '700' },
  ghostBtn: { width: '100%', borderWidth: 1.5, borderColor: '#E5E7EB', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  ghostBtnText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },

  // ── UserA: 공유 ──────────────────────────────────────────────
  shareSection: { width: '100%', marginBottom: 16, minHeight: 80, justifyContent: 'center' },
  kakaoBtn: { width: '100%', backgroundColor: '#FEE500', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  kakaoBtnText: { color: '#191600', fontSize: 16, fontWeight: '800' },
  kakaoBtnSub: { color: 'rgba(25,22,0,0.5)', fontSize: 11, marginTop: 4 },

  // ── UserB: 비교 스크롤 레이아웃 ──────────────────────────────
  scrollShell: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },

  // 스코어 카드
  scoreCard: { flexDirection: 'row', backgroundColor: '#F9FAFB', borderRadius: 16, paddingVertical: 20, marginBottom: 24, alignItems: 'center', justifyContent: 'center' },
  scoreItem: { flex: 1, alignItems: 'center' },
  scoreNum: { fontSize: 36, fontWeight: '900', color: '#1A1A1A' },
  scoreLabel: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  scoreDivider: { width: 1, height: 40, backgroundColor: '#E5E7EB' },

  // 섹션
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#1A1A1A', marginBottom: 12 },

  // 일치 카드
  matchCard: { backgroundColor: '#F0FDF4', borderWidth: 1.5, borderColor: '#86EFAC', borderRadius: 16, padding: 16, marginBottom: 10 },
  matchBadge: { alignSelf: 'flex-start', backgroundColor: '#22C55E', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 8 },
  matchBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  qCriteria: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10, lineHeight: 20 },
  matchedChoice: { fontSize: 13, color: '#15803D', fontWeight: '600', lineHeight: 20 },

  // 불일치 카드
  diffCard: { backgroundColor: '#FFFBEB', borderWidth: 1.5, borderColor: '#FDE68A', borderRadius: 16, padding: 16, marginBottom: 10 },
  diffBadge: { alignSelf: 'flex-start', backgroundColor: '#F59E0B', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 8 },
  diffBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  choiceRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  tagA: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, minWidth: 46, alignItems: 'center', marginTop: 1 },
  tagB: { backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, minWidth: 46, alignItems: 'center', marginTop: 1 },
  tagText: { fontSize: 10, fontWeight: '800', color: '#4B5563' },
  choiceText: { flex: 1, fontSize: 12, color: '#374151', lineHeight: 18 },
  compromiseInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 10, fontSize: 13, color: '#1A1A1A', marginTop: 4, minHeight: 60, textAlignVertical: 'top', backgroundColor: '#FFFFFF' },
});
