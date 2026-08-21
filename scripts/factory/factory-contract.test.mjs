import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("factory keeps the complete issue-to-scenario lifecycle", () => {
  const workflow = read(".github/workflows/codex-factory.yml");

  for (const stage of [
    "triage",
    "generate",
    "validate",
    "evaluate",
    "scenario",
    "scenario_test",
    "publish",
  ]) {
    assert.match(workflow, new RegExp(`^  ${stage}:$`, "m"));
  }
  assert.match(
    workflow,
    /needs: \[triage, generate, validate, evaluate, scenario, scenario_test\]/,
  );
  assert.match(workflow, /evaluate:\s+name: Evaluate candidate with Codex\s+needs: \[triage, generate\]/);
  assert.match(workflow, /validate:\s+name: Validate candidate without write credentials\s+needs: \[generate, evaluate\]/);
});

test("implementation prompt keeps product changes outside factory controls", () => {
  const prompt = read(".github/codex/prompts/implement.md");

  assert.match(prompt, /`scripts\/factory\/`/);
  assert.match(prompt, /dependency manifests or lockfiles/);
  assert.match(prompt, /Product tests belong with product code under `src\/`/);
});

test("Codex evaluation has a prompt and a bounded structured output", () => {
  const workflow = read(".github/workflows/codex-factory.yml");
  const prompt = read(".github/codex/prompts/evaluate.md");
  const schema = JSON.parse(
    read(".github/codex/schemas/evaluation.schema.json"),
  );

  assert.match(workflow, /prompt-file: \.github\/codex\/prompts\/evaluate\.md/);
  assert.match(
    workflow,
    /output-schema-file: \.github\/codex\/schemas\/evaluation\.schema\.json/,
  );
  assert.match(prompt, /This evaluation is advisory/);
  assert.deepEqual(schema.properties.verdict.enum, ["pass", "needs-human"]);
  assert.equal(schema.properties.findings.maxItems, 5);
  assert.ok(
    schema.properties.findings.items.required.includes("path"),
  );
  assert.deepEqual(
    schema.properties.findings.items.properties.path.type,
    ["string", "null"],
  );
  assert.equal(schema.additionalProperties, false);
});

test("behavioral scenarios use a strict prompt, schema, runner, and evidence gate", () => {
  const workflow = read(".github/workflows/codex-factory.yml");
  const prompt = read(".github/codex/prompts/scenario.md");
  const schema = JSON.parse(
    read(".github/codex/schemas/scenario.schema.json"),
  );
  const runner = read("scripts/factory/run-scenario.mjs");

  assert.match(workflow, /prompt-file: \.github\/codex\/prompts\/scenario\.md/);
  assert.match(
    workflow,
    /output-schema-file: \.github\/codex\/schemas\/scenario\.schema\.json/,
  );
  assert.match(workflow, /Run behavioral scenario against built application/);
  assert.match(workflow, /codex-scenario-evidence-/);
  assert.match(workflow, /mcr\.microsoft\.com\/playwright@sha256:/);
  assert.match(workflow, /SCENARIO_MODE: \$\{\{ needs\.scenario\.outputs\.mode \}\}/);
  assert.match(workflow, /\[ "\$SCENARIO_MODE" = "not-applicable" \]/);
  assert.match(prompt, /separate trusted runner/);
  assert.match(prompt, /Use `assert-attached` for intentionally hidden controls/);
  assert.deepEqual(schema.properties.mode.enum, ["browser", "not-applicable"]);
  assert.equal(schema.properties.steps.maxItems, 12);
  for (const branch of schema.properties.steps.items.anyOf) {
    for (const property of Object.values(branch.properties)) {
      assert.ok(property.type, "strict output schema properties require a type");
    }
  }
  assert.ok(
    schema.properties.steps.items.anyOf.some((branch) =>
      branch.properties.operation.enum?.includes("assert-attached"),
    ),
  );
  assert.match(runner, /SCENARIO_BASE_URL/);
});

test("candidate code cannot read or replace the scenario oracle and runner", () => {
  const workflow = read(".github/workflows/codex-factory.yml");
  const runner = read("scripts/factory/run-scenario.mjs");
  const build = workflow.indexOf(
    "Build and start bounded scenario application before revealing acceptance checks",
  );
  const scenarioDownload = workflow.indexOf(
    "Download immutable behavioral scenario after build",
  );

  assert.ok(build > 0);
  assert.ok(scenarioDownload > build);
  assert.match(
    workflow,
    /--volume "\$RUNNER_TEMP\/run-scenario\.mjs:\/runner\/run-scenario\.mjs:ro"/,
  );
  assert.match(workflow, /--user pwuser/);
  assert.match(workflow, /--shm-size 1gb/);
  assert.match(workflow, /--tmpfs \/repo:rw,nosuid,nodev,size=2g,uid=1000,gid=1000/);
  assert.match(workflow, /--user 1000:1000/);
  assert.match(runner, /context\.route\("\*\*\/\*"/);
  assert.match(runner, /context\.routeWebSocket/);
  assert.doesNotMatch(
    workflow,
    /--volume "\$GITHUB_WORKSPACE\/\.factory:\/repo\/\.factory:rw"/,
  );
});

test("artifact transfers use Node 24 action generations", () => {
  const workflow = read(".github/workflows/codex-factory.yml");

  assert.doesNotMatch(workflow, /actions\/(?:upload|download)-artifact@[^\s]+ # v5/);
  assert.match(workflow, /actions\/upload-artifact@[^\s]+ # v6/);
  assert.match(workflow, /actions\/download-artifact@[^\s]+ # v7/);
});

test("artifact consumers retain the producer attempt across failed-job reruns", () => {
  const workflow = read(".github/workflows/codex-factory.yml");

  assert.match(workflow, /issue_attempt: \$\{\{ steps\.artifact_identity\.outputs\.attempt \}\}/);
  assert.match(workflow, /candidate_attempt: \$\{\{ steps\.artifact_identity\.outputs\.attempt \}\}/);
  assert.match(workflow, /needs\.triage\.outputs\.issue_attempt/);
  assert.match(workflow, /needs\.generate\.outputs\.candidate_attempt/);
  assert.doesNotMatch(
    workflow,
    /codex-(?:issue|candidate)-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/,
  );
});

test("a publish-job rerun reuses an existing pull request from that run", () => {
  const workflow = read(".github/workflows/codex-factory.yml");

  assert.match(workflow, /Find an existing pull request from this run/);
  assert.match(workflow, /if: steps\.existing_pr\.outputs\.url == ''/);
  assert.match(workflow, /EXISTING_PR_URL: \$\{\{ steps\.existing_pr\.outputs\.url \}\}/);
  assert.match(workflow, /pr_url="\$EXISTING_PR_URL"/);
});

test("PR validation installs the trusted base before applying candidate code", () => {
  const workflow = read(".github/workflows/pr-validation.yml");
  const install = workflow.indexOf(
    "Install trusted baseline dependencies for factory candidate",
  );
  const apply = workflow.indexOf(
    "Fetch and apply immutable pull request merge result",
  );
  const boundary = workflow.indexOf('node "$RUNNER_TEMP/check-boundaries.mjs"');
  const validation = workflow.indexOf("Validate factory candidate without network");

  assert.ok(install >= 0);
  assert.ok(install < apply);
  assert.ok(apply < boundary);
  assert.ok(boundary < validation);
  assert.match(workflow, /github\.event\.pull_request\.head\.sha/);
  assert.match(workflow, /refs\/pull\/\$\{PR_NUMBER\}\/merge/);
  assert.match(workflow, /test "\$merge_base" = "\$BASE_SHA"/);
  assert.match(workflow, /test "\$merge_head" = "\$HEAD_SHA"/);
});

test("required PR validation cannot skip non-factory pull requests", () => {
  const factory = read(".github/workflows/codex-factory.yml");
  const workflow = read(".github/workflows/pr-validation.yml");

  assert.match(workflow, /name: validate\s+if: github\.event_name == 'pull_request'/);
  assert.match(workflow, /Validate non-factory candidate in an isolated container/);
  assert.match(factory, /name: codex-attestation-\$\{\{ github\.run_id \}\}/);
  assert.match(factory, /WORKFLOW_SHA: \$\{\{ github\.workflow_sha \}\}/);
  assert.match(workflow, /Download immutable factory attestation/);
  assert.match(workflow, /\.path == "\.github\/workflows\/codex-factory\.yml"/);
  assert.match(workflow, /\.head_branch == \$branch/);
  assert.match(workflow, /\.workflow == \$workflow/);
  assert.match(workflow, /actions\/runs\/\$RUN_ID\/attempts\/\$RUN_ATTEMPT/);
  assert.match(workflow, /PR_AUTHOR.*github\.event\.pull_request\.user\.login/);
  assert.match(workflow, /Bot-authored pull requests require factory attestation/);
  assert.doesNotMatch(factory, /codex-factory-attestation run=/);
});

test("closing a factory PR advances or releases its issue state", () => {
  const workflow = read(".github/workflows/pr-validation.yml");

  assert.match(workflow, /pull_request_target:\s+branches: \[main\]\s+types: \[closed\]/);
  assert.match(workflow, /^  update_issue_state:$/m);
  assert.match(workflow, /github\.event_name == 'pull_request_target'/);
  assert.match(workflow, /--add-label "factory:done"/);
  assert.match(workflow, /--add-label "factory:wait"/);
});
