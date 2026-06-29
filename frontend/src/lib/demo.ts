/** True when the repo path is the bundled Northstar demo monorepo. */
export function isNorthstarDemoRepo(repoPath: string): boolean {
  const normalized = repoPath.replace(/\\/g, "/").replace(/\/+$/, "");
  return (
    normalized.endsWith("data/demo_repo") ||
    normalized.endsWith("/demo_repo") ||
    normalized === "demo_repo"
  );
}
