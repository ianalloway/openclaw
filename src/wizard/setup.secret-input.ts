import type { OpenClawConfig } from "../config/types.openclaw.js";
import { normalizeSecretInputString, resolveSecretInputRef } from "../config/types.secrets.js";
import { formatErrorMessage } from "../infra/errors.js";
import { resolveSecretRefString } from "../secrets/resolve.js";
import { t } from "./i18n/index.js";
import type { WizardPrompter } from "./prompts.js";

function formatSecretResolutionError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return String(error);
}

export async function resolveSetupSecretInputString(params: {
  config: OpenClawConfig;
  value: unknown;
  path: string;
  env?: NodeJS.ProcessEnv;
}): Promise<string | undefined> {
  const { ref } = resolveSecretInputRef({
    value: params.value,
    defaults: params.config.secrets?.defaults,
  });
  if (ref) {
    try {
      return await resolveSecretRefString(ref, {
        config: params.config,
        env: params.env ?? process.env,
      });
    } catch (error) {
      throw new Error(
        `${params.path}: failed to resolve SecretRef "${ref.source}:${ref.provider}:${ref.id}": ${formatSecretResolutionError(error)}`,
        { cause: error },
      );
    }
  }

  return normalizeSecretInputString(params.value);
}

/** Report a resolution error in the wizard and fall back to the gateway environment. */
export async function resolveSetupProbeSecret(params: {
  key: "token" | "password";
  config: OpenClawConfig;
  value: unknown;
  fallback?: string;
  prompter: Pick<WizardPrompter, "note">;
}) {
  const { key, fallback } = params;
  const field = `gateway.auth.${key}`;
  try {
    return (
      (await resolveSetupSecretInputString({
        config: params.config,
        value: params.value,
        path: field,
        env: process.env,
      })) || fallback
    );
  } catch (error) {
    await params.prompter.note(
      [t("wizard.setup.secretRefProbeFailed", { field }), formatErrorMessage(error)].join("\n"),
      t("wizard.gateway.auth"),
    );
    return fallback;
  }
}
