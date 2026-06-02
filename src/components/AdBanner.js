import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AdBanner({ height = 72 }) {
  return (
    <View style={[styles.wrap, { height }]}>
      <Text style={styles.label}>📢 광고 영역</Text>
      <Text style={styles.sub}>Google AdSense 준비 중</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
  },
  label: { fontSize: 13, color: '#AAAAAA', fontWeight: '600' },
  sub:   { fontSize: 10, color: '#CCCCCC' },
});
