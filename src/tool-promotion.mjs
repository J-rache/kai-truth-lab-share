import { appendJsonl, labPaths, makeId, nowIso } from "./store.mjs";

export function decideToolPromotion(input) {
  const verification = normalizeList(input.verification);
  const limits = normalizeList(input.limits);
  const permissions = normalizeList(input.permissions);
  const publicSafe = input.publicSafe === true || input.publicSafe === "true";
  const hasVerification = verification.length > 0;
  const hasSecretRisk = [...limits, ...permissions, input.path ?? "", input.name ?? ""].some((value) =>
    /secret|token|credential|private|personal|dpapi|auth/i.test(String(value))
  );
  if (!hasVerification) {
    return {
      decision: "reject_until_verified",
      reason: "Tool has no verification recipe."
    };
  }
  if (hasSecretRisk || !publicSafe) {
    return {
      decision: "private_toolbox_only",
      reason: hasSecretRisk ? "Tool has private or credential-sensitive boundaries." : "Tool has not been marked public-safe."
    };
  }
  return {
    decision: "public_share_candidate",
    reason: "Tool has verification and has been marked public-safe."
  };
}

export async function recordToolPromotion(input, { cwd = process.cwd() } = {}) {
  const decision = decideToolPromotion(input);
  const record = {
    id: makeId("tool_decision"),
    toolId: input.id ?? input.name ?? "unknown",
    name: input.name ?? input.id ?? "unknown",
    path: input.path ?? "",
    verification: normalizeList(input.verification),
    permissions: normalizeList(input.permissions),
    limits: normalizeList(input.limits),
    publicSafe: input.publicSafe === true || input.publicSafe === "true",
    ...decision,
    decidedAt: nowIso()
  };
  await appendJsonl(labPaths(cwd).toolDecisions, record);
  return record;
}

function normalizeList(value) {
  if (value === undefined || value === null || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

