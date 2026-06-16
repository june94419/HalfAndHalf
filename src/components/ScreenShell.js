import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = '__rnw_scroll_fix';
  if (!document.getElementById(styleId)) {
    const tag = document.createElement('style');
    tag.id = styleId;
    tag.textContent = `
      html, body {
        height: auto !important;
        overflow-y: auto !important;
        -webkit-overflow-scrolling: touch !important;
      }
      #root, [data-reactroot] {
        height: auto !important;
        min-height: 100dvh !important;
        overflow-y: visible !important;
      }
      div[style*="overflow: hidden"], div[style*="overflow:hidden"] {
        -webkit-overflow-scrolling: touch !important;
      }
    `;
    document.head.appendChild(tag);
  }
}

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
    ...(Platform.OS === 'web'
      ? {
          height: '100dvh',
          // iOS Safari: overflow:hidden + 고정 높이 조합이 자식 ScrollView 이벤트를
          // 완전 차단함. visible로 열어서 자식이 자체 스크롤 컨테이너가 되도록 허용.
          overflow: 'visible',
        }
      : { flex: 1, overflow: 'hidden' }),
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
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
