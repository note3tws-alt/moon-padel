import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { parseDate, parseTime } from "./process";
import { suggestMapping } from "./fields";
import { parseSetScores, summariseSets } from "../utils";

describe("import parsing", () => {
  it("reads common date formats, with DD/MM for slashes", () => {
    expect(parseDate("2026-11-15")).toBe("2026-11-15");
    expect(parseDate("15/11/2026")).toBe("2026-11-15");
    expect(parseDate("5.12.26")).toBe("2026-12-05");
    expect(parseDate("15 Nov 2026")).toBe("2026-11-15");
    expect(parseDate("Nov 15, 2026")).toBe("2026-11-15");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("tomorrow")).toBeNull();
  });
  it("reads times", () => {
    expect(parseTime("19:30")).toBe("19:30");
    expect(parseTime("7:30 PM")).toBe("19:30");
    expect(parseTime("12am")).toBe("00:00");
    expect(parseTime("25:00")).toBeNull();
  });
  it("parses scores and winners", () => {
    expect(parseSetScores("6-4, 3-6, 10-8")).toEqual([[6, 4], [3, 6], [10, 8]]);
    expect(parseSetScores("6:2 6/3")).toEqual([[6, 2], [6, 3]]);
    expect(parseSetScores("6-x")).toBeNull();
    expect(summariseSets([[6, 4], [3, 6], [10, 8]]).winner).toBe("A");
    expect(summariseSets([[4, 6]]).winner).toBe("B");
  });
  it("auto-maps differently named columns", () => {
    const m = suggestMapping("players", ["Name", "E-mail", "Mobile", "Level", "RTG", "Player ID"]);
    expect(m).toMatchObject({ full_name: "Name", email: "E-mail", phone: "Mobile", division: "Level", rating: "RTG", player_code: "Player ID" });
  });
});
