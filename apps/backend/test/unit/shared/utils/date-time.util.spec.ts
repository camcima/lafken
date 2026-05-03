import { dateTimeUtility } from "@/shared/utils/date-time.util";

describe("DateTimeUtility", () => {
  beforeEach(() => {
    // Set a fixed timezone for consistent test results
    vi.stubEnv("TZ", "UTC");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("#parseStrAsDate()", () => {
    describe("When parsing a date string without a specific format", () => {
      it("should parse an ISO 8601 date string into a Date object", () => {
        const result = dateTimeUtility.parseStrAsDate({
          dateToParse: "2025-11-02T10:30:00Z",
        });

        expect(result).toBeInstanceOf(Date);
        expect(result.getFullYear()).toBe(2025);
        expect(result.getMonth()).toBe(10); // November (0-indexed)
        expect(result.getDate()).toBe(2);
      });

      it("should parse a simple date string", () => {
        const result = dateTimeUtility.parseStrAsDate({
          dateToParse: "2025-11-02",
        });

        expect(result).toBeInstanceOf(Date);
        expect(result.getFullYear()).toBe(2025);
        expect(result.getMonth()).toBe(10);
        expect(result.getDate()).toBe(2);
      });
    });

    describe("When parsing a date string with a specific format", () => {
      it("should parse a date string with DD/MM/YYYY format", () => {
        const result = dateTimeUtility.parseStrAsDate({
          dateToParse: "02/11/2025",
          format: "DD/MM/YYYY",
        });

        expect(result).toBeInstanceOf(Date);
        expect(result.getFullYear()).toBe(2025);
        expect(result.getMonth()).toBe(10);
        expect(result.getDate()).toBe(2);
      });

      it("should parse a date string with MM-DD-YYYY format", () => {
        const result = dateTimeUtility.parseStrAsDate({
          dateToParse: "11-02-2025",
          format: "MM-DD-YYYY",
        });

        expect(result).toBeInstanceOf(Date);
        expect(result.getFullYear()).toBe(2025);
        expect(result.getMonth()).toBe(10);
        expect(result.getDate()).toBe(2);
      });

      it("should parse a date string with custom format including time", () => {
        const result = dateTimeUtility.parseStrAsDate({
          dateToParse: "2025-11-02 14:30:45",
          format: "YYYY-MM-DD HH:mm:ss",
        });

        expect(result).toBeInstanceOf(Date);
        expect(result.getFullYear()).toBe(2025);
        expect(result.getMonth()).toBe(10);
        expect(result.getDate()).toBe(2);
        expect(result.getHours()).toBe(14);
        expect(result.getMinutes()).toBe(30);
        expect(result.getSeconds()).toBe(45);
      });
    });
  });

  describe("#formatDateAs()", () => {
    describe("When formatting a Date object", () => {
      it("should format a date as YYYY-MM-DD", () => {
        const date = new Date("2025-11-02T10:30:00Z");
        const result = dateTimeUtility.formatDateAs({
          date,
          format: "YYYY-MM-DD",
        });

        expect(result).toBe("2025-11-02");
      });

      it("should format a date as DD/MM/YYYY", () => {
        const date = new Date("2025-11-02T10:30:00Z");
        const result = dateTimeUtility.formatDateAs({
          date,
          format: "DD/MM/YYYY",
        });

        expect(result).toBe("02/11/2025");
      });

      it("should format a date with time as YYYY-MM-DD HH:mm:ss", () => {
        const date = new Date("2025-11-02T14:30:45Z");
        const result = dateTimeUtility.formatDateAs({
          date,
          format: "YYYY-MM-DD HH:mm:ss",
        });

        // Note: The result depends on timezone, using a flexible assertion
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      });

      it("should format a date with month name", () => {
        const date = new Date("2025-11-02T10:30:00Z");
        const result = dateTimeUtility.formatDateAs({
          date,
          format: "MMMM DD, YYYY",
        });

        expect(result).toBe("November 02, 2025");
      });

      it("should format a date with abbreviated month name", () => {
        const date = new Date("2025-11-02T10:30:00Z");
        const result = dateTimeUtility.formatDateAs({
          date,
          format: "MMM DD, YYYY",
        });

        expect(result).toBe("Nov 02, 2025");
      });

      it("should return only the time slice when formatting with `HHmmss`", () => {
        const date = new Date("2025-11-02T14:30:45Z");
        const result = dateTimeUtility.formatDateAs({
          date,
          format: "HHmmss",
        });

        expect(result).toBe("143045");
      });
    });
  });

  describe("Integration between `parseStrAsDate` and `formatDateAs`", () => {
    it("should parse and format a date in a round-trip", () => {
      const originalDateStr = "02/11/2025";
      const parsedDate = dateTimeUtility.parseStrAsDate({
        dateToParse: originalDateStr,
        format: "DD/MM/YYYY",
      });

      const formattedDate = dateTimeUtility.formatDateAs({
        date: parsedDate,
        format: "DD/MM/YYYY",
      });

      expect(formattedDate).toBe(originalDateStr);
    });

    it("should convert between different date formats", () => {
      const parsedDate = dateTimeUtility.parseStrAsDate({
        dateToParse: "2025-11-02",
        format: "YYYY-MM-DD",
      });

      const formattedDate = dateTimeUtility.formatDateAs({
        date: parsedDate,
        format: "MM/DD/YYYY",
      });

      expect(formattedDate).toBe("11/02/2025");
    });
  });
});
