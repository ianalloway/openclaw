import { expect, vi } from "vitest";
import type { GatewaySessionRow } from "../../api/types.ts";
import { sessionsResult } from "../../lib/sessions/session-capability.test-support.ts";
import type {
  SessionDeleteOutcome,
  SessionDeleteTarget,
} from "../../lib/sessions/session-capability.ts";
import { waitForFast } from "../../test-helpers/wait-for.ts";
import { createRenderedPage, liveSessions } from "./sessions-page.test-support.ts";

export async function createDeletionPage(rows: GatewaySessionRow[], agentId = "main") {
  let serverRows = rows;
  const deleteRequest = vi.fn(
    async (target: SessionDeleteTarget): Promise<SessionDeleteOutcome> => {
      const deleted = serverRows.some((entry) => entry.key === target.key);
      serverRows = serverRows.filter((entry) => entry.key !== target.key);
      return { deleted };
    },
  );
  const { connection, sessions, context } = liveSessions(
    {
      "sessions.list": () => sessionsResult(serverRows, 1),
      "sessions.delete": (params) => deleteRequest(params as SessionDeleteTarget),
    },
    agentId,
  );
  const subscribe = vi.spyOn(sessions, "subscribeList");
  vi.spyOn(sessions, "deleteMany");
  context.agentSelection.state.selectedId = agentId;
  context.agentSelection.state.scopeId = agentId;
  const page = await createRenderedPage(context, sessionsResult(rows, 1), "all");
  await waitForFast(() => expect(page.loading).toBe(false));
  return {
    page,
    sessions,
    connection,
    deleteRequest,
    query: subscribe.mock.calls[0]![0],
    setRows: (next: GatewaySessionRow[]) => {
      serverRows = next;
    },
  };
}
