# feed-prototype

`feed-prototype`은 Vite + React + TypeScript 기반의 Instagram-like local/general feed prototype입니다.

이 app은 두 가지 data source mode를 지원합니다.

- `mock`: frontend mock JSON과 localStorage overlay를 사용합니다.
- `api`: FastAPI backend와 PostgreSQL DB를 사용합니다.

## 실행

Frontend 개발 서버:

```bash
npm run dev
```

Build 확인:

```bash
npm run build
```

## Backend

Backend는 `backend/` 아래에 있습니다.

자세한 backend 설정, migration, seed, 실행 방법은 아래 문서를 참고합니다.

```text
backend/README.md
```

## MVP10 External Post Import

MVP10은 외부 프로그램이 만든 JSON 기반 post package를 backend DB에 import하는 기능입니다.

관련 문서:

```text
data/external_posts/README.md
docs/MVP10_EXTERNAL_POST_FORMAT.md
docs/MVP10_TEST_PROCEDURE.md
```

MVP10은 asset 파일을 자동 복사하지 않습니다. JSON에는 UI에서 접근 가능한 asset URL/path만 저장합니다.
