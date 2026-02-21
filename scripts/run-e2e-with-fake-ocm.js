#!/usr/bin/env node

const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const port = String(process.env.FAKE_OCM_PORT ?? "3999");
const host = "127.0.0.1";
const baseUrl = `http://${host}:${port}`;

const requestOnce = (url) =>
  new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode != null && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(400, () => {
      req.destroy();
      resolve(false);
    });
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForFakeOcm = async (timeoutMs) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const ok = await requestOnce(`${baseUrl}/poi?limit=1&offset=0`);
    if (ok) return true;
    await sleep(100);
  }
  return false;
};

const run = async () => {
  let fakeServerProcess;
  let fakeServerStartedByScript = false;

  const alreadyRunning = await waitForFakeOcm(400);
  if (!alreadyRunning) {
    fakeServerProcess = spawn(process.execPath, [path.resolve("dist/src/fake-ocm-server.js")], {
      env: { ...process.env, FAKE_OCM_PORT: port },
      stdio: "inherit"
    });
    fakeServerStartedByScript = true;

    const ready = await waitForFakeOcm(6000);
    if (!ready) {
      if (fakeServerProcess.exitCode == null) {
        fakeServerProcess.kill("SIGTERM");
      }
      throw new Error(`Fake OCM server did not become ready on ${baseUrl}`);
    }
  }

  const jestProcess = spawn(
    process.execPath,
    [path.resolve("node_modules/jest/bin/jest.js"), "--selectProjects", "e2e"],
    {
      env: {
        ...process.env,
        OCM_BASE_URL: process.env.OCM_BASE_URL ?? baseUrl
      },
      stdio: "inherit"
    }
  );

  const exitCode = await new Promise((resolve, reject) => {
    jestProcess.on("error", reject);
    jestProcess.on("exit", (code) => resolve(code ?? 1));
  });

  if (fakeServerStartedByScript && fakeServerProcess && fakeServerProcess.exitCode == null) {
    fakeServerProcess.kill("SIGTERM");
  }

  process.exit(exitCode);
};

void run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
