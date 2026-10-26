/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages 의 프로젝트 하위 경로(/저장소이름/)에서도 동작하도록 base 를 환경변수로 받는다.
 * 앱은 단일 화면에서 상태를 전환한다. 잘못된 하위 주소는 기본 화면으로 돌려보낸다.
 */
function pages404Redirect(base: string): Plugin {
  return {
    name: 'pages-404-redirect',
    apply: 'build',
    generateBundle() {
      const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>이동 중…</title>
<script>
  (function () {
    var base = ${JSON.stringify(base)};
    location.replace(base + location.search);
  })();
</script></head><body>이동 중…</body></html>`;
      this.emitFile({ type: 'asset', fileName: '404.html', source: html });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '';
  let secret = key.startsWith('sb_secret_');
  if (key.split('.').length === 3) {
    try { secret ||= JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'service_role'; } catch { /* invalid keys fail at connection */ }
  }
  if (secret) throw new Error('비밀키를 VITE_ 환경변수에 넣을 수 없습니다. publishable/anon 키를 사용하세요.');
  let base = env.VITE_BASE_PATH || '/';
  if (!base.startsWith('/')) base = '/' + base;
  if (!base.endsWith('/')) base = base + '/';

  return {
    base,
    plugins: [react(), pages404Redirect(base)],
    build: {
      chunkSizeWarningLimit: 1200,
    },
    test: {
      include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
      environment: 'node',
      testTimeout: 30_000,
    },
  };
});
