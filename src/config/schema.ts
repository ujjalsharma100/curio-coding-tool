import { z } from "zod";

export const ConfigSchema = z.object({
  model: z.string().default("anthropic:claude-sonnet-4-6"),
  provider: z.string().optional(),
  permissionMode: z.enum(["ask", "auto", "strict"]).default("ask"),
  theme: z.enum(["dark", "light", "auto"]).default("dark"),
  maxTokens: z.number().default(8192),
  temperature: z.number().default(0),
  shell: z.string().optional(),
  customInstructions: z.string().optional(),
  tools: z
    .object({
      bash: z
        .object({
          timeout: z.number().default(120_000),
          shell: z.string().optional(),
        })
        .optional(),
      edit: z
        .object({
          requireConfirmation: z.boolean().default(true),
        })
        .optional(),
    })
    .optional(),
  allowedPaths: z.array(z.string()).optional(),
  blockedCommands: z.array(z.string()).optional(),
  mcpServers: z.record(z.any()).optional(),
  keybindings: z.record(z.string()).optional(),
  memory: z
    .object({
      enabled: z.boolean().default(true),
      autoSave: z.boolean().default(true),
    })
    .optional(),
  costLimit: z
    .object({
      perSession: z.number().optional(),
      perMonth: z.number().optional(),
    })
    .optional(),
  providers: z
    .record(
      z.object({
        type: z.string(),
        baseUrl: z.string().optional(),
        apiKeyEnv: z.string().optional(),
        defaultModel: z.string().optional(),
      }),
    )
    .optional(),
  hooks: z.record(z.string()).optional(),
});

export type CurioConfig = z.infer<typeof ConfigSchema>;

export const CONFIG_DEFAULTS: CurioConfig = ConfigSchema.parse({});
