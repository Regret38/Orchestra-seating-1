# 기타 물체 세트 업데이트 적용 안내

이 ZIP은 기존 무대노트 프로그램에 적용하는 **부분 업데이트**입니다. 신규 프로젝트 전체 소스가 아닙니다. 이전에 전달한 GitHub 업로드용 소스를 기준으로 작성했습니다.

## 추가한 기능

- 상단의 여섯 번째 세트 `기타 물체`
- 예: 피아노, 스피커, 장비, 통로 등 사용자가 입력하는 이름
- 점선 사각형으로 공간 표시
- 선택 후 이름·가로·세로·위치·회전 변경
- 기존 세트와 같은 이동·복제·삭제·실행 취소·다시 실행
- 온라인/데모 저장, 일정 복사, JSON 내보내기·가져오기, PNG·인쇄에 포함
- 보면대·일반 의자·장의자 준비 수량에는 **모두 0개**로 반영
- 악기·파트별 물품 표에는 제외, 세트별 개수와 전체 배치 객체 수에는 포함
- 기존 의자 세트를 물체로 바꾸면 그 세트의 준비 수량이 빠지고, 다시 의자 세트로 바꾸면 새 구성만큼 집계

가로·세로 크기는 30~1000 안내도 단위입니다. 실제 cm 단위의 축척은 아닙니다. 다른 세트처럼 자유롭게 이동할 수 있으며 드래그 중 겹침을 강제로 막는 기능은 아닙니다. 새 세트를 생성할 때에는 물체가 차지하는 영역도 고려합니다.

## GitHub 웹사이트에서 적용 (권장)

1. 이 ZIP의 압축을 풉니다.
2. GitHub의 **기존 저장소**에서 `Code → Add file → Upload files`로 들어갑니다.
3. 압축을 푼 폴더 **안의** `src` 폴더, `e2e` 폴더, `README.md`, `UPDATE_OBJECT.md`를 업로드 영역으로 끌어 놓습니다.
4. `Commit changes`로 저장합니다. 바깥 `orchestra-object-update` 폴더나 ZIP 파일 자체를 올리지 마세요.
5. 기존 경로와 이름이 같은 파일은 새 내용으로 갱신되고, 이번 ZIP에 없는 기존 파일은 그대로 유지됩니다.
6. `Actions → Deploy GitHub Pages → Run workflow`를 실행합니다. 기존 Supabase 온라인 모드라면 demo 체크를 해제합니다.
7. 배포가 완료되면 사이트를 새로고침합니다. 다른 사용자에게도 새로고침하도록 알려 주세요.

## 로컬 Git으로 적용하는 경우

기존 프로젝트는 먼저 백업하고, ZIP 안 파일을 **각각 같은 상대 경로로** 덮어씁니다. 일부 파일만 담긴 ZIP이므로 기존 `src`나 `e2e` 폴더를 삭제하거나 폴더 전체를 대치하면 안 됩니다. 다른 파일은 남겨 두고 아래 목록의 파일만 교체·추가하세요.

기존 Git 프로젝트 폴더에서:

```bash
npm test
npm run build
git add src e2e README.md UPDATE_OBJECT.md
git commit -m "Add non-counted stage objects"
git push
```

이후 위와 같이 Actions에서 수동 배포를 실행합니다. 브라우저로 GitHub 파일을 바꿨다면 기존 로컬 프로젝트에서 다음 편집을 시작하기 전에 해당 변경을 동기화하세요.

## 교체·추가 파일

1. `src/domain/types.ts`
2. `src/domain/sets.ts`
3. `src/domain/layoutOps.ts`
4. `src/domain/counting.ts`
5. `src/domain/labels.ts`
6. `src/domain/validation.ts`
7. `src/domain/counting.test.ts`
8. `src/domain/object.test.ts` (추가)
9. `src/components/stage/SetNode.tsx`
10. `src/components/ui.tsx`
11. `src/app/App.tsx`
12. `src/styles.css`
13. `e2e/object.spec.ts` (추가)
14. `README.md`
15. `UPDATE_OBJECT.md` (이 안내)

## 데이터베이스 및 호환성

**Supabase SQL 재실행이나 새 마이그레이션은 필요 없습니다.** 기존 JSON 저장 항목에 물체 종류·이름·크기를 함께 저장합니다. 기존 배치와 로그인·권한·연결 설정은 그대로 사용합니다. 새 npm 패키지도 필요 없습니다.

기존 배치 파일은 업데이트 버전에서 계속 열립니다. 다만 새 물체가 포함된 배치를 이전 버전 앱에서는 읽지 못할 수 있으므로 배포 후 모든 사용자가 새로고침해야 합니다. 실제 사용자 Supabase 계정에 접속한 검증은 수행하지 않았습니다.

## 검증 결과

- TypeScript 검사 및 Vite 프로덕션 빌드 통과
- 단위/저장/권한 테스트 81개 통과
- 데스크톱·모바일 에뮬레이션 브라우저 테스트 10개 통과
- 물체 변경 전후 준비 수량 유지, 기존 세트와의 구성 변환, 크기·회전 영역, JSON·데모 저장 복원 검증
- 프로덕션 빌드에서 한글 글꼴 등 자산 로드 확인

실제 GitHub 저장소 업로드나 공개 배포는 수행하지 않았습니다.
