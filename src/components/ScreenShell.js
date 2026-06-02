import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

export default function ScreenShell({ rightAction, children, contentStyle }) {
  return (
    <View style={styles.outerContainer}>
      <View style={styles.mobileContainer}>
        <View style={styles.header}>
          <Text style={styles.logoText}>Half And Half</Text>
          {rightAction}
        </View>
        <View style={[styles.content, contentStyle]}>
          {children}
        </View>
        <View style={styles.adBannerPlaceholder}>
          <Text style={styles.adText}>Google AdSense 광고 영역</Text>
          <Text style={styles.adSubText}>모바일 하단 고정 배너 배정 자리 (320x50)</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  mobileContainer: { width: '100%', maxWidth: 430, height: '100%', maxHeight: Dimensions.get('window').height, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5, justifyContent: 'space-between' },
  header: { height: 60, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, position: 'relative' },
  logoText: { fontSize: 20, fontWeight: '900', color: '#1A1A1A', letterSpacing: -0.5 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 15, justifyContent: 'center' },
  adBannerPlaceholder: { height: 60, backgroundColor: '#F9FAFB', borderTopWidth: 1, borderTopColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', paddingBottom: 4 },
  adText: { fontSize: 11, fontWeight: '700', color: '#9CA3AF' },
  adSubText: { fontSize: 9, color: '#D1D5DB', marginTop: 2 },
});
