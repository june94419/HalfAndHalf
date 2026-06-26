import { Platform } from 'react-native';

export function initGA() {}

export function trackEvent(eventName, params = {}) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    if (window.gtag) window.gtag('event', eventName, params);
  } catch {}
}
