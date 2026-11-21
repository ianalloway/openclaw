import { vi } from "vitest";
import type { WorkerTunnelHandle } from "./tunnel-contract.js";
import {
  createWorkerTurnTunnel,
  reconcileUnchangedLocalWorkspace,
  credential,
  attachedEnvironment,
  createWorkerSessionTurnPlacementProvider,
  placements,
  sessionTarget,
  unusedEnvironments,
  type WorkerTurnEnvironmentService,
} from "./worker-turn-launcher.test-support.js";

export function unusedTunnel<T extends Partial<WorkerTunnelHandle>>(overrides: T) {
  return createWorkerTurnTunnel({
    runWorkspaceCommand: vi.fn(),
    syncWorkspace: vi.fn(),
    reconcileWorkspace: vi.fn(reconcileUnchangedLocalWorkspace),
    stop: vi.fn(),
    launchTurn: vi.fn(),
    ...overrides,
  });
}

export function turnProvider(
  environments: Partial<WorkerTurnEnvironmentService>,
  options: Omit<
    Parameters<typeof createWorkerSessionTurnPlacementProvider>[0],
    "placements" | "environments"
  > = {},
) {
  return createWorkerSessionTurnPlacementProvider({
    placements,
    environments: { ...unusedEnvironments(), get: attachedEnvironment, ...environments },
    ...options,
  });
}

export function credentialedProvider(
  tunnel: WorkerTunnelHandle,
  options: Parameters<typeof turnProvider>[1] = {},
) {
  return turnProvider(
    {
      acquireTurnCredential: async () => credential(),
      startTunnel: async () => tunnel,
    },
    options,
  );
}

type TurnProvider = ReturnType<typeof turnProvider>;

type ExecuteArgs = Parameters<TurnProvider["executeTurn"]>;

export function execute(
  provider: TurnProvider,
  input: ExecuteArgs[1],
  runLocal: ExecuteArgs[2] = vi.fn(),
  assertCurrent?: ExecuteArgs[4],
) {
  return provider.executeTurn(
    { ...sessionTarget, runId: input.runId },
    input,
    runLocal,
    undefined,
    assertCurrent,
  );
}
