import type { JSX } from "@solidjs/web";
import { SettingsRow } from "../../components/solid/settings-ui.tsx";
import { t } from "../../lib/reactive/i18n.ts";
import type { CloudWorkerProfileDraft } from "./cloud-worker-config.ts";
export function createCloudWorkerDraftInput(
  draft: () => CloudWorkerProfileDraft,
  saving: () => boolean,
  patchDraft: (patch: Partial<CloudWorkerProfileDraft>) => void,
) {
  return function renderDraftInput(
    field:
      | "id"
      | "backend"
      | "ttl"
      | "idleTimeout"
      | "binary"
      | "setupEnv"
      | "readyWorkers"
      | "suspendAfter",
    options: {
      description?: JSX.Element;
      placeholder?: string;
      type?: "text" | "number";
    } = {},
  ) {
    const label = field === "id" ? "profileId" : field;
    return (
      <SettingsRow
        title={t(`cloudWorkersPage.fields.${label}`)}
        description={options.description ?? t(`cloudWorkersPage.fields.${label}Help`)}
        control={
          <input
            class="settings-input mono"
            aria-label={t(`cloudWorkersPage.fields.${label}`)}
            placeholder={options.placeholder}
            type={options.type}
            min={field === "readyWorkers" ? "0" : undefined}
            step={field === "readyWorkers" ? "1" : undefined}
            autocomplete="off"
            spellcheck="false"
            value={draft()[field]}
            disabled={saving()}
            onInput={(event) => patchDraft({ [field]: event.currentTarget.value })}
          />
        }
      />
    );
  };
}
