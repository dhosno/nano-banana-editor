import { spawnSync } from "node:child_process";

const issueNumber = process.argv[2];

if (!/^[1-9]\d*$/.test(issueNumber ?? "")) {
  console.error("Usage: npm run factory -- <issue-number>");
  process.exit(1);
}

const originResult = spawnSync("git", ["remote", "get-url", "origin"], {
  encoding: "utf8",
});

if (originResult.error || originResult.status !== 0) {
  console.error("Unable to resolve the origin Git remote.");
  process.exit(1);
}

const repositoryResult = spawnSync(
  "gh",
  [
    "repo",
    "view",
    originResult.stdout.trim(),
    "--json",
    "nameWithOwner,defaultBranchRef",
  ],
  { encoding: "utf8" },
);

if (repositoryResult.error || repositoryResult.status !== 0) {
  console.error("Unable to resolve the current GitHub repository.");
  process.exit(1);
}

const repository = JSON.parse(repositoryResult.stdout);
const repositoryName = repository.nameWithOwner;
const defaultBranch = repository.defaultBranchRef?.name;

if (!repositoryName || !defaultBranch) {
  console.error("The current repository has no GitHub remote or default branch.");
  process.exit(1);
}

const result = spawnSync(
  "gh",
  [
    "workflow",
    "run",
    "codex-factory.yml",
    "--repo",
    repositoryName,
    "--ref",
    defaultBranch,
    "-f",
    `issue_number=${issueNumber}`,
  ],
  {
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(`Unable to start the factory: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Factory dispatched for issue #${issueNumber}.`);
console.log("Inspect the run with: gh run list --workflow codex-factory.yml");
