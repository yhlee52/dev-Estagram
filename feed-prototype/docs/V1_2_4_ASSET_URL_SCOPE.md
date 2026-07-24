# v1.2.4 Scope — S3 asset URL 서빙 (v1.2.x)

> 상태: **구현 완료(코드), 라이브 확인은 최종 패스로 이연.** S3에 저장된 자산을
> 브라우저가 볼 수 있도록 backend proxy + serializer 절대 URL을 붙인다. 이로써
> v1.2.x의 마지막 "기능" 단계(다음 v1.2.5는 wrap-up)이다.

## Goals

1. **asset proxy endpoint** — `GET /api/assets/{asset_id}` (`app/api/routes/assets.py`).
   S3-backed 자산만 대상으로 object를 S3/MinIO에서 스트리밍(private bucket 지원,
   presigned 만료 무관). 비-S3 자산은 404(각자 원래 url 사용).
2. **serializer 절대 URL** — `app/services/asset_url.py::serialize_asset`. S3 자산의
   `url`/`src`를 `{ASSET_PROXY_BASE_URL}/api/assets/{id}` 로 변환. DB에는 여전히
   object identity만(v1.2.1). 6개 직렬화 지점(feed/posts×2/accounts/bookmarks/
   notifications)을 이 헬퍼로 교체.
3. **config** — `ASSET_PROXY_BASE_URL`(기본 `http://127.0.0.1:8000`). frontend가
   저장된 url을 API base 접두 없이 그대로 `<img src>`로 쓰므로 backend가 절대 URL을
   내보내야 한다.
4. **문서** — `docs/S3_INGESTION_ARCHITECTURE.md`(Mermaid sequence·state diagram +
   전체 아키텍처/보안/URL 정책).

## Non-goals

- frontend 코드 변경 (절대 proxy URL이면 기존 렌더가 그대로 동작 → **변경 없음**)
- presigned URL 방식(대안으로만 문서화; 기본은 proxy 스트리밍)
- 이미지 리사이즈/썸네일/캐싱 정책(후속 후보)
- S3 객체 변경

## 설계 근거

- **proxy 스트리밍** 선택: private bucket 지원 + presigned 만료 문제 없음 +
  frontend 무변경(이미 backend origin과 통신). 회사 내부 S3 endpoint를 브라우저에
  노출하지 않아도 됨.
- **object identity를 DB에 저장, URL은 응답 시 생성**: 만료되는 값을 영구 저장하지
  않는다는 §14 요건 충족.

## 검증 (scripts/check_asset_url.py, DB/MinIO 불필요)

- `s3_asset_proxy_url` 순수 로직(s3 → URL, 비-s3/누락 → None, base 슬래시 정규화)
- `serialize_asset`: S3 자산 → 절대 proxy URL(url·src), object identity는 read 모델에
  노출 안 됨
- 비-S3/원격 자산 → url 그대로 유지(회귀)

라우터 등록 import-smoke로 `/api/assets/{id}` 등록 확인. 실제 스트리밍은
`docs/MINIO_LOCAL_DEV.md` 최종 e2e에서 확인.

## 호환성

- **frontend 변경 없음.** 기존 로컬(`/assets/...`)·원격(`http(s)://`) 자산 무변경.
- DB/모델/migration 변경 없음(identity 컬럼은 v1.2.1). `/api/imports` 무영향.
