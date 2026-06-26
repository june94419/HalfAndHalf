import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  ScrollView, StyleSheet, ActivityIndicator,
  Alert, Platform,
} from 'react-native';
import { signInAnonymously } from 'firebase/auth';
import { ref, push, set, get, update, onValue, serverTimestamp } from 'firebase/database';
import * as Clipboard from 'expo-clipboard';
import { auth, db } from '../../firebase';
import { getCachedQuestionsSync } from '../utils/questionsDB';
import ScreenShell from '../components/ScreenShell';
import { trackEvent } from '../utils/analytics';
import { getTossShareLink, share } from '@apps-in-toss/web-framework';

const CATEGORY_LABEL = { '돈': '돈 & 재테크', '시댁': '서로의 가족', '라이프': '라이프스타일' };
const getChoiceText = (q, c) => c === 'A' ? q.questionA : c === 'B' ? q.questionB : '보류';

const rateColor = (r) => r >= 80 ? '#16A34A' : r >= 60 ? '#D97706' : r >= 40 ? '#DC2626' : '#7C3AED';

const coupleTitle = (r) => {
  if (r >= 85) return {
    emoji: '👑', title: '환상의 티키타카 부부',
    desc: '소울메이트급 궁합! 두 분은 이미 결혼각이 나와있어요.',
    bg: '#F0FDF4', border: '#86EFAC', textColor: '#15803D',
  };
  if (r >= 70) return {
    emoji: '🍭', title: '찰떡궁합 단짠 커플',
    desc: '대부분의 가치관이 착착 맞아요. 조금만 조율하면 완벽해요!',
    bg: '#FFFBEB', border: '#FDE68A', textColor: '#B45309',
  };
  if (r >= 50) return {
    emoji: '💫', title: '밀당 마스터 로맨스 커플',
    desc: '반반이라서 오히려 설레는 커플. 차이가 매력이 될 수 있어요!',
    bg: '#EFF6FF', border: '#BFDBFE', textColor: '#1D4ED8',
  };
  return {
    emoji: '🛸', title: '매일이 스릴러인 화성금성 커플',
    desc: '가치관 차이가 꽤 큰 편이에요. 솔직한 대화가 정말 중요해요.',
    bg: '#FDF4FF', border: '#E9D5FF', textColor: '#7E22CE',
  };
};

const catMatchRate = (catCount) => [
  { key: '돈',   emoji: '💰', label: '돈 & 재테크' },
  { key: '시댁', emoji: '🏠', label: '서로의 가족' },
  { key: '라이프', emoji: '🌿', label: '라이프스타일' },
].map(({ key, emoji, label }) => {
  const [total, unmatched] = catCount[key] ?? [0, 0];
  const matched = total - unmatched;
  const pct = total > 0 ? Math.round((matched / total) * 100) : 0;
  const color = pct >= 70 ? '#16A34A' : pct >= 40 ? '#D97706' : '#DC2626';
  return { key, emoji, label, pct, color, matched, total };
});

const riskLevel = (unmatched, total) => {
  if (total === 0) return { label: '낮음', color: '#16A34A', pct: 15 };
  const r = unmatched / total;
  if (r >= 0.6) return { label: '높음 ⚠️', color: '#DC2626', pct: 85 };
  if (r >= 0.3) return { label: '보통', color: '#D97706', pct: 50 };
  return { label: '낮음', color: '#16A34A', pct: 20 };
};

// ── Stage 1: A 게임 완료 → 연인 초대 대기 화면 ─────────────────────────
// coupleCode는 GameScreen에서 이미 생성됨. 공유 버튼만 누르면 됨.
// onValue 리스너: B 완료 시 자동으로 CoupleResultScreen으로 전환.
function CreatorInviteScreen({ coupleCode, category, navigation }) {
  useEffect(() => {
    const unsubscribe = onValue(ref(db, `couples/${coupleCode}`), (snap) => {
      if (!snap.exists()) return;
      if (snap.val()?.status === 'completed') {
        unsubscribe();
        // B 완료 → A도 동일한 "결과 확인하기" 화면으로 이동
        navigation.replace('Result', { coupleCode, isPartner: true });
      }
    });
    return () => unsubscribe();
  }, [coupleCode]);

  const handleShare = async () => {
    // 항상 banban.io.kr 도메인 사용 — Toss WebView의 내부 origin에 의존하지 않음
    const webInviteUrl = `https://banban.io.kr/?code=${coupleCode}`;

    let shareLink = webInviteUrl;
    try {
      const result = await Promise.race([
        getTossShareLink(`intoss://halfandhalf?code=${coupleCode}`),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 1500)),
      ]);
      if (result) shareLink = result;
    } catch {}

    try {
      // 1차 시도: 토스 SDK share (인앱 환경)
      await share({
        message: `[반반] 연인도 같이 밸런스 게임 해보기 💕 아래 링크를 눌러 토스 앱에서 바로 시작해봐!\n\n참여하기: ${shareLink}`,
      });
      trackEvent('invite_share_clicked', { couple_code: coupleCode });
    } catch {
      // 2차 폴백: 토스 SDK 미제공 환경(로컬/일반 브라우저) → 클립보드 복사 + alert
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(webInviteUrl);
        } else {
          await Clipboard.setStringAsync(webInviteUrl);
        }
      } catch {}
      alert('초대 링크가 복사되었습니다! 연인에게 공유해보세요.');
      trackEvent('invite_share_fallback', { couple_code: coupleCode });
    }
  };

  return (
    <ScreenShell>
      <View style={styles.centerContainer}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>모든 질문 완료!</Text>
        <Text style={styles.subtitle}>
          {CATEGORY_LABEL[category] || category} 카테고리의{'\n'}모든 밸런스 게임을 마쳤어요.
        </Text>
        <TouchableOpacity style={styles.notifyShareBtn} onPress={handleShare} activeOpacity={0.88}>
          <Text style={styles.notifyShareBtnText}>💬 연인도 같이 밸런스 게임 해보기</Text>
          <Text style={styles.notifyShareBtnSub}>카카오톡·문자 등으로 바로 공유돼요</Text>
        </TouchableOpacity>
        <View style={styles.waitingBadge}>
          <ActivityIndicator size="small" color="#6B7280" />
          <Text style={styles.waitingText}>연인이 답변을 완료하면 자동으로 결과가 열려요</Text>
        </View>
        <TouchableOpacity style={styles.ghostBtn} onPress={() => navigation.navigate('Lobby')}>
          <Text style={styles.ghostBtnText}>홈으로 돌아가기</Text>
        </TouchableOpacity>
      </View>
    </ScreenShell>
  );
}

// ── Stage 3: 두 사람 모두 완료 → 결과 진입 중간 화면 ──────────────────────
// B 제출 직후 & A가 푸시/링크 재진입 시 공통으로 마주하는 화면.
// 여기서 "결과 확인하기"를 누르면 비로소 CoupleResultScreen으로 이동.
function PartnerCompleteScreen({ coupleCode, navigation }) {
  return (
    <ScreenShell>
      <View style={styles.centerContainer}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>밸런스 게임 완료!</Text>
        <Text style={styles.subtitle}>
          두 분 모두 답변을 마쳤어요.{'\n'}이제 가치관 비교 결과를 확인해보세요!
        </Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.replace('Result', { coupleCode })}
          activeOpacity={0.88}
        >
          <Text style={styles.primaryBtnText}>🔍 밸런스 게임 결과 확인하기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ghostBtn, { marginTop: 12 }]}
          onPress={() => navigation.navigate('Lobby')}
        >
          <Text style={styles.ghostBtnText}>홈으로 돌아가기</Text>
        </TouchableOpacity>
      </View>
    </ScreenShell>
  );
}

// ── Stage 4+5: 두 사람 모두 완료 → 비교 결과 ──────────────────────────
function CoupleResultScreen({ coupleCode, navigation }) {
  const [status, setStatus]             = useState('loading');
  const [matchCount, setMatch]          = useState(0);
  const [unmatched, setUnmatched]       = useState([]);
  const [skippedBoth, setSkippedBoth]   = useState([]);
  const [catCount, setCatCount]         = useState({ '돈': [0, 0], '시댁': [0, 0], '라이프': [0, 0] });
  const [shared, setShared]           = useState(false);
  const [waitingPartner, setWaiting]  = useState(false);

  const buildResult = (snap) => {
    const { creatorAnswers, partnerAnswers } = snap.val();
    if (!creatorAnswers || !partnerAnswers) return false;

    let matched = 0;
    const unmatchedList = [];
    const skippedBothList = [];
    const cc = { '돈': [0, 0], '시댁': [0, 0], '라이프': [0, 0] };

    const allQ = getCachedQuestionsSync();
    Object.keys(creatorAnswers).forEach(idStr => {
      const q = allQ.find(q => q.id === Number(idStr));
      if (!q) return;
      const cA = creatorAnswers[idStr];
      const cB = partnerAnswers[idStr];
      if (cA === 'skipped' && cB === 'skipped') {
        skippedBothList.push({ q });
        return;
      }
      const type = q.type;
      if (cc[type]) cc[type][0]++;
      if (cA === cB) {
        matched++;
      } else {
        if (cc[type]) cc[type][1]++;
        unmatchedList.push({ q, creatorChoice: cA, partnerChoice: cB ?? '?' });
      }
    });

    setMatch(matched);
    setUnmatched(unmatchedList);
    setSkippedBoth(skippedBothList);
    setCatCount(cc);
    setStatus('ready');
    trackEvent('partner_result_viewed', {
      couple_code: coupleCode,
      match_rate: Math.round((matched / 20) * 100),
      unmatched_count: unmatchedList.length,
    });
    return true;
  };

  useEffect(() => {
    const unsubscribe = onValue(ref(db, `couples/${coupleCode}`), (snap) => {
      if (!snap.exists()) { setStatus('error'); return; }
      const ok = buildResult(snap);
      if (!ok) setWaiting(true);
    }, (e) => {
      console.error('[CoupleResult]', e);
      setStatus('error');
    });
    return () => unsubscribe();
  }, [coupleCode]);

  const answeredTotal = matchCount + unmatched.length;
  const rate          = answeredTotal > 0 ? Math.round((matchCount / answeredTotal) * 100) : 0;
  const color         = rateColor(rate);
  const titleData     = coupleTitle(rate);
  const catBars       = catMatchRate(catCount);
  const spicy         = unmatched.slice(0, 3);

  const markShared = () => { setShared(true); setTimeout(() => setShared(false), 3000); };

  const handleShare = async () => {
    trackEvent('result_share_clicked', { couple_code: coupleCode, match_rate: rate });
    const deepLink = 'intoss://halfandhalf';
    await Clipboard.setStringAsync(deepLink).catch(() => {});
    markShared();
  };


  if (status === 'loading') return (
    <ScreenShell>
      <View style={cs.center}>
        <ActivityIndicator size="large" color="#1A1A1A" />
        <Text style={cs.dimText}>결과 분석 중...</Text>
      </View>
    </ScreenShell>
  );

  if (waitingPartner && status !== 'ready') return (
    <ScreenShell>
      <View style={cs.center}>
        <Text style={cs.emoji}>💌</Text>
        <Text style={cs.errorText}>연인이 답변 중이에요!</Text>
        <Text style={[cs.errorText, { fontSize: 13, color: '#6B7280', marginTop: 8 }]}>
          완료되면 이 화면이 자동으로 바뀌어요
        </Text>
        <ActivityIndicator size="small" color="#FFD60A" style={{ marginTop: 20 }} />
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
      <ScrollView contentContainerStyle={cs.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={[cs.titleCard, { backgroundColor: titleData.bg, borderColor: titleData.border }]}>
          <Text style={cs.titleEmoji}>{titleData.emoji}</Text>
          <Text style={[cs.titleText, { color: titleData.textColor }]}>{titleData.title}</Text>
          <Text style={cs.titleDesc}>{titleData.desc}</Text>
        </View>

        <View style={cs.matchCard}>
          <Text style={cs.matchLabel}>가치관 일치율</Text>
          <Text style={[cs.matchRate, { color }]}>{rate}%</Text>
          <View style={cs.gaugeTrack}>
            <View style={[cs.gaugeFill, { width: `${rate}%`, backgroundColor: color }]} />
          </View>
          <Text style={cs.matchCount}>
            {answeredTotal}문항 중{' '}
            <Text style={{ color, fontWeight: '900' }}>{matchCount}문항 일치</Text>
            {' '}· {unmatched.length}문항 불일치
            {skippedBoth.length > 0 && ` · ${skippedBoth.length}문항 보류`}
          </Text>
        </View>

        <View style={cs.catCard}>
          <Text style={cs.sectionTitle}>📊 영역별 가치관 일치 점수</Text>
          {catBars.map(({ key, emoji, label, pct, color: c, matched, total }) => (
            <View key={key} style={cs.catRow}>
              <Text style={cs.catLabel}>{emoji} {label}</Text>
              <View style={cs.catBarTrack}>
                <View style={[cs.catBarFill, { width: `${pct}%`, backgroundColor: c }]} />
              </View>
              <Text style={[cs.catPct, { color: c }]}>{pct}%</Text>
            </View>
          ))}
        </View>

        {spicy.length > 0 && (
          <View style={cs.section}>
            <Text style={cs.sectionTitle}>🌶️ 서로 다른 의견</Text>
            <Text style={cs.sectionDesc}>두 분이 실제로 다른 답을 고른 질문들이에요</Text>
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

        {skippedBoth.length > 0 && (
          <View style={cs.section}>
            <Text style={cs.sectionTitle}>⏭️ 두 분 모두 보류한 문항</Text>
            <Text style={cs.sectionDesc}>함께 다시 이야기해봐도 좋을 질문들이에요</Text>
            {skippedBoth.map(({ q }) => (
              <View key={q.id} style={cs.skippedCard}>
                <Text style={cs.spicyTag}>{q.tag}</Text>
                <Text style={cs.spicyCriteria}>{q.criteria}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={cs.appCtaCard}>
          <Text style={cs.appCtaEmoji}>📱</Text>
          <Text style={cs.appCtaTitle}>
            우리 부부의 소름 돋는 심층 분석 결과와{'\n'}매운맛 질문은 앱에서 무료로 확인하세요!
          </Text>
          <View style={cs.appBtnRow}>
            <TouchableOpacity style={cs.appStoreBtn} activeOpacity={0.82}>
              <Text style={cs.appStoreBtnIcon}>🍎</Text>
              <View>
                <Text style={cs.appStoreBtnSub}>Download on the</Text>
                <Text style={cs.appStoreBtnMain}>App Store</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={cs.appStoreBtn} activeOpacity={0.82}>
              <Text style={cs.appStoreBtnIcon}>▶</Text>
              <View>
                <Text style={cs.appStoreBtnSub}>Get it on</Text>
                <Text style={cs.appStoreBtnMain}>Google Play</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={cs.shareSection}>
          <Text style={cs.shareLabel}>결과가 마음에 들었나요? 친구들에게 소문내 주세요 🙌</Text>
          <TouchableOpacity style={[cs.shareBtn, shared && cs.shareBtnDone]} onPress={handleShare} activeOpacity={0.88}>
            <Text style={cs.shareBtnText}>{shared ? '✅ 링크가 복사됐어요!' : '📋 초대 링크 복사하기'}</Text>
            {!shared && <Text style={cs.shareBtnSub}>링크를 복사해서 친구에게 보내세요</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={cs.ghostBtn} onPress={() => navigation.replace('Lobby')}>
          <Text style={cs.ghostBtnText}>홈으로 돌아가기</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenShell>
  );
}

function DummyReport({ catCount, unmatched, rate }) {
  const cats = [
    { key: '돈',    label: '💰 돈 & 재테크' },
    { key: '시댁',  label: '🏠 서로의 가족' },
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

      <View style={rp.card}>
        <Text style={rp.cardTitle}>🤖 AI 종합 진단 요약</Text>
        <Text style={rp.cardBody}>
          {rate >= 70
            ? `두 분의 가치관 일치율은 ${rate}%로 상위 30%에 해당합니다. 일치하는 부분을 강점으로 삼고, 불일치 ${20 - Math.round(rate * 20 / 100)}개 항목을 집중 대화하면 매우 안정적인 결혼 생활이 기대됩니다.`
            : `두 분의 가치관 일치율은 ${rate}%입니다. 불일치 항목이 ${20 - Math.round(rate * 20 / 100)}개로 다소 높습니다. 아래 가이드라인을 따라 체계적으로 조율하면 갈등을 크게 줄일 수 있습니다.`}
        </Text>
      </View>

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

// ── 레거시 룸 시스템 (rooms/ 경로, 구형 플로우) ──────────────────────────
function LegacyRoomScreen({ route, navigation }) {
  const { category: passedCategory, history, roomId } = route.params;
  const isUserB = !!roomId;

  const [createdRoomId, setCreatedRoomId] = useState(null);
  const [roomStatus, setRoomStatus]       = useState('creating');
  const [tossSharing, setTossSharing]     = useState(false);
  const [tossShared, setTossShared]       = useState(false);
  const [compareStatus, setCompareStatus] = useState('saving');
  const [comparison, setComparison]       = useState(null);
  const [compromises, setCompromises]     = useState({});
  const [savingCompromise, setSavingComp] = useState(false);
  const [compromiseSaved, setCompSaved]   = useState(false);

  useEffect(() => {
    if (isUserB) { setupUserB(); } else { createRoom(); }
  }, []);

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

  const handleTossShare = async () => {
    if (tossSharing) return;
    setTossSharing(true);
    try {
      if (!createdRoomId) return;
      await Clipboard.setStringAsync(`intoss://halfandhalf?room=${createdRoomId}`).catch(() => {});
      setTossShared(true);
      setTimeout(() => setTossShared(false), 3000);
    } catch {} finally {
      setTossSharing(false);
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
    const matching = [], different = [], skippedBoth = [];
    const allQ = getCachedQuestionsSync();
    Object.keys(answersA).forEach(idStr => {
      const question = allQ.find(q => q.id === Number(idStr));
      if (!question) return;
      const choiceA = answersA[idStr];
      const choiceB = answersB?.[idStr];
      if (choiceA === 'skipped' && choiceB === 'skipped') { skippedBoth.push({ question }); return; }
      (choiceA === choiceB ? matching : different).push(
        choiceA === choiceB
          ? { question, choice: choiceA }
          : { question, choiceA, choiceB: choiceB ?? '?' }
      );
    });
    setComparison({ category, matching, different, skippedBoth });
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

  if (!isUserB) return (
    <ScreenShell>
      <View style={styles.centerContainer}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>모든 질문 완료!</Text>
        <Text style={styles.subtitle}>{CATEGORY_LABEL[passedCategory] || passedCategory} 카테고리의{'\n'}모든 밸런스 게임을 마쳤어요.</Text>
        <View style={styles.shareSection}>
          {roomStatus === 'error' && <Text style={styles.errorText}>링크 생성에 실패했습니다.</Text>}
          {roomStatus === 'done' && createdRoomId && (
            <TouchableOpacity style={[styles.tossShareBtn, tossShared && styles.primaryBtnGreen]} onPress={handleTossShare} disabled={tossSharing}>
              <Text style={styles.tossShareBtnText}>{tossShared ? '✅ 링크가 복사됐어요!' : tossSharing ? '복사 중...' : '📋 초대 링크 복사하기'}</Text>
              {!tossShared && !tossSharing && <Text style={styles.tossShareBtnSub}>링크를 복사해서 연인에게 보내세요</Text>}
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.ghostBtn} onPress={goHome}>
          <Text style={styles.ghostBtnText}>홈으로 돌아가기</Text>
        </TouchableOpacity>
      </View>
    </ScreenShell>
  );

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

  const { matching, different, skippedBoth = [] } = comparison;
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
        {skippedBoth.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⏭️ 두 분 모두 보류한 문항</Text>
            {skippedBoth.map(({ question }) => (
              <View key={question.id} style={styles.skippedCard}>
                <Text style={styles.qCriteria}>{question.criteria}</Text>
              </View>
            ))}
          </View>
        )}
        <TouchableOpacity style={styles.archiveBtn} onPress={handleArchivePress}><Text style={styles.archiveBtnText}>🔒 우리만의 가치관 백서 확인하기</Text></TouchableOpacity>
        <TouchableOpacity style={styles.ghostBtn} onPress={goHome}><Text style={styles.ghostBtnText}>홈으로 돌아가기</Text></TouchableOpacity>
      </ScrollView>
    </ScreenShell>
  );
}

// ── 라우터: isCreator+coupleCode → CreatorInviteScreen   (A: B 대기 화면)
//            isPartner+coupleCode → PartnerCompleteScreen (양쪽: 결과 진입 중간 화면)
//            coupleCode만          → CoupleResultScreen    (실제 성향 분석 리포트)
//            roomId (레거시)       → LegacyRoomScreen
export default function ResultScreen({ route, navigation }) {
  const { coupleCode, isCreator, isPartner, category, history, roomId } = route.params ?? {};
  if (isCreator && coupleCode) {
    return <CreatorInviteScreen coupleCode={coupleCode} category={category} navigation={navigation} />;
  }
  if (isPartner && coupleCode) {
    return <PartnerCompleteScreen coupleCode={coupleCode} navigation={navigation} />;
  }
  if (coupleCode) {
    return <CoupleResultScreen coupleCode={coupleCode} navigation={navigation} />;
  }
  return <LegacyRoomScreen route={route} navigation={navigation} />;
}

const cs = StyleSheet.create({
  scroll:      { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, gap: 16 },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emoji:       { fontSize: 52, marginBottom: 12 },
  dimText:     { fontSize: 13, color: '#9CA3AF', marginTop: 10 },
  errorText:   { fontSize: 13, color: '#EF4444' },
  matchCard:   { backgroundColor: '#F9FAFB', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  matchLabel:  { fontSize: 13, color: '#6B7280', fontWeight: '700', marginBottom: 8, letterSpacing: 0.5 },
  matchRate:   { fontSize: 64, fontWeight: '900', lineHeight: 72 },
  matchSub:    { fontSize: 14, color: '#374151', fontWeight: '700', marginTop: 4, marginBottom: 16, textAlign: 'center', wordBreak: 'keep-all', overflowWrap: 'break-word' },
  gaugeTrack:  { width: '100%', height: 10, backgroundColor: '#E5E7EB', borderRadius: 5, overflow: 'hidden', marginBottom: 10 },
  gaugeFill:   { height: '100%', borderRadius: 5 },
  matchCount:  { fontSize: 13, color: '#6B7280', wordBreak: 'keep-all', overflowWrap: 'break-word' },
  section:     { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#1A1A1A', marginBottom: 4 },
  spicyCard:   { backgroundColor: '#FFFBEB', borderWidth: 1.5, borderColor: '#FDE68A', borderRadius: 16, padding: 16, gap: 8 },
  spicyTag:    { fontSize: 11, color: '#92400E', fontWeight: '700' },
  spicyCriteria: { fontSize: 13, fontWeight: '700', color: '#374151', lineHeight: 20, wordBreak: 'keep-all', overflowWrap: 'break-word' },
  choiceRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tagA:        { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, minWidth: 44, alignItems: 'center' },
  tagB:        { backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, minWidth: 44, alignItems: 'center' },
  tagTxt:      { fontSize: 10, fontWeight: '800', color: '#4B5563' },
  choiceTxt:   { flex: 1, fontSize: 12, color: '#374151', lineHeight: 18, wordBreak: 'keep-all', overflowWrap: 'break-word' },
  appCtaCard:      { backgroundColor: '#F9FAFB', borderRadius: 20, padding: 24, alignItems: 'center', gap: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  appCtaEmoji:     { fontSize: 36 },
  appCtaTitle:     { fontSize: 15, fontWeight: '800', color: '#1A1A1A', textAlign: 'center', lineHeight: 24, wordBreak: 'keep-all', overflowWrap: 'break-word' },
  appBtnRow:       { flexDirection: 'row', gap: 10, width: '100%' },
  appStoreBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1A1A1A', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, justifyContent: 'center' },
  appStoreBtnIcon: { fontSize: 20, color: '#FFFFFF' },
  appStoreBtnSub:  { fontSize: 9, color: 'rgba(255,255,255,0.65)', fontWeight: '600', letterSpacing: 0.3 },
  appStoreBtnMain: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  ghostBtn:    { borderWidth: 1.5, borderColor: '#E5E7EB', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  ghostBtnText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
  sectionDesc: { fontSize: 12, color: '#9CA3AF', marginBottom: 8, wordBreak: 'keep-all', overflowWrap: 'break-word' },
  skippedCard: { backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 16, padding: 16, gap: 4 },
  titleCard:   { borderWidth: 2, borderRadius: 20, padding: 22, alignItems: 'center', gap: 8 },
  titleEmoji:  { fontSize: 44 },
  titleText:   { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  titleDesc:   { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20, wordBreak: 'keep-all', overflowWrap: 'break-word' },
  catCard:     { backgroundColor: '#FAFAFA', borderRadius: 20, padding: 20, gap: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  catRow:      { gap: 6 },
  catLabel:    { fontSize: 13, fontWeight: '700', color: '#374151' },
  catBarTrack: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  catBarFill:  { height: '100%', borderRadius: 4 },
  catPct:      { fontSize: 12, fontWeight: '800', textAlign: 'right' },
  shareSection:  { alignItems: 'center', gap: 10 },
  shareLabel:    { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20, wordBreak: 'keep-all', overflowWrap: 'break-word' },
  shareBtn:      { width: '100%', backgroundColor: '#1A1A1A', borderRadius: 16, paddingVertical: 18, alignItems: 'center', gap: 4 },
  shareBtnDone:  { backgroundColor: '#16A34A' },
  shareBtnText:  { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  shareBtnSub:   { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  notifySection:  { alignItems: 'center', gap: 10, marginBottom: 8 },
  notifyLabel:    { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20, wordBreak: 'keep-all', overflowWrap: 'break-word' },
  notifyBtn:      {
    width: '100%',
    backgroundColor: '#0064FF',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#0064FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  notifyBtnText:  { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  notifyBtnSub:   { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
});

const rp = StyleSheet.create({
  container:    { gap: 14 },
  headerBand:   { backgroundColor: '#1A1A1A', borderRadius: 16, padding: 20, alignItems: 'center', gap: 4 },
  headerTitle:  { fontSize: 16, fontWeight: '900', color: '#FFD60A' },
  headerSub:    { fontSize: 12, color: '#888' },
  card:         { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 18, gap: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardTitle:    { fontSize: 14, fontWeight: '900', color: '#1A1A1A' },
  cardBody:     { fontSize: 13, color: '#374151', lineHeight: 22, wordBreak: 'keep-all', overflowWrap: 'break-word' },
  gaugeRow:     { gap: 6 },
  gaugeLabel:   { fontSize: 13, fontWeight: '700', color: '#374151' },
  gaugeTrack:   { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  gaugeFill:    { height: '100%', borderRadius: 4 },
  gaugeLevelTxt: { fontSize: 11, fontWeight: '800', textAlign: 'right' },
  adviceItem:   { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  adviceEmoji:  { fontSize: 24, marginTop: 2 },
  adviceTitle:  { fontSize: 13, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
  adviceBody:   { fontSize: 12, color: '#6B7280', lineHeight: 18, wordBreak: 'keep-all', overflowWrap: 'break-word' },
  guideRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  guideBullet:  { width: 22, height: 22, borderRadius: 11, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  guideBulletTxt: { fontSize: 11, fontWeight: '900', color: '#FFF' },
  guideBody:    { flex: 1, fontSize: 13, color: '#374151', lineHeight: 20, wordBreak: 'keep-all', overflowWrap: 'break-word' },
  footer:       { alignItems: 'center', paddingVertical: 8 },
  footerTxt:    { fontSize: 11, color: '#9CA3AF' },
});

const styles = StyleSheet.create({
  centerContainer:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emoji:            { fontSize: 64, marginBottom: 16 },
  title:            { fontSize: 26, fontWeight: '900', color: '#1A1A1A', marginBottom: 12 },
  subtitle:         { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24, marginBottom: 32, wordBreak: 'keep-all', overflowWrap: 'break-word' },
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
  tossShareBtn:     { width: '100%', backgroundColor: '#1A1A1A', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  tossShareBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  tossShareBtnSub:  { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4 },
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
  skippedCard:      { backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 16, padding: 16, marginBottom: 10 },
  notifyShareBtn: {
    width: '100%',
    backgroundColor: '#0064FF',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#0064FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 12,
  },
  notifyShareBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  notifyShareBtnSub:  { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  waitingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  waitingText: { fontSize: 13, color: '#6B7280', flex: 1, lineHeight: 18 },
});
