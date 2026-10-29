# peek (opencode-peek)

> 텍스트 모델 대신 vision 서브에이전트가 이미지를 슬쩍 "들여다봐(peek)" 주는 opencode 플러그인.

[opencode](https://opencode.ai)에서 **이미지를 못 읽는(text-only) 모델**을 메인으로 쓰고 있을 때, 프롬프트에 붙여넣은 클립보드 이미지를 **이미지를 읽을 수 있는(vision) 서브에이전트**에게 자동으로 넘겨주는 플러그인입니다.

> English summary at the [bottom](#english).

---

## 왜 필요한가요?

opencode에서 이미지를 붙여넣으면(`Ctrl+V`) 이미지는 메시지에 첨부 파일로 들어갑니다. 그런데 메인 모델이 텍스트만 받는 모델(예: 일부 로컬 모델, 코딩 특화 모델)이면:

- 이미지가 모델에 전달되지 않거나 요청이 실패하고,
- 서브에이전트에게 일을 맡기더라도 서브에이전트는 텍스트 프롬프트만 받기 때문에 **이미지가 사라집니다.**

이 플러그인은 붙여넣은 이미지를 디스크에 저장하고, 메인 모델에게 "이 경로의 이미지를 vision 서브에이전트에게 `@경로`로 넘겨라"라고 알려줍니다. 그러면 메인 모델은 텍스트 모델 그대로 쓰면서도, 이미지 분석은 vision 모델이 맡게 됩니다.

## 동작 방식

1. 사용자가 메시지를 보내면 플러그인이 `chat.message` 훅에서 메시지를 검사합니다.
2. `data:` URL 형태의 이미지 첨부(붙여넣은 이미지)가 없으면 아무것도 하지 않습니다.
3. **메인 모델이 이미지 입력을 지원하면 아무것도 하지 않습니다.** (모델 메타데이터의 image input capability로 판단)
4. 지원하지 않으면:
   - 이미지를 `$TMPDIR/opencode-peek/<sha256 앞 16자>.<확장자>` 로 저장합니다. (png / jpg / gif / webp)
   - 메시지에서 이미지 첨부를 제거합니다. (텍스트 모델에 이미지가 가지 않도록)
   - 메시지에 안내 문구를 추가합니다: 이미지 저장 경로, 그리고 `task` 도구로 vision 서브에이전트를 부르면서 프롬프트에 `@<경로>`를 적으라는 내용.
5. 메인 모델이 `task` 도구로 서브에이전트를 호출하며 `@<경로>`를 쓰면, opencode가 그 파일을 서브에이전트 메시지에 첨부하고, vision 모델이 실제 이미지를 보게 됩니다.
6. 서브에이전트의 결과(이미지 설명 등)가 메인 모델에게 돌아옵니다.

어떤 서브에이전트를 쓸지는 자동으로 고릅니다: `mode`가 `primary`가 아니고, 모델이 지정되어 있고, 그 모델이 이미지 입력을 지원하는 에이전트 중 **첫 번째**입니다. 그런 에이전트가 없으면 안내 문구에 "이미지를 볼 수 있는 서브에이전트가 없으니 사용자에게 알려라"라고 적습니다.

## 요구 사항

- opencode **1.19.x** (`opencode-ai` npm 패키지 계열). 1.19.5에서 테스트했습니다.
- 이미지 입력을 지원하는 모델을 쓰는 서브에이전트 1개 이상.

> opencode 2.x(`@opencode/cli`)는 플러그인 API가 달라서 이 플러그인이 동작하지 않습니다.

## 설치

### 1. 플러그인 파일 복사

모든 프로젝트에 적용하려면:

```sh
mkdir -p ~/.config/opencode/plugin
curl -fsSL -o ~/.config/opencode/plugin/peek.ts \
  https://raw.githubusercontent.com/ljd6805/opencode-peek/main/peek.ts
```

특정 프로젝트에만 적용하려면 그 프로젝트의 `.opencode/plugin/` 폴더에 넣으세요:

```sh
mkdir -p .opencode/plugin
cp peek.ts .opencode/plugin/
```

opencode가 이 폴더의 `.ts` 파일을 자동으로 불러옵니다. 별도 빌드나 `npm install`은 필요 없습니다.

### 2. vision 서브에이전트 추가

`~/.config/opencode/opencode.json`(전역) 또는 프로젝트의 `opencode.json`에 이미지를 볼 수 있는 모델을 쓰는 서브에이전트를 추가합니다:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "vision": {
      "mode": "subagent",
      "model": "anthropic/claude-sonnet-4-5",
      "description": "Looks at images and describes them"
    }
  }
}
```

`model`은 이미지 입력을 지원하는 모델이면 무엇이든 됩니다(예: `openai/gpt-4o`, `google/gemini-2.5-flash`).

**직접 정의한 provider(로컬 서버, OpenAI 호환 서버 등)를 쓰는 경우**, 모델 정의에 이미지 입력을 명시해야 플러그인이 vision 모델로 인식합니다:

```json
{
  "provider": {
    "myprovider": {
      "npm": "@ai-sdk/openai-compatible",
      "options": { "baseURL": "http://localhost:8000/v1" },
      "models": {
        "my-text-model":   { "modalities": { "input": ["text"],          "output": ["text"] }, "tool_call": true },
        "my-vision-model": { "modalities": { "input": ["text", "image"], "output": ["text"] }, "attachment": true, "tool_call": true }
      }
    }
  },
  "model": "myprovider/my-text-model",
  "agent": {
    "vision": { "mode": "subagent", "model": "myprovider/my-vision-model", "description": "Looks at images" }
  }
}
```

### 3. opencode 재시작

opencode를 완전히 종료했다가 다시 실행하세요. 플러그인과 설정은 시작할 때 읽힙니다.

### 4. 확인

텍스트 전용 모델을 선택한 상태에서 이미지를 붙여넣고 "이 이미지에 뭐가 있어?"라고 물어보세요. 메인 모델이 `vision` 서브에이전트를 호출하고, 그 결과로 답하면 정상입니다. `$TMPDIR/opencode-peek/`(macOS/Linux에서는 보통 `/tmp/opencode-peek/` 또는 `$TMPDIR` 아래)에 이미지 파일이 생깁니다.

## 사용 예시

텍스트 전용 모델로 작업 중에 에러 화면을 캡처해서 붙여넣고 "이 에러 원인이 뭐야?"라고 물으면 대략 이렇게 진행됩니다.

1. peek가 이미지를 `$TMPDIR/opencode-peek/3f9a...c1.png`로 저장하고, 메시지에서 이미지를 빼고 안내 문구를 붙입니다.
2. 메인 모델이 `task` 도구로 `vision` 서브에이전트를 부릅니다. 프롬프트 예: `이 스크린샷의 에러 메시지를 그대로 옮겨 적어줘 @/tmp/opencode-peek/3f9a...c1.png`
3. `vision` 서브에이전트가 이미지를 보고 에러 내용을 텍스트로 돌려줍니다.
4. 메인 모델이 그 텍스트를 바탕으로 원인을 분석해서 답합니다.

## 문제 해결

| 증상 | 확인할 것 |
| --- | --- |
| 아무 일도 안 일어나고 이미지가 그대로 모델에 감 | 메인 모델이 이미지 지원 모델로 인식되고 있을 수 있습니다. 커스텀 provider라면 `modalities.input`에 `image`가 빠져 있는지 확인하세요. |
| "이미지를 볼 수 있는 서브에이전트가 없다"는 답이 옴 | `opencode.json`에 `mode: "subagent"`이고 이미지 지원 모델을 쓰는 에이전트가 있는지, 커스텀 provider라면 그 모델의 `modalities.input`에 `image`가 있는지 확인하세요. |
| 메인 모델이 서브에이전트를 안 부름 | 모델이 도구 호출을 지원하는지(`tool_call: true`) 확인하세요. 프롬프트에 "vision 에이전트한테 물어봐"라고 덧붙이면 도움이 됩니다. |
| 서브에이전트가 이미지를 못 봤다고 함 | 메인 모델이 `task` 프롬프트에 `@경로`를 빠뜨렸을 수 있습니다. 저장된 파일이 `$TMPDIR/opencode-peek/`에 있는지도 확인하세요. |
| 플러그인이 로드되지 않음 | 파일 위치(`~/.config/opencode/plugin/peek.ts`)와 opencode 버전(1.19.x)을 확인하고 opencode를 완전히 재시작하세요. |

## 제거

1. 플러그인 파일을 지웁니다:

   ```sh
   rm ~/.config/opencode/plugin/peek.ts
   # 프로젝트 단위로 설치했다면
   rm .opencode/plugin/peek.ts
   ```

2. (선택) 이 플러그인 때문에 추가한 `vision` 서브에이전트가 더 필요 없으면 `opencode.json`의 `agent.vision` 항목을 지웁니다.
3. (선택) 저장된 이미지들을 지웁니다:

   ```sh
   rm -rf "${TMPDIR:-/tmp}/opencode-peek"
   ```

4. opencode를 재시작합니다.

## 제한 사항 / 알아둘 점

- **메인 모델이 `task` 도구를 써야 합니다.** 플러그인은 안내 문구만 넣을 뿐, 서브에이전트 호출 여부는 메인 모델이 결정합니다. 도구 호출을 잘 못하는 모델이면 이미지를 넘기지 않을 수 있습니다.
- **붙여넣은 이미지(`data:` URL)만 처리합니다.** `@파일경로`로 직접 첨부한 이미지 파일 등 다른 형태는 건드리지 않습니다.
- **임시 폴더에 이미지가 남습니다.** 같은 이미지는 해시 기반 파일명이라 중복 저장되지 않지만, 자동 삭제는 하지 않습니다. OS가 임시 폴더를 정리하거나, 위의 제거 명령으로 직접 지우세요.
- vision 서브에이전트가 여러 개면 목록상 첫 번째가 선택됩니다. 코드에는 `agent` 플러그인 옵션으로 원하는 에이전트 이름을 지정하는 기능이 있지만, 파일로 설치한 플러그인에 옵션을 넘기는 방법은 테스트하지 않았습니다. 확실하게 하려면 vision 서브에이전트를 하나만 두세요.
- 메인 모델이 이미지를 지원하는지는 opencode의 모델 메타데이터로 판단합니다. 메타데이터가 잘못되어 있으면(예: 커스텀 provider에 `modalities`를 안 적은 경우) 판단이 틀릴 수 있습니다.
- opencode 1.19.5에서만 테스트했습니다. 다른 버전에서는 플러그인 API 차이로 동작하지 않을 수 있습니다.

## 테스트

`test/` 폴더에는 실제 모델 API 없이 동작을 확인하는 도구가 있습니다.

- `test/fake-server.mjs` — 가짜 OpenAI 호환 서버(포트 18999). 요청 내용을 로그 파일에 기록합니다. `text-model`은 프롬프트에서 이미지 경로를 찾으면 `task` 도구로 `vision`을 호출하고, `vision-model`은 이미지를 받았으면 `VISION_SAW_IMAGE`라고 답합니다.
- `test/opencode.json` — 가짜 서버를 provider로 쓰는 opencode 설정 (`text-model`이 메인, `vision-model`을 쓰는 `vision` 서브에이전트).
- `test/drive.mjs` — `@opencode-ai/sdk`로 세션을 만들고 1x1 PNG를 첨부해 프롬프트를 보낸 뒤, 결과 메시지를 출력합니다.

실행 예시:

```sh
mkdir -p /tmp/octest/.opencode/plugin && cd /tmp/octest
cp /path/to/repo/peek.ts .opencode/plugin/
cp /path/to/repo/test/opencode.json ./opencode.json
npm i @opencode-ai/sdk opencode-ai@1.19.5

node /path/to/repo/test/fake-server.mjs /tmp/octest/requests.log &   # 가짜 모델 서버
npx opencode serve --port 4096 &                                      # opencode 서버
node /path/to/repo/test/drive.mjs text-model     # 텍스트 모델: vision 서브에이전트로 넘어가야 함
node /path/to/repo/test/drive.mjs vision-model   # vision 모델: 플러그인이 아무것도 안 해야 함
cat /tmp/octest/requests.log
```

1.19.5에서 확인한 결과:

- 텍스트 메인 모델: 이미지 파일이 저장되고, 저장된 메시지에서 이미지 첨부가 제거되고, 안내 문구가 추가되며, 메인 모델 요청에는 이미지가 없음.
- 메인 모델이 `task`를 `@경로`와 함께 호출 → `vision` 서브에이전트 요청에 이미지(`image_url`)가 들어 있고, 결과가 메인 모델로 돌아옴.
- vision 메인 모델: 메시지 그대로, 파일 저장 없음.

## 라이선스

[MIT](LICENSE)

---

## English

**peek** (`opencode-peek`) is an opencode (1.19.x) plugin. When the main model is text-only, images pasted into the prompt are saved to `$TMPDIR/opencode-peek/<hash>.<ext>`, removed from the message, and replaced with a note telling the model to delegate image work via the `task` tool to a vision-capable subagent, writing each path as `@<path>` so opencode attaches the file. If the main model supports image input, the plugin does nothing.

**Install:** copy `peek.ts` to `~/.config/opencode/plugin/` (or `<project>/.opencode/plugin/`), define a subagent whose model supports images in `opencode.json` (see the `vision` example above; for custom providers declare `"modalities": {"input": ["text","image"], "output": ["text"]}`), then restart opencode.

**Uninstall:** delete the plugin file, optionally remove the `vision` agent and `$TMPDIR/opencode-peek/`, restart opencode.

**Limitations:** relies on the main model actually calling `task`; only handles pasted (`data:` URL) images; saved images are not cleaned up automatically; first vision subagent wins; tested on opencode 1.19.5 only (not compatible with the 2.x `@opencode/cli` line).
