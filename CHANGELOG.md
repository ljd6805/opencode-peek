# Changelog

## 0.2.0 (2026-10-29)

- 설치를 `opencode plugin -g "$(pwd)"` 한 줄로 바꿈. 저장소 폴더를 경로 플러그인으로 등록합니다(`package.json` + `index.ts`, default export `{ id, server }`).
- 이미지를 지원하는 서브에이전트가 없으면 메시지를 건드리지 않음(이전에는 이미지를 빼고 "서브에이전트가 없다"는 안내를 붙였음).
- `agent` 옵션 문서화: `["<경로>", { "agent": "<이름>" }]`.
- 지금 에이전트가 서브에이전트를 부를 수 없으면(`task` 권한 `deny`, 예: project-loom 코디네이터) 메시지를 건드리지 않음.
- 임시 폴더 이름을 `opencode-peek` 로 바꿈.
- opencode 1.18.33 에서도 확인. project-loom 과 함께 설치해서 확인.

## 0.1.0 (2026-10-29)

- 첫 버전. 텍스트 전용 메인 모델에 붙여넣은 이미지를 vision 서브에이전트로 넘김. opencode 1.19.5 에서 확인.
