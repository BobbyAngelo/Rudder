import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const setupScript = readFileSync(new URL("../setup.sh", import.meta.url), "utf8");

function createFixture({
  curlResponse = JSON.stringify({ models: [] }),
  nodeVersion = "v20.12.0"
} = {}) {
  const directory = mkdtempSync(join(tmpdir(), "rudder-setup-"));
  const binDir = join(directory, "bin");
  const appDir = join(directory, "app");
  const logPath = join(directory, "calls.log");

  mkdirSync(binDir);
  mkdirSync(appDir);

  writeFileSync(join(directory, "setup.sh"), setupScript, { mode: 0o755 });
  writeFileSync(join(appDir, ".env.example"), "OLLAMA_URL=http://localhost:11434\n", "utf8");
  writeFileSync(logPath, "", "utf8");

  writeFileSync(
    join(binDir, "node"),
    `#!/usr/bin/env bash
if [ "$1" = "-v" ]; then
  echo "${nodeVersion}"
  exit 0
fi
if [ "$1" = "-p" ]; then
  echo "${nodeVersion.slice(1).split(".")[0]}"
  exit 0
fi
echo "unexpected node args: $*" >&2
exit 1
`,
    { mode: 0o755 }
  );

  writeFileSync(
    join(binDir, "curl"),
    `#!/usr/bin/env bash
printf 'curl %s\\n' "$*" >> "${logPath}"
if printf '%s' "$*" | grep -q '/api/tags'; then
  printf '%s' '${curlResponse}'
  exit 0
fi
exit 1
`,
    { mode: 0o755 }
  );

  writeFileSync(
    join(binDir, "ollama"),
    `#!/usr/bin/env bash
printf 'ollama %s\\n' "$*" >> "${logPath}"
if [ "$1" = "pull" ]; then
  exit 0
fi
echo "unexpected ollama args: $*" >&2
exit 1
`,
    { mode: 0o755 }
  );

  writeFileSync(
    join(binDir, "npm"),
    `#!/usr/bin/env bash
printf 'npm %s\\n' "$*" >> "${logPath}"
exit 0
`,
    { mode: 0o755 }
  );

  return { directory, logPath, appDir };
}

function runSetup(directory, args = []) {
  return spawnSync("bash", [join(directory, "setup.sh"), ...args], {
    cwd: directory,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${join(directory, "bin")}:${process.env.PATH ?? ""}`
    }
  });
}

test("setup.sh --help prints usage and exits without side effects", () => {
  const fixture = createFixture();

  const result = runSetup(fixture.directory, ["--help"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: \.\/setup\.sh \[--check\]/);
  assert.equal(readFileSync(fixture.logPath, "utf8"), "");
  assert.equal(
    result.stderr,
    ""
  );
});

test("setup.sh --check validates prerequisites without installing or mutating files", () => {
  const fixture = createFixture({
    curlResponse: JSON.stringify({
      models: [{ name: "nomic-embed-text:latest" }, { name: "llama3.2:latest" }]
    })
  });

  const result = runSetup(fixture.directory, ["--check"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Node .* found/);
  assert.match(result.stdout, /Ollama is running/);
  assert.match(result.stdout, /Model available: nomic-embed-text/);
  assert.match(result.stdout, /Model available: llama3\.2/);
  assert.match(result.stdout, /Check completed successfully/);
  assert.equal(readFileSync(fixture.logPath, "utf8"), "curl -sf http://localhost:11434/api/tags\n");
  assert.equal(
    readFileSync(join(fixture.appDir, ".env.example"), "utf8"),
    "OLLAMA_URL=http://localhost:11434\n"
  );
});

test("setup.sh --check exits non-zero when a required model is missing", () => {
  const fixture = createFixture({
    curlResponse: JSON.stringify({
      models: [{ name: "nomic-embed-text:latest" }]
    })
  });

  const result = runSetup(fixture.directory, ["--check"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing model: llama3\.2/);
  assert.doesNotMatch(result.stdout, /Installing dependencies/);
  assert.equal(readFileSync(fixture.logPath, "utf8"), "curl -sf http://localhost:11434/api/tags\n");
});
