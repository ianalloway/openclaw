import fs from "node:fs";
import { awaitGateBeforeSettlement, createDeferred } from "../../../test/helpers/promise.js";
import { updateSessionEntry } from "./session-accessor.js";
import { timedMessageEvent } from "./transcript-message.test-support.js";
import type { InternalSessionEntry } from "./types.js";

export function startEntryChange(
  scope: Parameters<typeof updateSessionEntry>[0],
  patch: Partial<InternalSessionEntry>,
) {
  const gate = createDeferred();
  const started = createDeferred();
  const change = updateSessionEntry(scope, async () => {
    started.resolve();
    await gate.promise;
    return patch;
  });
  // Return retirement ownership before waiting: a missing entry never calls the updater.
  return {
    started: awaitGateBeforeSettlement(
      started.promise,
      change,
      "session entry change settled before its updater started",
    ),
    finish: () => {
      gate.resolve();
      return change;
    },
  };
}

export function writeLegacyTranscriptFixture(
  sessionId: string,
  sessionsDir: string,
  params: {
    transcriptPath: string;
    message: { role: "user"; content: string; timestamp: number };
  },
) {
  const entries = [
    {
      type: "session",
      version: 4,
      id: sessionId,
      timestamp: new Date(0).toISOString(),
      cwd: sessionsDir,
    },
    timedMessageEvent(
      "legacy-message",
      null,
      new Date(params.message.timestamp).toISOString(),
      params.message,
    ),
  ];
  fs.writeFileSync(
    params.transcriptPath,
    `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
  );
}
