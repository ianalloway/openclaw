import { createHash } from "node:crypto";
import type { TemplateManifest } from "./types.js";

export const packageName = "@openclaw/research-briefing";

export const personalPackageName = "@alice/research-briefing";

export const version = "1.0.0";

export const archiveBytes = Buffer.alloc(321);

export const digest = createHash("sha256").update(archiveBytes).digest("hex");

export const packageJson = (name = packageName, selectedVersion = version, template = "CLAW.md") =>
  JSON.stringify({ name, version: selectedVersion, openclaw: { template } });

export const artifact = (selectedVersion = version, name = packageName) => ({
  package: { name, family: "template" },
  version: selectedVersion,
  artifact: { kind: "npm-pack", sha256: digest, npmIntegrity: "sha512-proof" },
});

export const release = (
  selectedVersion = version,
  templateManifestSummary: unknown = summary,
  name = packageName,
) => ({
  package: { name, displayName: "Research Briefing", family: "template" },
  version: {
    version: selectedVersion,
    createdAt: 2,
    changelog: "",
    templateManifestSummary,
    artifact: artifact(selectedVersion, name).artifact,
  },
});

export const skillRequest = { slug: "citation-check", ownerHandle: "openclaw", version: "1.1.0" };

export const matchingSecurity = {
  package: { name: packageName, family: "template" },
  release: {
    version,
    artifactKind: "npm-pack",
    artifactSha256: digest,
    npmIntegrity: "sha512-proof",
  },
  overview: "No concerning capabilities found.",
  verdict: "benign",
  securityAuditUrl: "https://clawhub.ai/openclaw/templates/research-briefing/security-audit",
  trust: {
    scanStatus: "clean",
    moderationState: "approved",
    blockedFromDownload: false,
    reasons: [],
    pending: false,
    stale: false,
  },
};

export const officialPackage = (name = packageName) => ({
  name,
  displayName: "Research Briefing",
  family: "template",
  channel: "official",
  isOfficial: true,
  ownerHandle: "openclaw",
  ownerOfficial: true,
  updatedAt: 2,
  latestVersion: version,
});

export const communityPackage = () => ({
  ...officialPackage(personalPackageName),
  channel: "community",
  isOfficial: false,
  ownerHandle: "alice",
  ownerOfficial: false,
});

export const summary = {
  schemaVersion: 1,
  agent: { id: "research-briefing", name: "Research Briefing" },
  workspace: { bootstrapFiles: ["SOUL.md"], fileCount: 1 },
  packages: { skillCount: 2, pluginCount: 0 },
  mcpServerCount: 1,
  cronJobCount: 0,
};

export const emptyManifest: TemplateManifest = {
  schemaVersion: 1,
  agent: { id: "research-briefing", name: "Research Briefing" },
  workspace: { bootstrapFiles: {}, files: [] },
  skills: [],
  plugins: [],
  mcpServers: {},
  automations: [],
};

export const listPage = (items: unknown[], nextCursor: string | null = null) => ({
  items,
  nextCursor,
});
