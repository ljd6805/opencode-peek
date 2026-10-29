import { createOpencodeClient } from "@opencode-ai/sdk"
const c = createOpencodeClient({ baseUrl: "http://127.0.0.1:4096" })
const modelID = process.argv[2] ?? "text-model"
// 1x1 red PNG
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC"
const s = (await c.session.create({ body: { title: "t" } })).data
const agent = process.argv[3]
const r = await c.session.prompt({ path: { id: s.id }, body: { model: { providerID: "fake", modelID }, ...(agent && { agent }),
  parts: [{ type: "text", text: "What is in this image?" }, { type: "file", mime: "image/png", filename: "clipboard.png", url: `data:image/png;base64,${png}` }] } })
if (r.error) console.log("ERR", JSON.stringify(r.error))
const msgs = (await c.session.messages({ path: { id: s.id } })).data
for (const m of msgs) {
  console.log("==", m.info.role, m.info.agent ?? m.info.mode, m.info.modelID ?? m.info.model?.modelID)
  for (const p of m.parts) console.log("  -", p.type, p.synthetic ? "(synthetic)" : "", p.type === "text" ? JSON.stringify(p.text.slice(0, 400)) : p.type === "file" ? `${p.mime} ${p.url.slice(0, 40)}` : p.type === "tool" ? `${p.tool} ${p.state.status} ${JSON.stringify(p.state.output ?? "").slice(0, 200)}` : "")
}
