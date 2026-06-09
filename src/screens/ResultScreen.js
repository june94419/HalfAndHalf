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
const getChoiceText = (q, c) => c === 'A' ? q.questionA : q.questionB;

// ── 일치율에 따른 색상 / 코멘트 ────────────────────────────────────
const rateColor = (r) => r >= 80 ? '#16A34A' : r >= 60 ? '#D97706' : r >= 40 ? '#DC2626' : '#7C3AED';
const rateLabel = (r) => {
  if (r >= 80) return '💚 완벽에 가깝게 잘 맞아요!';
  if (r >= 60) return '💛 조율하면 더 잘 맞을 수 있어요';
  if (r >= 40) return '🧡 갈등 가능성이 높아요, 대화가 필요해요';
  return '❤️ 전문적인 상담이 필요할 수 있어요';
};

// ── 카테고리별 위험도 계산 ───────────────────────────────────────────
const riskLevel = (unmatched, total) => {
  if (total === 0) return { label: '낮음', color: '#16A34A', pct: 15 };
  const r = unmatched / total;
  if (r >= 0.6) return { label: '높음 ⚠️', color: '#DC2626', pct: 85 };
  if (r >= 0.3) return { label: '보통', color: '#D97706', pct: 50 };
  return { label: '낮음', color: '#16A34A', pct: 20 };
};

// ────────────────────────────────────────────────────────────────────
// CoupleResultScreen — 커플 코드 기반 수익성 검증 화면
// ────────────────────────────────────────────────────────────────────
function CoupleResultScreen({ coupleCode, navigation }) {
  const [status, setStatus]       = useState('loading');
  const [matchCount, setMatch]    = useState(0);
  const [unmatched, setUnmatched] = useState([]);
  const [catCount, setCatCount]   = useState({ '돈': [0, 0], '시댁': [0, 0], '라이프': [0, 0] });
  const [reportOpen, setReport]   = useState(false);
  const TOTAL = 20;

  useEffect(() => {
    (async () => {
      try {
        const snap = await get(ref(db, `couples/${coupleCode}`));
        if (!snap.exists()) { setStatus('error'); return; }
        const { creatorAnswers, partnerAnswers } = snap.val();
        if (!creatorAnswers || !partnerAnswers) { setStatus('error'); return; }

        let matched = 0;
        const unmatchedList = [];
        const cc = { '돈': [0, 0], '시댁': [0, 0], '라이프': [0, 0] }; // [total, unmatched]

        Object.keys(creatorAnswers).forEach(idStr => {
          const q = BALANCE_QUESTIONS.find(q => q.id === Number(idStr));
          if (!q) return;
          const type = q.type;
          if (cc[type]) cc[type][0]++;
          if (creatorAnswers[idStr] === partnerAnswers[idStr]) {
            matched++;
          } else {
            if (cc[type]) cc[type][1]++;
            unmatchedList.push({
              q,
              creatorChoice: creatorAnswers[idStr],
              partnerChoice: partnerAnswers[idStr] ?? '?',
            });
          }
        });

        setMatch(matched);
        setUnmatched(unmatchedList);
        setCatCount(cc);
        setStatus('ready');
      } catch (e) {
        console.error('[CoupleResult]', e);
        setStatus('error');
      }
    })();
  }, [coupleCode]);

  const rate     = Math.round((matchCount / TOTAL) * 100);
  const spicy    = unmatched.slice(0, 2);
  const color    = rateColor(rate);

  // ── 결제 버튼 클릭 핸들러 ─────────────────────────────────────
  const handlePayment = () => {
    // 전환율 데이터 수집 (fire-and-forget)
    push(ref(db, 'analytics_events'), {
      event:      'click_fake_payment',
      coupleCode,
      matchRate:  rate,
      timestamp:  new Date().toISOString(),
      platform:   Platform.OS,
    }).catch(() => {});

    const title = '🎉 축하합니다!';
    const msg   = '현재 \'반반\' 출시 기념 오픈 베타 이벤트 기간으로,\n본 프리미엄 리포트는 100% 무료로 즉시 발급됩니다!\n\n정식 출시 전까지 마음껏 이용해 보세요. 🙂';
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${msg}`);
      setReport(true);
    } else {
      Alert.alert(title, msg, [{ text: '리포트 열기 🎁', onPress: () => setReport(true) }]);
    }
  };

  // ── 로딩 / 에러 ──────────────────────────────────────────────
  if (status === 'loading') return (
    <ScreenShell>
      <View style={cs.center}>
        <ActivityIndicator size="large" color="#1A1A1A" />
        <Text style={cs.dimText}>결과 분석 중...</Text>
      </View>
    </ScreenShell>
  );

  if (status === 'error') return (
    <ScreenShell>
      <View style={cs.center}>
        <Text style={cs.emoji}>😢</Text>
        <Text style={cs.errorText}>결과를 불러오지 못했어요.</Text>
        <TouchableOpacity style={[cs.ghostBtn, { marginTop: 24 }]} onPress={() => navigation.replace('Lobby')}>
          <Text style={cs.ghostBtnText}>홈으로 돌아가기</Text>
        </TouchableOpacity>
      </View>
    </ScreenShell>
  );

  return (
    <ScreenShell contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView
        contentContainerStyle={cs.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── 1. 일치율 카드 ──────────────────────────────────── */}
        <View style={cs.matchCard}>
          <Text style={cs.matchLabel}>우리 커플의 가치관 일치율</Text>
          <Text style={[cs.matchRate, { color }]}>{rate}%</Text>
          <Text style={cs.matchSub}>{rateLabel(rate)}</Text>

          {/* 게이지 바 */}
          <View style={cs.gaugeTrack}>
            <View style={[cs.gaugeFill, { width: `${rate}%`, backgroundColor: color }]} />
          </View>
          <Text style={cs.matchCount}>
            20문항 중 <Text style={{ color, fontWeight: '900' }}>{matchCount}문항 일치</Text>
            {' '}/ {TOTAL - matchCount}문항 불일치
          </Text>
        </View>

        {/* ── 2. 불일치 맛보기 (매운맛 질문 최대 2개) ───────────── */}
        {spicy.length > 0 && (
          <View style={cs.section}>
            <Text style={cs.sectionTitle}>🌶️ 두 분의 의견이 갈린 질문</Text>
            {spicy.map(({ q, creatorChoice, partnerChoice }) => (
              <View key={q.id} style={cs.spicyCard}>
                <Text style={cs.spicyTag}>{q.tag}</Text>
                <Text style={cs.spicyCriteria}>{q.criteria}</Text>
                <View style={cs.choiceRow}>
                  <View style={cs.tagA}><Text style={cs.tagTxt}>나</Text></View>
                  <Text style={cs.choiceTxt}>{getChoiceText(q, creatorChoice)}</Text>
                </View>
                <View style={cs.choiceRow}>
                  <View style={cs.tagB}><Text style={cs.tagTxt}>상대방</Text></View>
                  <Text style={cs.choiceTxt}>{getChoiceText(q, partnerChoice)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── 3. 잠금 배너 (Fake Door) ──────────────────────── */}
        <View style={cs.lockBanner}>
          <View style={cs.lockHeader}>
            <Text style={cs.lockIcon}>🔒</Text>
            <View style={cs.dangerBadge}><Text style={cs.dangerBadgeTxt}>위험 스팟 3개 발견</Text></View>
          </View>
          <Text style={cs.lockTitle}>
            두 분의 20개 가치관 데이터 정밀 진단 결과,{'\n'}
            결혼 후 파혼으로 이어질 수 있는{'\n'}
            <Text style={{ color: '#FCA5A5' }}>심각한 위험 스팟이 3개 발견</Text>되었습니다.
          </Text>
          <Text style={cs.lockBody}>
            AI 부부상담 전문가가 집필한{' '}
            <Text style={cs.lockHighlight}>[우리 커플 맞춤형 결혼 종합 처방전 & 갈등 방지 리포트]</Text>를 열어보세요.
          </Text>

          <View style={cs.includeBox}>
            {[
              '📊 카테고리별 갈등 위험도 그래프',
              '👫 선배 부부들의 현실 조언',
              '💬 밤에 안 싸우고 대화하는 맞춤형 소통 가이드라인',
            ].map(item => (
              <Text key={item} style={cs.includeItem}>✓  {item}</Text>
            ))}
          </View>

          <TouchableOpacity style={cs.payBtn} onPress={handlePayment} activeOpacity={0.88}>
            <Text style={cs.payBtnText}>3,900원에 리포트 즉시 열기</Text>
            <Text style={cs.payBtnSub}>지금 바로 커플 맞춤 처방전 확인</Text>
          </TouchableOpacity>
        </View>

        {/* ── 4. 더미 리포트 (결제 후 공개) ────────────────────── */}
        {reportOpen && <DummyReport catCount={catCount} unmatched={unmatched} rate={rate} />}

        <TouchableOpacity style={cs.ghostBtn} onPress={() => navigation.replace('Lobby')}>
          <Text style={cs.ghostBtnText}>홈으로 돌아가기</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenShell>
  );
}

// ────────────────────────────────────────────────────────────────────
// DummyReport — 잠금 해제 후 표시되는 더미 진단 리포트
// ────────────────────────────────────────────────────────────────────
function DummyReport({ catCount, unmatched, rate }) {
  const cats = [
    { key: '돈',    label: '💰 돈 & 재테크' },
    { key: '시댁',  label: '🏠 시댁 & 처가' },
    { key: '라이프', label: '🌿 라이프스타일' },
  ];

  const adviceList = [
    { emoji: '👩‍❤️‍👨', title: '월 1회 "가계 미팅" 고정', body: '매달 첫째 주 일요일 30분, 지출 내역과 저축 목표를 함께 검토하세요. 돈 얘기가 싸움이 아니라 협업이 됩니다.' },
    { emoji: '🏡', title: '명절 2주 전 일정 합의', body: '명절 전날 싸우는 커플의 87%는 사전 합의가 없었어요. 2주 전 캘린더를 펼치는 것만으로도 갈등을 절반 줄일 수 있어요.' },
    { emoji: '⏰', title: '취침 전 30분은 "스크린 프리"', body: '잠들기 전 감정적 대화는 수면 중 뇌가 부정적으로 처리합니다. 핸드폰 없이 대화하거나 같이 책을 읽어보세요.' },
  ];

  const guideList = [
    '"나는 ~할 때 서운해" 형식으로만 감정 말하기',
    '싸울 때 "항상", "절대"라는 단어 금지',
    '불만 말하기 전 칭찬 1가지 먼저',
    '중요한 결정은 48시간 숙려 후 대화',
    '일주일에 한 번, 15분 "우리 이야기" 시간 고정',
  ];

  return (
    <View style={rp.container}>
      <View style={rp.headerBand}>
        <Text style={rp.headerTitle}>💍 우리 커플 가치관 종합 리포트</Text>
        <Text style={rp.headerSub}>AI 부부상담 전문가 분석 결과</Text>
      </View>

      {/* AI 종합 진단 요약 */}
      <View style={rp.card}>
        <Text style={rp.cardTitle}>🤖 AI 종합 진단 요약</Text>
        <Text style={rp.cardBody}>
          {rate >= 70
            ? `두 분의 가치관 일치율은 ${rate}%로 상위 30%에 해당합니다. 일치하는 부분을 강점으로 삼고, 불일치 ${20 - Math.round(rate * 20 / 100)}개 항목을 집중 대화하면 매우 안정적인 결혼 생활이 기대됩니다.`
            : `두 분의 가치관 일치율은 ${rate}%입니다. 불일치 항목이 ${20 - Math.round(rate * 20 / 100)}개로 다소 높습니다. 아래 가이드라인을 따라 체계적으로 조율하면 갈등을 크게 줄일 수 있습니다.`}
        </Text>
      </View>

      {/* 카테고리별 위험도 게이지 */}
      <View style={rp.card}>
        <Text style={rp.cardTitle}>📊 카테고리별 갈등 위험도</Text>
        {cats.map(({ key, label }) => {
          const [total, uc] = catCount[key] ?? [0, 0];
          const risk = riskLevel(uc, total);
          return (
            <View key={key} style={rp.gaugeRow}>
              <Text style={rp.gaugeLabel}>{label}</Text>
              <View style={rp.gaugeTrack}>
                <View style={[rp.gaugeFill, { width: `${risk.pct}%`, backgroundColor: risk.color }]} />
              </View>
              <Text style={[rp.gaugeLevelTxt, { color: risk.color }]}>{risk.label}</Text>
            </View>
          );
        })}
      </View>

      {/* 선배 부부 조언 */}
      <View style={rp.card}>
        <Text style={rp.cardTitle}>👫 선배 부부들의 현실 조언</Text>
        {adviceList.map(({ emoji, title, body }) => (
          <View key={title} style={rp.adviceItem}>
            <Text style={rp.adviceEmoji}>{emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={rp.adviceTitle}>{title}</Text>
              <Text style={rp.adviceBody}>{body}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* 소통 가이드라인 */}
      <View style={rp.card}>
        <Text style={rp.cardTitle}>💬 밤에 안 싸우는 소통 가이드라인</Text>
        {guideList.map((g, i) => (
          <View key={i} style={rp.guideRow}>
            <View style={rp.guideBullet}><Text style={rp.guideBulletTxt}>{i + 1}</Text></View>
            <Text style={rp.guideBody}>{g}</Text>
          </View>
        ))}
      </View>

      <View style={rp.footer}>
        <Text style={rp.footerTxt}>반반 AI 리포트 · 정식 출시 전 무료 제공 중</Text>
      </View>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────
// ResultScreen — 진입점: coupleCode / roomId / category 분기
// ────────────────────────────────────────────────────────────────────
export default function ResultScreen({ route, navigation }) {
  const { coupleCode, category: passedCategory, history, roomId } = route.params;

  // 커플 코드 기반 신규 플로우
  if (coupleCode) {
    return <CoupleResultScreen coupleCode={coupleCode} navigation={navigation} />;
  }

  // ── 이하 기존 rooms/ 플로우 (UserA / UserB) ──────────────────────
  const isUserB = !!roomId;

  const [createdRoomId, setCreatedRoomId] = useState(null);
  const [roomStatus, setRoomStatus]       = useState('creating');
  const [copied, setCopied]               = useState(false);
  const [kakaoSharing, setKakaoSharing]   = useState(false);
  const [kakaoShared, setKakaoShared]     = useState(false);
  const [compareStatus, setCompareStatus] = useState('saving');
  const [comparison, setComparison]       = useState(null);
  const [compromises, setCompromises]     = useState({});
  const [savingCompromise, setSavingComp] = useState(false);
  const [compromiseSaved, setCompSaved]   = useState(false);

  useEffect(() => { isUserB ? setupUserB() : createRoom(); }, []);

  const goHome = () => {
    if (typeof window !== 'undefined' && window.history) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    navigation.navigate('Lobby');
  };

  const handleArchivePress = () => {
    const title   = '우리만의 가치관 백서';
    const message = '두 분이 치열하게 토론하고 합의한 소중한 가치관 데이터는 마이페이지에 보관됩니다.\n마이페이지 기능은 정식 출시 후 로그인 시 제공됩니다! 💕';
    Platform.OS === 'web' ? window.alert(`${title}\n\n${message}`) : Alert.alert(title, message);
  };

  const createRoom = async () => {
    try {
      const { user } = await signInAnonymously(auth);
      const answersA = history.reduce((acc, { questionId, choice }) => { acc[questionId] = choice; return acc; }, {});
      const roomRef  = push(ref(db, 'rooms'));
      await set(roomRef, { createdAt: serverTimestamp(), category: passedCategory, userA: user.uid, answersA });
      setCreatedRoomId(roomRef.key);
      setRoomStatus('done');
    } catch (e) {
      console.error('Room creation failed:', e);
      setRoomStatus('error');
    }
  };

  const handleShare = async () => {
    const base     = typeof window !== 'undefined' ? window.location.origin : 'https://half-and-half-nine.vercel.app';
    const shareUrl = `${base}?room=${createdRoomId}`;
    await Clipboard.setStringAsync(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const Kakao = window.Kakao;
      if (Kakao) {
        if (!Kakao.isInitialized()) Kakao.init('5794780a6ba882582fb21d5794ae3007');
        Kakao.Share.sendDefault({
          objectType: 'feed',
          content: {
            title: '🤔 우리 연애 가치관은 몇 %나 맞을까?',
            description: '연인이 푸드·데이트·재무 취향 20문제를 풀고 기다리고 있어요. 지금 들어와서 조율해 보세요! 💕',
            imageUrl: 'https://half-and-half-nine.vercel.app/favicon.ico',
            link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
          },
          buttons: [{ title: '가치관 조율하러 가기', link: { mobileWebUrl: shareUrl, webUrl: shareUrl } }],
        });
      }
    }
  };

  const handleKakaoShare = async () => {
    if (kakaoSharing) return;
    setKakaoSharing(true);
    try {
      // ── 1. 커플 코드 생성 & DB 저장 ──────────────────────────
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let coupleCode = 'ROOM_';
      for (let i = 0; i < 6; i++) coupleCode += chars[Math.floor(Math.random() * 26)];
      const { user } = await signInAnonymously(auth);
      const creatorAnswers = history.reduce((acc, { questionId, choice }) => { acc[questionId] = choice; return acc; }, {});
      await set(ref(db, `couples/${coupleCode}`), {
        creatorId: user.uid, creatorAnswers,
        status: 'progress', createdAt: new Date().toISOString(), fakePaid: false,
      });

      // ── 2. 카카오 SDK 동적 로드 & 공유 (웹 전용) ─────────────
      if (Platform.OS === 'web' && typeof window !== 'undefined') {

        // window.Kakao가 없으면 <script>를 동적으로 주입하고 onload 대기
        if (!window.Kakao) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
            script.crossOrigin = 'anonymous';
            script.onload  = resolve;
            script.onerror = () => reject(new Error('Kakao SDK 스크립트 로드에 실패했습니다.'));
            document.head.appendChild(script);
          });
        }

        // 초기화 여부 확인 후 1회만 init
        const Kakao = window.Kakao;
        if (!Kakao.isInitialized()) {
          Kakao.init('5794780a6ba882582fb21d5794ae3007');
        }

        // sendDefault는 Promise를 반환하지 않으므로 내부 try-catch로 격리
        const inviteUrl = `${window.location.origin}/invite?code=${coupleCode}`;
        try {
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
        } catch (sdkErr) {
          console.warn('[Kakao] sendDefault internal:', sdkErr);
        }
      }

      setKakaoShared(true);
      setTimeout(() => setKakaoShared(false), 3000);
    } catch (e) {
      // 디버깅용: 정확한 에러 원인 노출
      console.error('[handleKakaoShare]', e);
      window.alert(e.message ?? '알 수 없는 오류가 발생했습니다.');
    } finally {
      setKakaoSharing(false);
    }
  };

  const setupUserB = async () => {
    try {
      const { user } = await signInAnonymously(auth);
      const answersB = history.reduce((acc, { questionId, choice }) => { acc[questionId] = choice; return acc; }, {});
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
    const matching = [], different = [];
    Object.keys(answersA).forEach(idStr => {
      const question = BALANCE_QUESTIONS.find(q => q.id === Number(idStr));
      if (!question) return;
      const choiceA = answersA[idStr];
      const choiceB = answersB?.[idStr];
      (choiceA === choiceB ? matching : different).push(
        choiceA === choiceB
          ? { question, choice: choiceA }
          : { question, choiceA, choiceB: choiceB ?? '?' }
      );
    });
    setComparison({ category, matching, different });
    if (saved) setCompromises(saved);
  };

  const handleSaveCompromises = async () => {
    if (savingCompromise) return;
    const entries = Object.entries(compromises).filter(([, v]) => v?.trim());
    if (!entries.length) return;
    setSavingComp(true);
    try {
      const updates = {};
      entries.forEach(([qId, text]) => { updates[`rooms/${roomId}/compromises/${qId}`] = text.trim(); });
      await update(ref(db), updates);
      setCompSaved(true);
      setTimeout(() => setCompSaved(false), 3000);
    } catch (e) { console.error('Save compromises failed:', e); }
    finally { setSavingComp(false); }
  };

  // ── UserA 렌더 ──────────────────────────────────────────────────
  if (!isUserB) return (
    <ScreenShell>
      <View style={styles.centerContainer}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>모든 질문 완료!</Text>
        <Text style={styles.subtitle}>{CATEGORY_LABEL[passedCategory] || passedCategory} 카테고리의{'\n'}모든 밸런스 게임을 마쳤어요.</Text>
        <View style={styles.shareSection}>
          {roomStatus === 'creating' && <Text style={styles.dimText}>공유 링크 생성 중...</Text>}
          {roomStatus === 'error'    && <Text style={styles.errorText}>링크 생성에 실패했습니다.</Text>}
          {roomStatus === 'done' && createdRoomId && (
            <>
              <TouchableOpacity style={[styles.kakaoBtn, kakaoShared && styles.primaryBtnGreen]} onPress={handleKakaoShare} disabled={kakaoSharing}>
                <Text style={styles.kakaoBtnText}>{kakaoShared ? '✅ 초청장을 보냈어요!' : kakaoSharing ? '전송 중...' : '💬 카톡으로 공유하기'}</Text>
                {!kakaoShared && !kakaoSharing && <Text style={styles.kakaoBtnSub}>연인에게 결혼 가치관 초청장 발송</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, copied && styles.primaryBtnGreen, { marginTop: 10 }]} onPress={handleShare}>
                <Text style={styles.primaryBtnText}>{copied ? '✅ 링크가 복사됐어요!' : '🔗 링크 복사하기'}</Text>
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

  // ── UserB 로딩/에러 ─────────────────────────────────────────────
  if (compareStatus !== 'ready') return (
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

  // ── UserB 비교 결과 ─────────────────────────────────────────────
  const { matching, different } = comparison;
  return (
    <ScreenShell contentStyle={styles.scrollShell}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.scoreCard}>
          <View style={styles.scoreItem}><Text style={styles.scoreNum}>{matching.length}</Text><Text style={styles.scoreLabel}>💚 일치</Text></View>
          <View style={styles.scoreDivider} />
          <View style={styles.scoreItem}><Text style={styles.scoreNum}>{different.length}</Text><Text style={styles.scoreLabel}>⚡️ 불일치</Text></View>
        </View>
        {matching.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💚 우리가 통했던 가치관</Text>
            {matching.map(({ question, choice }) => (
              <View key={question.id} style={styles.matchCard}>
                <View style={styles.matchBadge}><Text style={styles.matchBadgeText}>일치</Text></View>
                <Text style={styles.qCriteria}>{question.criteria}</Text>
                <Text style={styles.matchedChoice}>✓ {getChoiceText(question, choice)}</Text>
              </View>
            ))}
          </View>
        )}
        {different.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚡️ 우리가 달랐던 가치관</Text>
            {different.map(({ question, choiceA, choiceB }) => (
              <View key={question.id} style={styles.diffCard}>
                <View style={styles.diffBadge}><Text style={styles.diffBadgeText}>불일치</Text></View>
                <Text style={styles.qCriteria}>{question.criteria}</Text>
                <View style={styles.choiceRow}><View style={styles.tagA}><Text style={styles.tagText}>상대방</Text></View><Text style={styles.choiceText}>{getChoiceText(question, choiceA)}</Text></View>
                <View style={styles.choiceRow}><View style={styles.tagB}><Text style={styles.tagText}>나</Text></View><Text style={styles.choiceText}>{getChoiceText(question, choiceB)}</Text></View>
                <TextInput style={styles.compromiseInput} placeholder="우리의 합의안을 적어보세요..." placeholderTextColor="#9CA3AF" value={compromises[question.id] ?? ''} onChangeText={text => setCompromises(prev => ({ ...prev, [question.id]: text }))} multiline />
              </View>
            ))}
          </View>
        )}
        {different.length > 0 && (
          <TouchableOpacity style={[styles.primaryBtn, compromiseSaved && styles.primaryBtnGreen, { marginBottom: 10 }]} onPress={handleSaveCompromises} disabled={savingCompromise}>
            <Text style={styles.primaryBtnText}>{compromiseSaved ? '✅ 타협점이 저장됐어요!' : savingCompromise ? '저장 중...' : '우리만의 타협점 저장'}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.archiveBtn} onPress={handleArchivePress}><Text style={styles.archiveBtnText}>🔒 우리만의 가치관 백서 확인하기</Text></TouchableOpacity>
        <TouchableOpacity style={styles.ghostBtn} onPress={goHome}><Text style={styles.ghostBtnText}>홈으로 돌아가기</Text></TouchableOpacity>
      </ScrollView>
    </ScreenShell>
  );
}

// ── CoupleResultScreen 스타일 ────────────────────────────────────────
const cs = StyleSheet.create({
  scroll:      { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, gap: 16 },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emoji:       { fontSize: 52, marginBottom: 12 },
  dimText:     { fontSize: 13, color: '#9CA3AF', marginTop: 10 },
  errorText:   { fontSize: 13, color: '#EF4444' },

  // 일치율 카드
  matchCard:   { backgroundColor: '#F9FAFB', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  matchLabel:  { fontSize: 13, color: '#6B7280', fontWeight: '700', marginBottom: 8, letterSpacing: 0.5 },
  matchRate:   { fontSize: 64, fontWeight: '900', lineHeight: 72 },
  matchSub:    { fontSize: 14, color: '#374151', fontWeight: '700', marginTop: 4, marginBottom: 16, textAlign: 'center' },
  gaugeTrack:  { width: '100%', height: 10, backgroundColor: '#E5E7EB', borderRadius: 5, overflow: 'hidden', marginBottom: 10 },
  gaugeFill:   { height: '100%', borderRadius: 5 },
  matchCount:  { fontSize: 13, color: '#6B7280' },

  // 불일치 맛보기
  section:     { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#1A1A1A', marginBottom: 4 },
  spicyCard:   { backgroundColor: '#FFFBEB', borderWidth: 1.5, borderColor: '#FDE68A', borderRadius: 16, padding: 16, gap: 8 },
  spicyTag:    { fontSize: 11, color: '#92400E', fontWeight: '700' },
  spicyCriteria: { fontSize: 13, fontWeight: '700', color: '#374151', lineHeight: 20 },
  choiceRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tagA:        { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, minWidth: 44, alignItems: 'center' },
  tagB:        { backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, minWidth: 44, alignItems: 'center' },
  tagTxt:      { fontSize: 10, fontWeight: '800', color: '#4B5563' },
  choiceTxt:   { flex: 1, fontSize: 12, color: '#374151', lineHeight: 18 },

  // 잠금 배너
  lockBanner:  { backgroundColor: '#141414', borderRadius: 20, padding: 24, gap: 14, borderWidth: 1.5, borderColor: '#FFD60A' },
  lockHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lockIcon:    { fontSize: 28 },
  dangerBadge: { backgroundColor: '#DC2626', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  dangerBadgeTxt: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  lockTitle:   { fontSize: 16, fontWeight: '800', color: '#FFFFFF', lineHeight: 26 },
  lockBody:    { fontSize: 13, color: '#9CA3AF', lineHeight: 20 },
  lockHighlight: { color: '#FCD34D', fontWeight: '700' },
  includeBox:  { backgroundColor: '#1F1F1F', borderRadius: 12, padding: 14, gap: 8 },
  includeItem: { fontSize: 13, color: '#D1D5DB', lineHeight: 20 },
  payBtn:      { backgroundColor: '#FFD60A', borderRadius: 16, paddingVertical: 18, alignItems: 'center', gap: 4 },
  payBtnText:  { fontSize: 17, fontWeight: '900', color: '#141414' },
  payBtnSub:   { fontSize: 11, color: 'rgba(0,0,0,0.5)', fontWeight: '600' },

  ghostBtn:    { borderWidth: 1.5, borderColor: '#E5E7EB', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  ghostBtnText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
});

// ── DummyReport 스타일 ───────────────────────────────────────────────
const rp = StyleSheet.create({
  container:    { gap: 14 },
  headerBand:   { backgroundColor: '#1A1A1A', borderRadius: 16, padding: 20, alignItems: 'center', gap: 4 },
  headerTitle:  { fontSize: 16, fontWeight: '900', color: '#FFD60A' },
  headerSub:    { fontSize: 12, color: '#888' },
  card:         { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 18, gap: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardTitle:    { fontSize: 14, fontWeight: '900', color: '#1A1A1A' },
  cardBody:     { fontSize: 13, color: '#374151', lineHeight: 22 },
  gaugeRow:     { gap: 6 },
  gaugeLabel:   { fontSize: 13, fontWeight: '700', color: '#374151' },
  gaugeTrack:   { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  gaugeFill:    { height: '100%', borderRadius: 4 },
  gaugeLevelTxt: { fontSize: 11, fontWeight: '800', textAlign: 'right' },
  adviceItem:   { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  adviceEmoji:  { fontSize: 24, marginTop: 2 },
  adviceTitle:  { fontSize: 13, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
  adviceBody:   { fontSize: 12, color: '#6B7280', lineHeight: 18 },
  guideRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  guideBullet:  { width: 22, height: 22, borderRadius: 11, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  guideBulletTxt: { fontSize: 11, fontWeight: '900', color: '#FFF' },
  guideBody:    { flex: 1, fontSize: 13, color: '#374151', lineHeight: 20 },
  footer:       { alignItems: 'center', paddingVertical: 8 },
  footerTxt:    { fontSize: 11, color: '#9CA3AF' },
});

// ── 기존 rooms/ 플로우 스타일 (하위 호환) ────────────────────────────
const styles = StyleSheet.create({
  centerContainer:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emoji:            { fontSize: 64, marginBottom: 16 },
  title:            { fontSize: 26, fontWeight: '900', color: '#1A1A1A', marginBottom: 12 },
  subtitle:         { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  dimText:          { fontSize: 13, color: '#9CA3AF' },
  errorText:        { fontSize: 13, color: '#EF4444' },
  primaryBtn:       { width: '100%', backgroundColor: '#1A1A1A', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  primaryBtnGreen:  { backgroundColor: '#059669' },
  primaryBtnText:   { color: '#FFF', fontSize: 16, fontWeight: '800' },
  primaryBtnSub:    { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 4 },
  archiveBtn:       { width: '100%', backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E5E7EB', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginBottom: 10 },
  archiveBtnText:   { color: '#4B5563', fontSize: 14, fontWeight: '700' },
  ghostBtn:         { width: '100%', borderWidth: 1.5, borderColor: '#E5E7EB', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  ghostBtnText:     { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
  kakaoBtn:         { width: '100%', backgroundColor: '#FEE500', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  kakaoBtnText:     { color: '#191600', fontSize: 16, fontWeight: '800' },
  kakaoBtnSub:      { color: 'rgba(25,22,0,0.5)', fontSize: 11, marginTop: 4 },
  shareSection:     { width: '100%', marginBottom: 16, minHeight: 80, justifyContent: 'center' },
  scrollShell:      { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  scrollContent:    { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  scoreCard:        { flexDirection: 'row', backgroundColor: '#F9FAFB', borderRadius: 16, paddingVertical: 20, marginBottom: 24, alignItems: 'center', justifyContent: 'center' },
  scoreItem:        { flex: 1, alignItems: 'center' },
  scoreNum:         { fontSize: 36, fontWeight: '900', color: '#1A1A1A' },
  scoreLabel:       { fontSize: 13, color: '#6B7280', marginTop: 4 },
  scoreDivider:     { width: 1, height: 40, backgroundColor: '#E5E7EB' },
  section:          { marginBottom: 24 },
  sectionTitle:     { fontSize: 15, fontWeight: '900', color: '#1A1A1A', marginBottom: 12 },
  matchCard:        { backgroundColor: '#F0FDF4', borderWidth: 1.5, borderColor: '#86EFAC', borderRadius: 16, padding: 16, marginBottom: 10 },
  matchBadge:       { alignSelf: 'flex-start', backgroundColor: '#22C55E', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 8 },
  matchBadgeText:   { color: '#FFF', fontSize: 10, fontWeight: '800' },
  qCriteria:        { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10, lineHeight: 20 },
  matchedChoice:    { fontSize: 13, color: '#15803D', fontWeight: '600', lineHeight: 20 },
  diffCard:         { backgroundColor: '#FFFBEB', borderWidth: 1.5, borderColor: '#FDE68A', borderRadius: 16, padding: 16, marginBottom: 10 },
  diffBadge:        { alignSelf: 'flex-start', backgroundColor: '#F59E0B', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 8 },
  diffBadgeText:    { color: '#FFF', fontSize: 10, fontWeight: '800' },
  choiceRow:        { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  tagA:             { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, minWidth: 46, alignItems: 'center', marginTop: 1 },
  tagB:             { backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, minWidth: 46, alignItems: 'center', marginTop: 1 },
  tagText:          { fontSize: 10, fontWeight: '800', color: '#4B5563' },
  choiceText:       { flex: 1, fontSize: 12, color: '#374151', lineHeight: 18 },
  compromiseInput:  { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 10, fontSize: 13, color: '#1A1A1A', marginTop: 4, minHeight: 60, textAlignVertical: 'top', backgroundColor: '#FFFFFF' },
});
