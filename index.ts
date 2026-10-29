import type { Plugin } from "@opencode-ai/plugin"
import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" }

const instructions = (paths: string[], agent: string) =>
  [
    `IMPORTANT (peek plugin): the user attached ${paths.length} image(s). You cannot see images, so before you answer, have the image(s) read. The files exist at exactly these paths; use them as written and do not shorten, guess or rewrite them:`,
    ...paths.map((p) => `- ${p}`),
    `Do this first, without asking the user: call the task tool with subagent \`${agent}\` and put each path in the prompt as \`@<path>\` (e.g. \`@${paths[0]}\`) so the file is attached, and ask it to describe what you need from the image.`,
    `If you cannot use the task tool, use any other tool or agent available to you that can read image files, passing the same path(s).`,
    `Never answer about the image(s) without their content.`,
  ].join("\n")

const server: Plugin = async ({ client, directory }, options) => {
  // Inside the project, so agents can read it without an outside-directory permission prompt.
  const dir = join(directory, ".opencode", "peek")
  // sessionID -> images not yet handed on, repeated in the system prompt until a tool call uses their path
  const pending = new Map<string, { paths: string[]; agent: string }>()
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

  // An agent that may not call the task tool (e.g. a coordinator that only routes work) cannot hand the
  // image on. Permission rules are ordered and the last matching rule wins.
  const canDelegate = async (name: string | undefined) => {
    if (!name) return true
    const res = await client.app.agents().catch(() => undefined)
    const rules: Array<{ permission: string; pattern: string; action: string }> =
      (res?.data?.find((a) => a.name === name) as any)?.permission ?? []
    let action = "allow"
    for (const r of rules) if ((r.permission === "task" || r.permission === "*") && r.pattern === "*") action = r.action
    return action !== "deny"
  }

  return {
    "chat.message": async (input, output) => {
      pending.delete(output.message.sessionID)
      const images = output.parts.filter(
        (p) => p.type === "file" && p.mime.startsWith("image/") && p.url.startsWith("data:"),
      )
      if (images.length === 0) return
      const model = input.model ?? output.message.model
      if (model && (await supportsImage(model.providerID, model.modelID))) return
      if (!(await canDelegate(output.message.agent ?? input.agent))) return
      // Without a vision subagent there is nobody to hand the image to, so leave the message alone.
      const candidates = await visionAgents()
      if (candidates.length === 0) return
      const agent = preferred && candidates.includes(preferred) ? preferred : candidates[0]

      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, ".gitignore"), "*\n")
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

      pending.set(output.message.sessionID, { paths, agent })
      output.parts.push({
        id: `prt_${Date.now().toString(16)}${Math.random().toString(16).slice(2, 14)}`,
        sessionID: output.message.sessionID,
        messageID: output.message.id,
        type: "text",
        synthetic: true,
        text: instructions(paths, agent),
      })
    },
    "tool.execute.before": async (input, output) => {
      const entry = pending.get(input.sessionID)
      const args = JSON.stringify(output.args ?? {})
      if (entry?.paths.some((p) => args.includes(p))) pending.delete(input.sessionID)
    },
    "experimental.chat.system.transform": async (input, output) => {
      const entry = input.sessionID ? pending.get(input.sessionID) : undefined
      if (entry) output.system.push(instructions(entry.paths, entry.agent))
    },
  }
}

// opencode 1.x loads a path plugin from its default export: `{ id, server }`.
export default { id: "peek", server }
