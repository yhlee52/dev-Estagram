# managed_copy_sample assets

이 폴더는 `managed_copy_sample/feed_posts.json`이 참조하는 asset 파일 위치를
설명합니다. v0.3.3 **asset managed storage 복사(opt-in)** 의 회귀/데모용 sample입니다.

- `sample_managed.svg`는 `feed_posts.json`이 **상대 로컬 경로**(`assets/sample_managed.svg`)로
  참조하는 작은 텍스트성(SVG) asset입니다. binary를 repo에 넣지 않으려고 SVG를 씁니다.
- `MANAGE_ASSET_STORAGE=true`로 import하면 이 파일이 `feed-prototype/public/assets/managed/`
  아래로 **복사**되고, DB에 저장되는 url이 `/assets/managed/...`로 재작성됩니다.
- 토글이 꺼져 있으면(기본) 복사하지 않고 상대 경로를 그대로 저장합니다(종전 동작).
- 두 번째 asset(`/assets/generated/...`)은 이미 서빙되는 URL이라 토글과 무관하게
  **건드리지 않습니다**(format freeze / 하위호환). 해당 파일은 의도적으로 두지 않아
  viewer fallback 확인에도 쓰입니다.
- 상세는 `feed-prototype/docs/V0_3_3_ASSET_STORAGE_SCOPE.md` 참고.

참조 경로:

```text
assets/sample_managed.svg            (상대 로컬 → opt-in 시 복사 대상)
/assets/generated/missing_managed_sample.png   (서빙 URL → 무손상)
```
