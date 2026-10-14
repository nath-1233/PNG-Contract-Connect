import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";

type ProviderKeys = {
  geminiApiKey: string;
  claudeApiKey: string;
};

export type AssistantProvider = "gemini" | "claude";

function getSettingsPath() {
  return path.join(process.cwd(), ".local-secrets", "contract-assistant.json");
}

async function readSavedKeys(): Promise<ProviderKeys> {
  try {
    const contents = await readFile(getSettingsPath(), "utf8");
    const parsed: unknown = JSON.parse(contents);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("geminiApiKey" in parsed) ||
      !("claudeApiKey" in parsed) ||
      typeof parsed.geminiApiKey !== "string" ||
      typeof parsed.claudeApiKey !== "string"
    ) {
      throw new Error("Invalid assistant settings file.");
    }
    return { geminiApiKey: parsed.geminiApiKey, claudeApiKey: parsed.claudeApiKey };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { geminiApiKey: "", claudeApiKey: "" };
    }
    throw error;
  }
}

export async function getSavedAssistantApiKeys(): Promise<ProviderKeys> {
  return readSavedKeys();
}

export async function getAssistantApiKey(provider: AssistantProvider): Promise<string> {
  const environmentKey = provider === "gemini" ? process.env.GEMINI_API_KEY : process.env.ANTHROPIC_API_KEY;
  if (environmentKey) return environmentKey;

  const savedKeys = await readSavedKeys();
  return provider === "gemini" ? savedKeys.geminiApiKey : savedKeys.claudeApiKey;
}

export async function getAssistantKeyStatus() {
  const savedKeys = await readSavedKeys();
  const geminiFromEnvironment = Boolean(process.env.GEMINI_API_KEY);
  const claudeFromEnvironment = Boolean(process.env.ANTHROPIC_API_KEY);
  return {
    geminiConfigured: geminiFromEnvironment || Boolean(savedKeys.geminiApiKey),
    claudeConfigured: claudeFromEnvironment || Boolean(savedKeys.claudeApiKey),
    geminiSaved: Boolean(savedKeys.geminiApiKey),
    claudeSaved: Boolean(savedKeys.claudeApiKey),
    geminiManagedByEnvironment: geminiFromEnvironment,
    claudeManagedByEnvironment: claudeFromEnvironment,
  };
}

export async function saveAssistantApiKeys(keys: ProviderKeys): Promise<void> {
  const settingsDirectory = path.dirname(getSettingsPath());
  const settingsPath = getSettingsPath();
  const temporaryPath = `${settingsPath}.${randomUUID()}.tmp`;

  await mkdir(settingsDirectory, { recursive: true, mode: 0o700 });
  const file = await open(temporaryPath, "wx", 0o600);
  try {
    await file.writeFile(JSON.stringify(keys), "utf8");
    await file.close();
    await rename(temporaryPath, settingsPath);
  } catch (error) {
    await file.close().catch(() => undefined);
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}
