import http from "node:http"
import fs from "node:fs"
const LOG = process.argv[2]
let n = 0
const sse = (res, chunks) => {
  res.writeHead(200, { "content-type": "text/event-stream" })
  for (const c of chunks) res.write(`data: ${JSON.stringify(c)}\n\n`)
  res.end("data: [DONE]\n\n")
}
const chunk = (model, delta, finish = null) => ({ id: "c" + n, object: "chat.completion.chunk", created: 1, model, choices: [{ index: 0, delta, finish_reason: finish }] })
http.createServer((req, res) => {
  let body = ""
  req.on("data", (d) => (body += d))
  req.on("end", () => {
    n++
    const j = JSON.parse(body || "{}")
    const msgs = j.messages ?? []
    const flat = JSON.stringify(msgs)
    const hasImage = flat.includes('"image_url"') || flat.includes("data:image")
    const pathMatch = flat.match(/\/[^"\\\s`]*opencode-peek\/[0-9a-f]{16}\.png/)
    const task = (j.tools ?? []).find((t) => t.function?.name === "task")
    const last = msgs[msgs.length - 1]
    const entry = { n, model: j.model, stream: j.stream, hasImage, path: pathMatch?.[0] ?? null, lastRole: last?.role,
      taskParams: task ? Object.keys(task.function.parameters?.properties ?? {}) : null, nTools: (j.tools ?? []).length,
      userTexts: msgs.filter((m) => m.role === "user").map((m) => typeof m.content === "string" ? m.content.slice(0, 300) : m.content.map((c) => c.type === "text" ? c.text.slice(0, 300) : c.type)) }
    fs.appendFileSync(LOG, JSON.stringify(entry) + "\n")
    const model = j.model
    if (model === "text-model" && pathMatch && task && last?.role !== "tool") {
      const args = JSON.stringify({ description: "describe image", prompt: `Describe this image @${pathMatch[0]}`, subagent_type: "vision" })
      return sse(res, [chunk(model, { role: "assistant", tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "task", arguments: args } }] }), chunk(model, {}, "tool_calls")])
    }
    const text = model === "vision-model" ? (hasImage ? "VISION_SAW_IMAGE" : "VISION_NO_IMAGE") : "OK"
    sse(res, [chunk(model, { role: "assistant", content: text }), chunk(model, {}, "stop")])
  })
}).listen(18999, () => console.log("fake on 18999"))
