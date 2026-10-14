import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";

type GeminiKey = {
  geminiApiKey: string;
};

function getSettingsPath() {
  return path.join(process.cwd(), ".local-secrets", "contract-assistant.json");
}

async function readSavedKey(): Promise<string> {
  try {
    const contents = await readFile(getSettingsPath(), "utf8");
    const parsed: unknown = JSON.parse(contents);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("geminiApiKey" in parsed) ||
      typeof parsed.geminiApiKey !== "string"
    ) {
      throw new Error("Invalid assistant settings file.");
    }
    return parsed.geminiApiKey;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

export async function getSavedGeminiApiKey(): Promise<string> {
  return readSavedKey();
}

export async function getGeminiApiKey(): Promise<string> {
  return process.env.GEMINI_API_KEY || await readSavedKey();
}

export async function getAssistantKeyStatus() {
  const savedKey = await readSavedKey();
  const geminiManagedByEnvironment = Boolean(process.env.GEMINI_API_KEY);
  return {
    geminiConfigured: geminiManagedByEnvironment || Boolean(savedKey),
    geminiSaved: Boolean(savedKey),
    geminiManagedByEnvironment,
  };
}

export async function saveGeminiApiKey(key: GeminiKey): Promise<void> {
  const settingsDirectory = path.dirname(getSettingsPath());
  const settingsPath = getSettingsPath();
  const temporaryPath = `${settingsPath}.${randomUUID()}.tmp`;

  await mkdir(settingsDirectory, { recursive: true, mode: 0o700 });
  const file = await open(temporaryPath, "wx", 0o600);
  try {
    await file.writeFile(JSON.stringify(key), "utf8");
    await file.close();
    await rename(temporaryPath, settingsPath);
  } catch (error) {
    await file.close().catch(() => undefined);
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}
