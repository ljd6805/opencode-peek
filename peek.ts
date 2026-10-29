import type { Plugin } from "@opencode-ai/plugin"
import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" }

export const PeekPlugin: Plugin = async ({ client }, options) => {
  const dir = join(tmpdir(), "opencode-peek")
  const preferred = typeof options?.agent === "string" ? options.agent : undefined

  const supportsImage = async (providerID: string, modelID: string) => {
    const res = await client.config.providers().catch(() => undefined)
    const model = res?.data?.providers.find((p) => p.id === providerID)?.models[modelID]
    return model?.capabilities?.input?.image ?? false
  }

  const visionAgents = async () => {
    const res = await client.app.agents().catch(() => undefined)
    const out: string[] = []
    for (const a of res?.data ?? []) {
      if (a.mode === "primary" || !a.model) continue
      if (await supportsImage(a.model.providerID, a.model.modelID)) out.push(a.name)
    }
    return out
  }

  return {
    "chat.message": async (input, output) => {
      const images = output.parts.filter(
        (p) => p.type === "file" && p.mime.startsWith("image/") && p.url.startsWith("data:"),
      )
      if (images.length === 0) return
      const model = input.model ?? output.message.model
      if (model && (await supportsImage(model.providerID, model.modelID))) return

      await mkdir(dir, { recursive: true })
      const paths: string[] = []
      for (const part of images) {
        if (part.type !== "file") continue
        const bytes = Buffer.from(part.url.slice(part.url.indexOf(",") + 1), "base64")
        const name = createHash("sha256").update(bytes).digest("hex").slice(0, 16)
        const file = join(dir, `${name}.${EXT[part.mime] ?? "png"}`)
        await writeFile(file, bytes)
        paths.push(file)
      }
      // opencode keeps its own reference to this array, so mutate it in place
      for (let i = output.parts.length - 1; i >= 0; i--) if (images.includes(output.parts[i])) output.parts.splice(i, 1)

      const candidates = await visionAgents()
      const agent = preferred && candidates.includes(preferred) ? preferred : candidates[0]
      const target = agent ? `the \`${agent}\` subagent` : "a subagent whose model supports images (none configured; tell the user)"
      output.parts.push({
        id: `prt_${Date.now().toString(16)}${Math.random().toString(16).slice(2, 14)}`,
        sessionID: output.message.sessionID,
        messageID: output.message.id,
        type: "text",
        synthetic: true,
        text: [
          `The user attached ${paths.length} image(s), saved to:`,
          ...paths.map((p) => `- ${p}`),
          `The current model cannot view images. Delegate image work via the task tool to ${target},`,
          `writing each path in the task prompt as \`@<path>\` (e.g. \`@${paths[0]}\`) so it is attached.`,
        ].join("\n"),
      })
    },
  }
}
