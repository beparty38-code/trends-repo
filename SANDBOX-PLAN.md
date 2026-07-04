# 비개발자 기여 파이프라인 세팅 플랜

> **대상 프로젝트**: 온라인 학원 플랫폼의 게임 공간 (Colyseus + Tiled + Phaser)
> **목표**: 비개발자 직원이 AI 코딩 에이전트를 통해 기능을 추가하고, 사람 검토 없이 자동 검증만으로 배포할 수 있는 환경 구축
> **작성일**: 2026-07-04

---

## 1. 배경과 목표

- 게임 공간은 메인 서비스(학원 플랫폼)의 **실험적 서브 사이트**로, 장애 허용도가 높다.
- 비개발자 직원도 "포탈 근처에 NPC 추가해줘" 수준의 자연어 요청으로 기능을 추가 → 배포할 수 있어야 한다.
- 사람(개발자) 검토 게이트가 없으므로, **프로세스·자동 검증·폭발 반경 제한**이 안전을 대신 담보해야 한다.

### 성공 기준

| 기준 | 측정 |
|---|---|
| 비개발자가 개발자 도움 없이 기능 추가 → 배포 완료 | 온보딩 후 1주 내 첫 배포 성공 |
| 메인 플랫폼에 영향 0 | 게임 공간 장애가 학원 플랫폼으로 전파되지 않음 |
| 장애 복구 속도 | 배포 후 문제 발견 시 5분 내 롤백 |

---

## 2. 전체 아키텍처

```
비개발자 직원
   │  자연어 요청 ("포탈 근처에 NPC 추가해줘")
   ▼
① AI 에이전트 (Claude Code) + superpowers      ← 코딩 프로세스/규칙
   │  brainstorm → 계획 → TDD → 셀프 코드리뷰 강제
   ▼
② chrome-devtools-mcp                          ← 작업 중 브라우저 검증
   │  에이전트가 Phaser 게임을 실제 브라우저에서 실행,
   │  스크린샷·콘솔 에러 확인 후 PR 생성
   ▼
③ GitHub Actions CI/CD                         ← 배포 게이트
   │  PR마다: 빌드 + 린트 + 테스트 + 프리뷰 배포
   │  요청자가 프리뷰에서 직접 플레이 확인 후 병합
   │  병합 → 자동 프로덕션 배포 (+원클릭 롤백)
   ▼
프로덕션 (게임 공간 서브 사이트)
```

### 채택 도구

| 도구 | 역할 | 근거 |
|---|---|---|
| [obra/superpowers](https://github.com/obra/superpowers) | 에이전트 개발 방법론 (계획→TDD→리뷰 강제) | 사람 검토가 없는 구조의 1차 방어선 |
| [ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) | 에이전트의 브라우저 검증 | Phaser는 브라우저 게임 — "실행해서 눈으로 확인한 코드"만 PR |
| [actions/checkout](https://github.com/actions/checkout) + GitHub Actions | CI/CD 자동 게이트 | PR 검증·프리뷰 배포·자동 배포·롤백 |
| ~~TencentCloud/CubeSandbox~~ | (보류) 셀프호스팅 격리 실행 환경 | KVM 서버 운영 부담이 실험 프로젝트 규모에 과함. 규모 확대 시 재검토 |

---

## 3. 안전 설계 — 3중 방어선

사람 검토가 없으므로 아래 3개 층이 각각 독립적으로 사고를 막는다.

### 방어선 1: 프로세스 (superpowers)

에이전트가 코드를 바로 짜지 않고 다음을 강제:

1. **brainstorming** — 요청 의도를 질문으로 명확화 (비개발자의 모호한 요청 보완)
2. **writing-plans** — 작은 단위 작업 계획
3. **test-driven-development** — 테스트 먼저 작성 → 구현
4. **requesting-code-review** — 셀프 코드리뷰 후 PR

### 방어선 2: 자동 검증 (CI)

PR마다 필수 통과 (브랜치 보호로 강제):

- 클라이언트 빌드 (Phaser/Vite)
- 서버 빌드 (Colyseus/TypeScript)
- 린트 + 타입체크
- 유닛 테스트 (서버 룸 로직 중심)
- Tiled 맵 JSON 유효성 검사 (깨진 맵으로 인한 로딩 실패 방지)
- **PR 프리뷰 배포** — 요청자 본인이 병합 전에 직접 플레이 확인 (사실상 "본인이 리뷰어")

### 방어선 3: 폭발 반경 제한 (인프라)

- **메인 플랫폼과 격리**: 별도 레포·별도 배포·별도 도메인. 메인 DB 직접 접근 금지, 승인된 API 경유만.
- **위험도 차등**: 코드 영역별로 에이전트 권한을 다르게 (아래 §4).
- **즉시 롤백**: 배포 이력 유지, 원클릭(또는 자동) 이전 버전 복귀.

---

## 4. 위험도 차등 정책 (핵심 규칙)

Colyseus 서버 장애는 접속자 전원에게 영향을 주지만, 클라이언트 콘텐츠 실수는 영향이 작다.
비개발자 요청의 대부분은 맵/오브젝트/연출이므로, 이 차등만으로 리스크가 크게 줄어든다.

| 영역 | 위험도 | 정책 |
|---|---|---|
| Tiled 맵, 에셋, 텍스트 | 🟢 낮음 | 자유 수정. 맵 JSON 유효성 검사만 통과하면 OK |
| Phaser 씬, UI, 클라이언트 연출 | 🟡 중간 | 수정 허용 + chrome-devtools-mcp 브라우저 검증 필수 |
| Colyseus 룸 로직, 상태 동기화 | 🔴 높음 | 유닛 테스트 커버리지 필수, 테스트 없는 변경은 CI에서 차단 |
| 인증, 메인 플랫폼 연동, 배포 설정 | ⛔ 금지 | 에이전트 수정 금지 (CLAUDE.md 명시 + CODEOWNERS로 개발자 승인 요구) |

---

## 5. 구축할 것 목록

### 5-1. `CLAUDE.md` (에이전트 규칙) — 프로젝트 루트

```markdown
# 게임 공간 개발 규칙 (AI 에이전트용)

## 절대 금지
- src/auth/, src/platform-api/, .github/, 배포 설정 파일 수정 금지
- 메인 플랫폼 DB/내부 API 직접 호출 금지 (승인된 클라이언트 모듈만 사용)

## 필수 프로세스
- Colyseus 룸 로직(server/rooms/) 수정 시: 유닛 테스트 먼저 작성 (TDD)
- 클라이언트(client/) 수정 시: chrome-devtools-mcp로 게임을 실제 실행해
  스크린샷 + 콘솔 에러 0건 확인 후 PR
- 모든 변경은 PR로만. main 직접 push 금지

## 아키텍처 요약
- client/  : Phaser 3 + Tiled 맵 (Vite 빌드)
- server/  : Colyseus 룸 서버 (TypeScript)
- shared/  : 클라이언트-서버 공유 타입
```

### 5-2. `.github/workflows/ci.yml` (스케치)

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v4
        with: { node-version-file: '.nvmrc' }
      - run: npm ci
      - run: npm run lint && npm run typecheck
      - run: npm run test          # Colyseus 룸 로직 유닛 테스트
      - run: npm run validate:maps # Tiled 맵 JSON 검증
      - run: npm run build         # client + server 빌드

  preview:                          # PR 프리뷰 배포
    if: github.event_name == 'pull_request'
    needs: verify
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      # → Vercel/Cloudflare Pages 등에 프리뷰 배포,
      #   PR 코멘트로 플레이 가능한 URL 자동 게시

  deploy:                           # main 병합 시 자동 배포
    if: github.ref == 'refs/heads/main'
    needs: verify
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      # → 프로덕션 배포 + 배포 태그 기록 (롤백용)
```

### 5-3. 브랜치 보호 (main)

- CI `verify` 통과 필수
- main 직접 push 금지 (관리자 포함)
- `CODEOWNERS`: ⛔ 영역(auth, 배포 설정)은 개발자 승인 필수 — 나머지는 승인 불요

### 5-4. 에이전트 환경 (직원 1명당)

- Claude Code + superpowers 플러그인 설치
- chrome-devtools-mcp 등록 (`--isolated` 모드: 임시 프로필로 실행)
- 실행 위치: 초기엔 GitHub Codespaces 또는 Claude Code 클라우드 (셀프호스팅 샌드박스는 보류)

### 5-5. 롤백 절차

- 배포마다 Git 태그 + 이전 빌드 아티팩트 보관
- `workflow_dispatch`로 "특정 태그로 재배포" 워크플로우 1개 → 누구나 5분 내 롤백 가능

---

## 6. 도입 로드맵

### Phase 1 — 기반 (1~2주)
- [ ] CI 워크플로우 + 브랜치 보호 세팅 (개발자 작업)
- [ ] `CLAUDE.md` 작성, ⛔ 금지 영역 CODEOWNERS 지정
- [ ] Tiled 맵 검증 스크립트 (`validate:maps`) 작성
- [ ] Colyseus 룸 로직 핵심 경로에 유닛 테스트 확보 (자동 배포의 전제조건)

### Phase 2 — 파일럿 (2~4주)
- [ ] 비개발자 1~2명 선정, 에이전트 환경 세팅 + 온보딩
- [ ] 🟢 낮은 위험 작업(맵/에셋)부터 시작 → 프리뷰 확인 → 병합 경험
- [ ] 문제 사례를 `CLAUDE.md` 규칙에 반영 (규칙은 사고에서 배운다)

### Phase 3 — 확대 (1~2개월 후)
- [ ] 🟡 클라이언트 기능 작업으로 범위 확대
- [ ] 배포 후 에러율 모니터링 + 자동 롤백 검토
- [ ] 참여 인원 확대. 규모가 커지면 셀프호스팅 샌드박스(CubeSandbox 등) 재검토

---

## 7. 열린 결정 사항 (팀 논의 필요)

1. **프리뷰 배포 대상** — 클라이언트만? Colyseus 서버까지 PR별로 띄울지? (서버 프리뷰는 인프라 비용 ↑)
2. **에이전트 실행 환경** — 직원 로컬 vs Codespaces vs Claude Code 클라우드 (권장: 클라우드, 로컬 환경 편차 제거)
3. **비용** — AI 에이전트 사용량 한도, 프리뷰 환경 비용 상한
4. **모니터링** — 배포 후 에러 감지를 뭘로 할지 (Sentry 등 기존 스택 확인 필요)
