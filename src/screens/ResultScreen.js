import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ref, onValue, remove } from 'firebase/database';
import { db } from '../../firebase';
import { calcMatchRates } from '../utils/gameUtils';

function PizzaGauge({ percent }) {
  const anim = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: percent,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [percent]);
  const color = percent >= 70 ? '#FFD60A' : percent >= 40 ? '#E63946' : '#555';

  return (
    <View style={gaugeStyles.wrap}>
      <View style={gaugeStyles.track}>
        <Animated.View
          style={[
            gaugeStyles.fill,
            {
              width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
              backgroundColor: color,
            },
          ]}
        />
      </View>
      <Text style={[gaugeStyles.label, { color }]}>{percent}%</Text>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  track: { flex: 1, height: 8, backgroundColor: '#333', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  label: { fontSize: 15, fontWeight: '800', minWidth: 40, textAlign: 'right' },
});

export default function ResultScreen({ route, navigation }) {
  const { roomCode, nickname } = route.params;
  const [rates, setRates] = useState({});
  const [sorted, setSorted] = useState([]);

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsub = onValue(roomRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.val();
      const players = Object.keys(data.players || {});
      const answers = data.answers || {};
      const r = calcMatchRates(answers, nickname, players);
      setRates(r);
      const s = Object.entries(r).sort((a, b) => b[1] - a[1]);
      setSorted(s);
    });
    return () => unsub();
  }, []);

  const soulmate = sorted[0];
  const rival = sorted[sorted.length - 1];

  async function handleHome() {
    navigation.replace('Home');
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>결과 🍕</Text>
      <Text style={styles.sub}>나와 얼마나 잘 맞을까?</Text>

      {/* 소울메이트 / 앙숙 */}
      {soulmate && rival && (
        <View style={styles.highlightRow}>
          <View style={[styles.highlightCard, styles.soulCard]}>
            <Text style={styles.highlightEmoji}>💛</Text>
            <Text style={styles.highlightLabel}>소울메이트</Text>
            <Text style={styles.highlightName}>{soulmate[0]}</Text>
            <Text style={styles.highlightPct}>{soulmate[1]}%</Text>
          </View>
          <View style={[styles.highlightCard, styles.rivalCard]}>
            <Text style={styles.highlightEmoji}>🔥</Text>
            <Text style={styles.highlightLabel}>앙숙</Text>
            <Text style={styles.highlightName}>{rival[0]}</Text>
            <Text style={styles.highlightPct}>{rival[1]}%</Text>
          </View>
        </View>
      )}

      {/* 일치율 목록 */}
      <Text style={styles.listTitle}>전체 일치율 순위</Text>
      <FlatList
        data={sorted}
        keyExtractor={([name]) => name}
        style={styles.list}
        renderItem={({ item: [name, pct], index }) => (
          <View style={styles.rankRow}>
            <Text style={styles.rankNum}>{index + 1}</Text>
            <View style={styles.rankInfo}>
              <Text style={styles.rankName}>{name}</Text>
              <PizzaGauge percent={pct} />
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.btn} onPress={handleHome} activeOpacity={0.85}>
        <Text style={styles.btnText}>🏠 홈으로</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414', paddingHorizontal: 24, paddingTop: 20 },
  title: { fontSize: 34, fontWeight: '900', color: '#fff', marginBottom: 4 },
  sub: { color: '#888', fontSize: 15, marginBottom: 24 },
  highlightRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  highlightCard: {
    flex: 1, borderRadius: 20, padding: 18, alignItems: 'center', gap: 4,
  },
  soulCard: { backgroundColor: '#2A2200' },
  rivalCard: { backgroundColor: '#2A0A0A' },
  highlightEmoji: { fontSize: 28 },
  highlightLabel: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  highlightName: { color: '#fff', fontSize: 17, fontWeight: '800' },
  highlightPct: { color: '#FFD60A', fontSize: 22, fontWeight: '900' },
  listTitle: { color: '#FFD60A', fontSize: 13, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  list: { flex: 1 },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    gap: 14,
  },
  rankNum: { color: '#555', fontSize: 18, fontWeight: '900', width: 24, textAlign: 'center' },
  rankInfo: { flex: 1, gap: 8 },
  rankName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btn: {
    backgroundColor: '#E63946',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
