import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'halfandhalf',
  web: {
    host: 'localhost',
    port: 8081,
    commands: {
      dev: 'expo start --web',
      build: 'expo export --platform web && node scripts/sanitize-bundle.js',
    },
  },
  // 클립보드 쓰기만 사용 (초대 링크 복사)
  permissions: [{ name: 'clipboard', access: 'write' }],
  outdir: 'dist',
  brand: {
    displayName: '반반',
    icon: 'https://half-and-half-nine.vercel.app/icon.png',
    primaryColor: '#FFD60A',
    bridgeColorMode: 'inverted',
  },
  // 토스 상단 뒤로가기 버튼 활성화
  navigationBar: {
    withBackButton: true,
  },
  webViewProps: {
    type: 'partner',
  },
});
