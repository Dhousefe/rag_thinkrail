import { describe, expect, it } from "bun:test";
import { calculateVisualSimilarity, inspectBinaryTarget, inspectWebTarget, parseSelfTestOutput } from "./index";

describe("Craft Analysis Tools", () => {
	it("inspectWebTarget returns structured default metadata", async () => {
		const info = await inspectWebTarget("https://example.com");
		expect(info).toBeDefined();
		expect(info.viewports.desktop).toBe("1280x800");
		expect(info.colors.length).toBeGreaterThan(0);
	});

	it("inspectBinaryTarget handles missing file gracefully", async () => {
		const binInfo = await inspectBinaryTarget("non-existent-binary.exe");
		expect(binInfo.fileType).toBe("unknown");
		expect(binInfo.sizeBytes).toBe(0);
		expect(binInfo.interestingStrings).toEqual([]);
	});

	it("calculateVisualSimilarity yields multi-viewport scores", () => {
		const diffs = calculateVisualSimilarity();
		expect(diffs).toHaveLength(3);
		expect(diffs[0].viewport).toBe("desktop");
		expect(diffs[0].similarityScore).toBeGreaterThanOrEqual(90);
	});

	it("parseSelfTestOutput defaults gracefully with standard 3-step loop", async () => {
		const report = await parseSelfTestOutput("missing-self-test.json");
		expect(report.version).toBe(1);
		expect(report.passed).toBe(true);
		expect(report.totalSteps).toBe(3);
	});
});
