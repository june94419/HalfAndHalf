import { Platform } from 'react-native';

const GA_ID = process.env.EXPO_PUBLIC_GA_MEASUREMENT_ID ?? 'G-XXXXXXXXXX';

// GA4 스크립트 동적 로드 (웹 전용, 앱 초기화 시 1회 호출)
export function initGA() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (window.__ga_initialized) return;
  window.__ga_initialized = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { send_page_view: false });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
}

// 이벤트 추적
export function trackEvent(eventName, params = {}) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    if (window.gtag) window.gtag('event', eventName, params);
  } catch (e) {
    console.warn('[GA4] trackEvent 실패:', e);
  }
}
