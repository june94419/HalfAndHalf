import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

export default function ScreenShell({ rightAction, children, contentStyle }) {
  return (
    <View style={styles.outerContainer}>
      <View style={styles.mobileContainer}>
        <View style={styles.header}>
          <Text style={styles.logoText}>반반</Text>
          {rightAction}
        </View>
        <View style={[styles.content, contentStyle]}>
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mobileContainer: {
    width: '100%',
    maxWidth: 430,
    // 웹: 100dvh로 모바일 브라우저 주소창까지 정확히 대응
    // 네이티브: flex:1
    ...(Platform.OS === 'web'
      ? { height: '100dvh' }
      : { flex: 1 }),
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  header: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
});
