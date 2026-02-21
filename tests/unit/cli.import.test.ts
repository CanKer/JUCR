describe("import CLI", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it("builds a controlled error envelope without stack by default", async () => {
    const { buildCliErrorEnvelope } = await import("../../src/cli/import");

    const error = Object.assign(new Error("repository failed"), {
      name: "ImportFatalError",
      code: "repository_write_failed",
      context: {
        page: 2,
        offset: 100,
        pageSize: 50,
        index: 1,
        externalId: 77,
        unsafe: "ignored"
      },
      status: 500,
      cause: { raw: "secret payload" }
    });

    const envelope = buildCliErrorEnvelope(error, false);

    expect(envelope).toEqual({
      event: "import.failed",
      name: "ImportFatalError",
      message: "repository failed",
      code: "repository_write_failed",
      context: {
        page: 2,
        offset: 100,
        pageSize: 50,
        index: 1,
        externalId: 77
      },
      status: 500
    });
    expect(envelope).not.toHaveProperty("stack");
    expect(JSON.stringify(envelope)).not.toContain("secret payload");
  });

  it("includes stack only when debug mode is enabled", async () => {
    const { buildCliErrorEnvelope } = await import("../../src/cli/import");

    const envelope = buildCliErrorEnvelope(new Error("boom"), true);
    expect(envelope.stack).toContain("Error: boom");
  });

  it("logs a sanitized envelope and exits with code 1 on failure", async () => {
    process.env = { ...envSnapshot, DEBUG: "0" };

    const runImport = jest.fn().mockRejectedValue(Object.assign(new Error("bad import"), {
      name: "ImportFatalError",
      code: "transform_unexpected",
      context: { page: 1, offset: 0, pageSize: 10, index: 0 },
      cause: { huge: "do-not-print-this" }
    }));

    jest.doMock("../../src/composition/root", () => ({ runImport }));

    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const exitSpy = jest.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`EXIT:${String(code)}`);
    }) as never);

    const { executeImportCli } = await import("../../src/cli/import");
    await expect(executeImportCli()).rejects.toThrow("EXIT:1");

    expect(runImport).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    const logged = String(errorSpy.mock.calls[0]?.[0] ?? "");
    expect(logged).toContain("\"event\":\"import.failed\"");
    expect(logged).toContain("\"code\":\"transform_unexpected\"");
    expect(logged).not.toContain("do-not-print-this");
    expect(logged).not.toContain("\"cause\"");
    expect(logged).not.toContain("\"stack\"");

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
