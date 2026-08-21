import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OPERATIONS = new Set([
  "goto",
  "assert-text",
  "assert-visible",
  "upload-image",
  "fill",
  "click",
  "assert-enabled",
  "assert-disabled",
]);

const TARGET_ONLY = new Set([
  "assert-visible",
  "upload-image",
  "click",
  "assert-enabled",
  "assert-disabled",
]);

const ASSERTIONS = new Set([
  "assert-text",
  "assert-visible",
  "assert-enabled",
  "assert-disabled",
]);

const FIXTURE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function requireBoundedString(value, field, maxLength) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength ||
    /[\0\r\n]/.test(value)
  ) {
    throw new Error(`${field} must be a bounded single-line string`);
  }
}

export function isAllowedApplicationUrl(candidateUrl, baseUrl) {
  const candidate = new URL(candidateUrl);
  const base = new URL(baseUrl);
  if (candidate.protocol === "data:" || candidate.protocol === "blob:") {
    return true;
  }
  if (candidate.protocol === "ws:" || candidate.protocol === "wss:") {
    const expectedProtocol = base.protocol === "https:" ? "wss:" : "ws:";
    return candidate.protocol === expectedProtocol && candidate.host === base.host;
  }
  return candidate.origin === base.origin;
}

export function validateScenario(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("Scenario must be an object");
  }
  const rootKeys = Object.keys(candidate).sort();
  if (rootKeys.join(",") !== "mode,steps,summary") {
    throw new Error("Scenario contains unsupported fields");
  }
  if (!["browser", "not-applicable"].includes(candidate.mode)) {
    throw new Error("Scenario mode is unsupported");
  }
  requireBoundedString(candidate.summary, "summary", 2000);
  if (!Array.isArray(candidate.steps) || candidate.steps.length > 12) {
    throw new Error("Scenario must contain at most 12 steps");
  }
  if (candidate.mode === "not-applicable" && candidate.steps.length !== 0) {
    throw new Error("A not-applicable scenario cannot contain steps");
  }
  if (candidate.mode === "browser" && candidate.steps.length === 0) {
    throw new Error("A browser scenario must contain at least one step");
  }

  for (const [index, step] of candidate.steps.entries()) {
    if (!step || typeof step !== "object" || Array.isArray(step)) {
      throw new Error(`Scenario step ${index + 1} must be an object`);
    }
    const stepKeys = Object.keys(step).sort();
    if (stepKeys.join(",") !== "operation,target,value") {
      throw new Error(`Scenario step ${index + 1} contains unsupported fields`);
    }
    if (!OPERATIONS.has(step.operation)) {
      throw new Error(`Scenario step ${index + 1} has an unsupported operation`);
    }

    if (step.operation === "goto") {
      requireBoundedString(step.target, `step ${index + 1} target`, 500);
      if (
        !step.target.startsWith("/") ||
        step.target.startsWith("//") ||
        step.target.includes("\\")
      ) {
        throw new Error(`Scenario step ${index + 1} must stay on the application origin`);
      }
      if (step.value !== null) {
        throw new Error(`Scenario step ${index + 1} does not accept a value`);
      }
      continue;
    }

    if (step.operation === "assert-text") {
      if (step.target !== null) {
        throw new Error(`Scenario step ${index + 1} does not accept a target`);
      }
      requireBoundedString(step.value, `step ${index + 1} value`, 1000);
      continue;
    }

    requireBoundedString(step.target, `step ${index + 1} target`, 500);
    if (step.operation === "fill") {
      requireBoundedString(step.value, `step ${index + 1} value`, 1000);
    } else if (TARGET_ONLY.has(step.operation) && step.value !== null) {
      throw new Error(`Scenario step ${index + 1} does not accept a value`);
    }
  }

  if (
    candidate.mode === "browser" &&
    !candidate.steps.some((step) => ASSERTIONS.has(step.operation))
  ) {
    throw new Error("A browser scenario must assert an observable outcome");
  }

  return candidate;
}

async function executeStep(page, step, baseUrl) {
  switch (step.operation) {
    case "goto": {
      const destination = new URL(step.target, baseUrl);
      if (destination.origin !== new URL(baseUrl).origin) {
        throw new Error("Scenario navigation left the application origin");
      }
      await page.goto(destination.href, {
        waitUntil: "networkidle",
      });
      break;
    }
    case "assert-text":
      await page.getByText(step.value, { exact: false }).first().waitFor({
        state: "visible",
      });
      break;
    case "assert-visible":
      await page.locator(step.target).first().waitFor({ state: "visible" });
      break;
    case "upload-image":
      await page.locator(step.target).setInputFiles({
        name: "scenario.png",
        mimeType: "image/png",
        buffer: FIXTURE_PNG,
      });
      break;
    case "fill":
      await page.locator(step.target).fill(step.value);
      break;
    case "click":
      await page.locator(step.target).click();
      break;
    case "assert-enabled":
      await waitForEnabledState(page.locator(step.target), true);
      break;
    case "assert-disabled":
      await waitForEnabledState(page.locator(step.target), false);
      break;
  }
}

async function waitForEnabledState(locator, expectedEnabled) {
  await locator.first().waitFor({ state: "visible" });
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if ((await locator.first().isEnabled()) === expectedEnabled) {
      return;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(
    `Expected locator to be ${expectedEnabled ? "enabled" : "disabled"}`,
  );
}

export async function runScenario(candidate, options = {}) {
  const scenario = validateScenario(candidate);
  const baseUrl = options.baseUrl ?? process.env.SCENARIO_BASE_URL;
  if (!baseUrl) {
    throw new Error("SCENARIO_BASE_URL is required");
  }
  process.env.SCENARIO_BASE_URL = baseUrl;

  const resultPath = options.resultPath ?? ".factory/scenario-result.json";
  const screenshotPath =
    options.screenshotPath ??
    process.env.SCENARIO_SCREENSHOT_PATH ??
    ".factory/scenario-evidence.png";
  const resolvedResultPath =
    options.resultPath ??
    process.env.SCENARIO_RESULT_PATH ??
    resultPath;
  mkdirSync(dirname(resolve(resolvedResultPath)), { recursive: true });
  mkdirSync(dirname(resolve(screenshotPath)), { recursive: true });

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    // GitHub's Docker host disables Chromium user namespaces. The workflow
    // supplies the outer sandbox: non-root user, no capabilities, read-only
    // root, private network, no host IPC, and only an evidence-only write mount.
    chromiumSandbox: false,
    headless: true,
  });
  const context = await browser.newContext({
    serviceWorkers: "block",
    viewport: { width: 1440, height: 1000 },
  });
  await context.route("**/*", async (route) => {
    if (isAllowedApplicationUrl(route.request().url(), baseUrl)) {
      await route.continue();
    } else {
      await route.abort("blockedbyclient");
    }
  });
  await context.routeWebSocket(/.*/, (webSocketRoute) => {
    if (isAllowedApplicationUrl(webSocketRoute.url(), baseUrl)) {
      webSocketRoute.connectToServer();
    } else {
      webSocketRoute.close({
        code: 1008,
        reason: "Cross-origin WebSocket blocked",
      });
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);

  const result = {
    mode: scenario.mode,
    summary: scenario.summary,
    status: "failed",
    completedSteps: 0,
    totalSteps: scenario.steps.length,
    error: null,
  };

  let failure;
  try {
    await page.goto(new URL("/", baseUrl).href, { waitUntil: "networkidle" });
    if (scenario.mode === "not-applicable") {
      result.status = "skipped";
    } else {
      for (const step of scenario.steps) {
        await executeStep(page, step, baseUrl);
        result.completedSteps += 1;
      }
      result.status = "passed";
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    failure = error;
  } finally {
    writeFileSync(resolvedResultPath, `${JSON.stringify(result, null, 2)}\n`);
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch (error) {
      if (!failure) {
        result.status = "failed";
        result.error = `Evidence screenshot failed: ${
          error instanceof Error ? error.message : String(error)
        }`;
        writeFileSync(resolvedResultPath, `${JSON.stringify(result, null, 2)}\n`);
        failure = error;
      }
    }
    await context.close();
    await browser.close();
  }

  if (failure) {
    throw failure;
  }

  return result;
}

function readScenario(path) {
  return validateScenario(JSON.parse(readFileSync(path, "utf8")));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === "--validate") {
      readScenario(process.argv[3]);
      console.log("Behavior scenario is valid.");
    } else {
      const result = await runScenario(readScenario(process.argv[2]));
      console.log(
        `Behavior scenario ${result.status}: ${result.completedSteps}/${result.totalSteps} step(s).`,
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
