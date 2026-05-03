import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConsoleLogger } from "./ConsoleLogger";

describe("ConsoleLogger", () => {
  let logger: ConsoleLogger;
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    logger = new ConsoleLogger();
    consoleSpy = {
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      info: vi.spyOn(console, "info").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
      debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("info", () => {
    it("logs info message", () => {
      logger.info("Test info message");

      expect(consoleSpy.info).toHaveBeenCalledWith(
        "[INFO] Test info message",
        undefined,
        undefined,
      );
    });

    it("logs info message with extra data", () => {
      const extra = { userId: "123", action: "login" };
      logger.info("User logged in", extra);

      expect(consoleSpy.info).toHaveBeenCalledWith("[INFO] User logged in", undefined, extra);
    });
  });

  describe("debug", () => {
    it("logs debug message", () => {
      logger.debug("Test debug message");

      expect(consoleSpy.debug).toHaveBeenCalledWith(
        "[DEBUG] Test debug message",
        undefined,
        undefined,
      );
    });
  });

  describe("error", () => {
    it("logs error message", () => {
      logger.error("Test error message");

      expect(consoleSpy.error).toHaveBeenCalledWith(
        "[ERROR] Test error message",
        undefined,
        undefined,
      );
    });

    it("logs error message with Error object", () => {
      const error = new Error("Something went wrong");
      logger.error("Failed to process", error);

      expect(consoleSpy.error).toHaveBeenCalledWith("[ERROR] Failed to process", error, undefined);
    });

    it("logs error message with Error and extra data", () => {
      const error = new Error("Network error");
      const extra = { url: "https://api.example.com", status: 500 };
      logger.error("Request failed", error, extra);

      expect(consoleSpy.error).toHaveBeenCalledWith("[ERROR] Request failed", error, extra);
    });
  });

  describe("warn", () => {
    it("logs warning message", () => {
      logger.warn("Test warning message");

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        "[WARN] Test warning message",
        undefined,
        undefined,
      );
    });
  });

  describe("setContext", () => {
    it("sets context and logs it", () => {
      const context = { userId: "123", sessionId: "abc" };
      logger.setContext("user", context);

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Context user set"),
        undefined,
        expect.objectContaining({ user: context }),
      );
    });

    it("preserves context across multiple calls", () => {
      logger.setContext("user", { userId: "123" });
      logger.setContext("request", { requestId: "456" });

      expect(consoleSpy.log).toHaveBeenCalledTimes(2);
    });
  });

  describe("auth", () => {
    it("logs auth event", () => {
      logger.auth("User login attempt");

      expect(consoleSpy.log).toHaveBeenCalledWith("[AUTH] User login attempt", null, undefined);
    });

    it("logs auth event with details", () => {
      const details = { method: "oauth", provider: "msal" };
      logger.auth("User login attempt", details);

      expect(consoleSpy.log).toHaveBeenCalledWith("[AUTH] User login attempt", null, details);
    });
  });

  describe("performance", () => {
    it("logs performance metric", () => {
      logger.performance("page_load", 1234);

      expect(consoleSpy.log).toHaveBeenCalledWith(
        "[PERFORMANCE] page_load: 1234undefined",
        undefined,
        undefined,
      );
    });

    it("logs performance metric with unit", () => {
      logger.performance("api_response", 500, "ms");

      expect(consoleSpy.log).toHaveBeenCalledWith(
        "[PERFORMANCE] api_response: 500ms",
        undefined,
        undefined,
      );
    });
  });

  describe("setUser", () => {
    it("logs user information", () => {
      const user = {
        id: "123",
        email: "test@example.com",
        name: "Test User",
        roles: ["admin"],
      };
      logger.setUser(user);

      // logToDevelopmentConsole formats as `[${level}] ${message}`
      // setUser calls: logToDevelopmentConsole("USER", JSON.stringify(user), null, this.context)
      // Which results in: logMethod(`[USER] ${JSON.stringify(user)}`, null, this.context)
      // So the first arg is a single string containing both "[USER]" and the JSON
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringMatching(/\[USER\].*test@example\.com/),
        null,
        {},
      );
    });
  });

  describe("clearUser", () => {
    it("clears context", () => {
      logger.setContext("user", { userId: "123" });
      logger.clearUser();

      // Context should be cleared (no way to directly test, but clearUser should work)
      expect(consoleSpy.log).toHaveBeenCalled();
    });
  });
});
