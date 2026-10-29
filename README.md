# Peek

opencode 에서 **이미지를 못 읽는(텍스트 전용) 모델**을 쓰고 있을 때, 붙여넣은 클립보드 이미지를 **이미지를 읽을 수 있는(vision) 서브에이전트**에게 넘겨 주는 플러그인입니다. 메인 모델 대신 vision 서브에이전트가 이미지를 "들여다본다(peek)"는 뜻에서 이름을 Peek 이라고 지었습니다. 저장소와 패키지 이름은 `opencode-peek`, 지금 버전은 **0.2.0** 입니다(변경 내용은 [CHANGELOG.md](./CHANGELOG.md)).

opencode **1.x**(npm `opencode-ai`, `@opencode-ai/plugin` v1 훅 API)용입니다. **1.18.33** 과 **1.19.5** 에서 확인했습니다. opencode V2(`@opencode/plugin` 2.x)는 플러그인 API 가 달라서 지원하지 않습니다.

- **언제 동작하나**: 메인 모델이 이미지 입력을 지원하지 않고, 이미지를 지원하는 서브에이전트가 하나 이상 있을 때만 동작합니다.
- **무엇을 하나**: 붙여넣은 이미지를 임시 폴더에 파일로 저장하고, 메시지에서 이미지를 빼고, 메인 모델에게 "`task` 도구로 vision 서브에이전트를 부르면서 프롬프트에 `@<파일 경로>` 를 적어라"는 안내를 붙입니다. opencode 가 그 파일을 서브에이전트 메시지에 첨부하므로 서브에이전트가 실제 이미지를 봅니다.
- **동작하지 않을 때**: 메인 모델이 이미지를 지원하거나, 이미지를 지원하는 서브에이전트가 없거나, 지금 에이전트가 서브에이전트를 부를 수 없으면(`task` 권한 `deny`) 메시지를 전혀 건드리지 않습니다. 사용하는 사람마다 환경이 다르므로, 넘겨줄 곳이 없으면 opencode 의 원래 동작을 그대로 둡니다.

이 플러그인은 네트워크 호출을 하지 않고, 런타임 의존성도 없습니다. 디스크에는 붙여넣은 이미지만 임시 폴더에 씁니다.

## 빠른 시작

1. 저장소를 받아서 그 폴더 안에서 아래 명령을 실행합니다.

   ```sh
   git clone <이 저장소 주소> opencode-peek
   cd opencode-peek
   opencode plugin -g "$(pwd)"
   ```

   이 명령이 전역 설정 파일(`~/.config/opencode/opencode.json` 또는 `opencode.jsonc`, 없으면 새로 만듦)의 `plugin` 목록에 이 폴더의 **절대 경로**를 넣습니다(`$(pwd)` 가 지금 폴더의 절대 경로로 바뀝니다). 경로를 주면 npm 을 쓰지 않고 설정 파일만 고칩니다. 경로를 직접 적을 때도 꼭 절대 경로로 주세요. 상대 경로는 다른 폴더에서 깨집니다.

2. **vision 서브에이전트를 설정합니다.** 이미 있으면 건너뜁니다. 없으면 Peek 은 아무 일도 하지 않습니다. 아래 [vision 서브에이전트 설정](#vision-서브에이전트-설정)을 보세요.

3. opencode 를 완전히 껐다가 다시 켭니다. 플러그인과 설정은 시작할 때 읽습니다.

4. 텍스트 전용 모델을 고른 상태에서 이미지를 붙여넣고 "이 이미지에 뭐가 있어?" 라고 물어봅니다. 메인 모델이 vision 서브에이전트를 부르고 그 결과로 답하면 정상입니다.

## 요구 사항

- opencode 1.x (npm `opencode-ai`). 1.18.33, 1.19.5 에서 확인.
- 이미지 입력을 지원하는 모델을 쓰는 서브에이전트 1개 이상.
- 메인 모델이 도구 호출(`task`)을 할 수 있어야 합니다.
- 빌드 단계 없음: opencode 가 `.ts` 소스를 그대로 불러옵니다.

## vision 서브에이전트 설정

Peek 이 "이미지를 볼 수 있는 서브에이전트"로 인정하는 조건은 셋입니다.

1. 에이전트의 `mode` 가 `primary` 가 아님 (`subagent` 또는 `all`)
2. 에이전트에 `model` 이 지정되어 있음
3. 그 모델이 opencode 모델 정보에서 이미지 입력을 지원함

전역 설정(`~/.config/opencode/opencode.json(c)`)이나 프로젝트의 `opencode.json` 에 추가합니다. `model` 에는 사내에서 쓸 수 있는 vision 모델을 적으세요.

```jsonc
{
  "agent": {
    "vision": {
      "mode": "subagent",
      "model": "<provider>/<vision 모델>",
      "description": "Looks at images and describes them"
    }
  }
}
```

**직접 정의한 provider(사내 게이트웨이, 로컬 서버, OpenAI 호환 서버 등)** 는 모델 정의에 이미지 입력을 적어야 opencode 가 이미지 지원 모델로 압니다. 메인 텍스트 모델에는 `image` 를 넣지 마세요.

```jsonc
{
  "provider": {
    "internal": {
      "npm": "@ai-sdk/openai-compatible",
      "options": { "baseURL": "https://<사내 게이트웨이>/v1" },
      "models": {
        "text-model":   { "modalities": { "input": ["text"],          "output": ["text"] }, "tool_call": true },
        "vision-model": { "modalities": { "input": ["text", "image"], "output": ["text"] }, "attachment": true, "tool_call": true }
      }
    }
  },
  "model": "internal/text-model",
  "agent": {
    "vision": { "mode": "subagent", "model": "internal/vision-model", "description": "Looks at images" }
  }
}
```

## 옵션

조건에 맞는 서브에이전트가 여러 개면 목록의 첫 번째를 씁니다. 특정 에이전트를 쓰게 하려면 `plugin` 항목을 `[경로, 옵션]` 형태로 바꿉니다.

```jsonc
{
  "plugin": [
    ["/절대/경로/opencode-peek", { "agent": "vision" }]
  ]
}
```

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `agent` | (없음) | 이미지를 넘길 서브에이전트 이름. 그 에이전트가 위 조건에 맞지 않으면 무시하고 첫 번째 vision 서브에이전트를 씁니다 |

## 동작 방식

메시지를 보낼 때마다 `chat.message` 훅에서 아래 순서로 판단합니다.

| 단계 | 조건 | 결과 |
|---|---|---|
| 1 | 붙여넣은 이미지(`data:` URL 첨부)가 없음 | 아무것도 안 함 |
| 2 | 메인 모델이 이미지 입력을 지원함 | 아무것도 안 함 |
| 3 | 지금 에이전트의 `task` 권한이 `deny` (서브에이전트를 못 부름) | 아무것도 안 함 (opencode 원래 동작) |
| 4 | 이미지를 지원하는 서브에이전트가 없음 | 아무것도 안 함 (opencode 원래 동작) |
| 5 | 그 밖의 경우 | 이미지를 `<임시 폴더>/opencode-peek/<sha256 앞 16자>.<확장자>` 로 저장(png/jpg/gif/webp), 메시지에서 이미지 첨부를 빼고 안내 문구를 붙임 |

5단계 뒤에는 메인 모델이 `task` 도구로 서브에이전트를 부르면서 프롬프트에 `@<경로>` 를 적습니다. opencode 가 그 파일을 서브에이전트 메시지에 첨부하고, 서브에이전트의 답(이미지 설명 등)이 메인 모델로 돌아옵니다.

임시 폴더는 운영체제의 기본 임시 폴더입니다(macOS·Linux 는 `$TMPDIR` 또는 `/tmp`, Windows 는 `%TEMP%`). 같은 이미지는 같은 파일 이름이 되므로 중복 저장되지 않습니다.

### 사용 예시

텍스트 전용 모델로 작업하다가 에러 화면을 캡처해 붙여넣고 "이 에러 원인이 뭐야?" 라고 물으면:

1. Peek 이 이미지를 `/tmp/opencode-peek/3f9a…c1.png` 로 저장하고, 메시지에서 이미지를 빼고 안내를 붙입니다.
2. 메인 모델이 `task` 로 `vision` 서브에이전트를 부릅니다. 예: `이 스크린샷의 에러 메시지를 그대로 옮겨 적어줘 @/tmp/opencode-peek/3f9a…c1.png`
3. `vision` 서브에이전트가 이미지를 보고 에러 내용을 글로 돌려줍니다.
4. 메인 모델이 그 글을 바탕으로 원인을 분석해서 답합니다.

## 다른 플러그인과 함께 쓰기

Peek 은 `chat.message` 훅 하나만 쓰고, 붙여넣은 이미지가 있을 때 그 메시지의 이미지 첨부를 빼고 안내 한 줄을 더하는 것 말고는 아무것도 바꾸지 않습니다. 도구, 에이전트, 권한, 시스템 프롬프트는 건드리지 않으므로 다른 플러그인과 함께 설치해도 됩니다. `opencode plugin -g` 는 `plugin` 목록 끝에 추가하므로 기존 플러그인 설정은 그대로입니다.

**project-loom (Loom)**: 함께 설치해서 1.18.33 에서 확인했습니다.

- 쓰레드에서는 일반 세션과 똑같이 동작합니다(이미지 → vision 서브에이전트).
- 프로젝트 채팅(코디네이터)은 서브에이전트(`task`)가 금지되어 있으므로 Peek 이 건너뜁니다. 이미지는 그대로 남고 opencode 원래 동작대로 처리됩니다. 이미지를 보여 줘야 하는 일은 쓰레드에 직접 붙여넣으세요.
- Loom 은 같은 `chat.message` 훅에서 프로젝트 채팅 메시지의 에이전트를 `coordinator` 로 바꿉니다. Peek 이 그 결과를 보도록 `plugin` 목록에서 Loom 을 Peek 보다 앞에 두세요. Loom 을 먼저 설치했다면 자연히 그렇게 됩니다(반대 순서는 확인하지 않았습니다).

**oh-my-opencode 등 에이전트를 추가하는 플러그인**: 실제로 함께 돌려 보지는 않았습니다. 이런 플러그인이 이미지 지원 모델을 쓰는 서브에이전트(예: 이미지·PDF 를 보는 에이전트)를 등록하면 Peek 은 그것도 vision 서브에이전트 후보로 봅니다. 원하는 에이전트가 따로 있으면 [옵션](#옵션)의 `agent` 로 이름을 지정하세요. 메인 에이전트가 `task` 대신 자체 위임 도구만 쓰도록 설정되어 있으면(`task` 권한 `deny`) Peek 은 건너뜁니다.

## 업데이트

받아 둔 폴더에서 `git pull` 한 뒤 opencode 를 다시 켭니다. 설정에는 폴더 경로가 들어 있으므로 명령을 다시 실행할 필요는 없습니다.

## 제거

1. 전역 설정 파일(`~/.config/opencode/opencode.json` 또는 `opencode.jsonc`)의 `plugin` 목록에서 Peek 폴더 경로가 든 줄(옵션을 줬다면 `[경로, {...}]` 항목 전체)을 지웁니다. `opencode plugin` 에는 제거 명령이 없어서 직접 지워야 합니다.
2. opencode 를 다시 켭니다.
3. (선택) 받아 둔 저장소 폴더를 지웁니다.
4. (선택) Peek 때문에 만든 vision 서브에이전트가 더 필요 없으면 `agent` 에서 지웁니다.
5. (선택) 저장된 이미지를 지웁니다.

   ```sh
   rm -rf "${TMPDIR:-/tmp}/opencode-peek"
   ```

## 문제 해결

| 증상 | 확인할 것 |
|---|---|
| 이미지가 그대로 메인 모델에 가고 "이 모델은 이미지를 읽을 수 없다"는 식의 오류가 남 | vision 서브에이전트가 없거나 조건에 안 맞는 것입니다. `mode`, `model` 을 확인하고, 직접 정의한 provider 면 그 모델의 `modalities.input` 에 `image` 가 있는지 보세요 |
| 메인 모델에서도 Peek 이 아무것도 안 함 | 메인 모델이 이미지 지원 모델로 등록되어 있을 수 있습니다. 메인 모델의 `modalities.input` 에 `image` 가 들어 있지 않은지 보세요 |
| 메인 모델이 서브에이전트를 안 부름 | 모델이 도구 호출을 하는지(`tool_call: true`) 확인하세요. 프롬프트에 "vision 에이전트한테 물어봐" 라고 덧붙이면 도움이 됩니다 |
| 서브에이전트가 이미지를 못 봤다고 함 | 메인 모델이 `task` 프롬프트에서 `@경로` 를 빠뜨렸을 수 있습니다. 임시 폴더의 `opencode-peek/` 에 파일이 있는지도 확인하세요 |
| 플러그인이 로드되지 않음 | 설정의 `plugin` 항목이 **절대 경로**인지, 그 폴더에 `package.json` 과 `index.ts` 가 있는지 확인하고 opencode 를 완전히 다시 켜세요. `--pure` 로 켜면 외부 플러그인을 모두 읽지 않으므로 Peek 도 꺼집니다 |

## 알려진 제한

- 서브에이전트 호출은 메인 모델이 결정합니다. Peek 은 안내만 붙이므로, 도구 호출이 약한 모델은 이미지를 넘기지 않을 수 있습니다.
- 붙여넣은 이미지(`data:` URL)만 처리합니다. `@파일경로` 로 첨부한 파일은 건드리지 않습니다.
- 임시 폴더에 저장한 이미지는 자동으로 지우지 않습니다. 운영체제가 정리하거나 위 제거 명령으로 지우세요.
- 이미지 지원 여부는 opencode 모델 정보로 판단합니다. 모델 정보가 틀리면 판단도 틀립니다.

## 개발

```
index.ts               플러그인 전체 (chat.message 훅 하나). default export { id, server }
package.json           opencode 가 경로 플러그인의 엔트리(exports["./server"])를 찾는 데 씀
test/fake-server.mjs   가짜 OpenAI 호환 모델 서버 (포트 18999), 받은 요청을 로그 파일에 기록
test/opencode.json     가짜 서버를 provider 로 쓰는 설정 (text-model 메인, vision-model 서브에이전트)
test/drive.mjs         SDK 로 세션을 만들고 1x1 PNG 를 붙여 프롬프트를 보낸 뒤 메시지를 출력 (node drive.mjs <모델> [에이전트])
```

실제 모델 키 없이 확인하는 방법입니다. `fake-server.mjs` 의 `text-model` 은 프롬프트에서 Peek 이 저장한 이미지 경로를 찾으면 `task` 로 `vision` 을 부르고, `vision-model` 은 이미지를 받았으면 `VISION_SAW_IMAGE` 라고 답합니다.

```sh
# 빈 작업 폴더에 opencode 와 SDK 설치
mkdir -p ~/peek-test && cd ~/peek-test
npm i opencode-ai@<버전> @opencode-ai/sdk@<버전>
cp <저장소>/test/drive.mjs .

# 프로젝트 설정: 가짜 provider + vision 서브에이전트 + Peek
node -e '
const c = require("<저장소>/test/opencode.json")
c.plugin = ["<저장소 절대 경로>"]
require("fs").writeFileSync("opencode.json", JSON.stringify(c, null, 2))'

node <저장소>/test/fake-server.mjs ./requests.log &
npx opencode serve --port 4096 &
node drive.mjs text-model     # vision 서브에이전트가 이미지를 받아야 함 (VISION_SAW_IMAGE)
node drive.mjs vision-model   # Peek 이 아무것도 안 해야 함
cat requests.log
```

확인한 결과(1.18.33, 1.19.5. project-loom 조합은 1.18.33):

| 경우 | 결과 |
|---|---|
| 텍스트 메인 모델 + vision 서브에이전트 | 이미지 파일 저장, 메시지에서 이미지 제거·안내 추가, 메인 모델 요청에 이미지 없음. 메인 모델이 `task` 를 `@경로` 로 부르면 서브에이전트 요청에 이미지(`image_url`)가 들어가고 결과가 메인 모델로 돌아옴 |
| vision 메인 모델 | 메시지 그대로, 파일 저장 없음 |
| vision 서브에이전트 없음 | 메시지 그대로(이미지 첨부 유지), 파일 저장 없음. opencode 가 원래대로 "이 모델은 이미지를 읽을 수 없음" 안내를 넣음 |
| `{ "agent": "vision2" }` 옵션, vision 서브에이전트 2개 | 안내에 `vision2` 가 지정됨 |
| `task` 권한이 `deny` 인 primary 에이전트 | 메시지 그대로, 파일 저장 없음 |
| project-loom 과 함께 설치, 일반 세션 | 첫 번째 경우와 같음 |
| project-loom 과 함께 설치, `coordinator` 에이전트 | 메시지 그대로, 파일 저장 없음 |
| `opencode plugin -g "$(pwd)"` | 전역 설정의 `plugin` 에 절대 경로가 들어가고 위 동작이 그대로 됨 |

## 라이선스

[MIT](./LICENSE)
