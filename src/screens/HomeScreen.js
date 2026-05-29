import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import HalfPizza from '../components/HalfPizza';

export default function HomeScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* 로고 영역 */}
        <View style={styles.logoArea}>
          <View style={styles.pizzaWrap}>
            <HalfPizza size={160} />
          </View>
          <Text style={styles.appName}>반반</Text>
          <Text style={styles.appSub}>Half & Half</Text>
          <Text style={styles.tagline}>친구들과 즐기는 밸런스 게임</Text>
        </View>

        {/* 버튼 영역 */}
        <View style={styles.buttonArea}>
          {/* 멀티플레이 */}
          <Text style={styles.sectionLabel}>👥 멀티플레이</Text>
          <View style={styles.multiRow}>
            <TouchableOpacity
              style={[styles.halfBtn, styles.btnRed]}
              onPress={() => navigation.navigate('CreateRoom')}
              activeOpacity={0.85}
            >
              <Text style={styles.halfBtnIcon}>🍕</Text>
              <Text style={styles.halfBtnText}>방 만들기</Text>
              <Text style={styles.halfBtnSub}>내가 방장!</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.halfBtn, styles.btnYellow]}
              onPress={() => navigation.navigate('JoinRoom')}
              activeOpacity={0.85}
            >
              <Text style={styles.halfBtnIcon}>🧀</Text>
              <Text style={styles.halfBtnTextDark}>방 참가하기</Text>
              <Text style={styles.halfBtnSubDark}>코드 있어!</Text>
            </TouchableOpacity>
          </View>

          {/* 혼자하기 */}
          <Text style={[styles.sectionLabel, styles.sectionLabelGap]}>🎮 혼자하기</Text>
          <TouchableOpacity
            style={styles.soloBtn}
            onPress={() => navigation.navigate('SoloGame')}
            activeOpacity={0.85}
          >
            <Text style={styles.soloBtnIcon}>🕹️</Text>
            <View style={styles.soloBtnContent}>
              <Text style={styles.soloBtnText}>혼자하기</Text>
              <Text style={styles.soloBtnSub}>전 세계 픽과 비교해봐!</Text>
            </View>
            <Text style={styles.soloBtnArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>최대 10명 · 20가지 질문</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#141414',
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },

  // 로고
  logoArea: {
    alignItems: 'center',
    marginBottom: 40,
  },
  pizzaWrap: {
    marginBottom: 20,
  },
  appName: {
    fontSize: 52,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  appSub: {
    fontSize: 18,
    color: '#FFD60A',
    fontWeight: '700',
    letterSpacing: 4,
    marginTop: -4,
  },
  tagline: {
    fontSize: 14,
    color: '#888',
    marginTop: 12,
    fontWeight: '500',
  },

  // 버튼 영역
  buttonArea: {
    width: '100%',
    marginBottom: 32,
  },
  sectionLabel: {
    color: '#666',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  sectionLabelGap: {
    marginTop: 24,
  },

  // 멀티플레이 (좌우 나란히)
  multiRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfBtn: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 26,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 6,
  },
  btnRed: {
    backgroundColor: '#E63946',
  },
  btnYellow: {
    backgroundColor: '#FFD60A',
  },
  halfBtnIcon: {
    fontSize: 28,
  },
  halfBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  halfBtnTextDark: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  halfBtnSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  halfBtnSubDark: {
    fontSize: 11,
    color: 'rgba(0,0,0,0.5)',
    fontWeight: '600',
  },

  // 혼자하기 (풀 너비)
  soloBtn: {
    width: '100%',
    backgroundColor: '#1F1F1F',
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#2E2E2E',
  },
  soloBtnIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  soloBtnContent: {
    flex: 1,
  },
  soloBtnText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  soloBtnSub: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },
  soloBtnArrow: {
    fontSize: 28,
    color: '#444',
    fontWeight: '300',
  },

  footer: {
    color: '#555',
    fontSize: 13,
    fontWeight: '500',
  },
});
