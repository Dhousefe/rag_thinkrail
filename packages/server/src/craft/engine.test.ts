import { describe, expect, it } from "bun:test";
import { craftEngine } from "./engine";

describe("Craft Engine Pipeline", () => {
	it("initializes and executes pipeline end-to-end", async () => {
		const state = await craftEngine.startProject({
			target: "local://test-target",
			targetType: "website",
			mode: "clean_room",
			instructions: "Recriar layout responsivo",
		});

		expect(state.config.id).toBeDefined();
		expect(state.steps).toHaveLength(4);

		// Aguarda conclusão assíncrona do pipeline
		let iterations = 0;
		while (iterations < 20) {
			const curr = craftEngine.getProject(state.config.id);
			if (curr?.currentStep === "ready") break;
			await new Promise((r) => setTimeout(r, 50));
			iterations++;
		}

		const updated = craftEngine.getProject(state.config.id);
		expect(updated).toBeDefined();
		expect(updated?.steps[0].status).toBe("passed");
		expect(updated?.currentStep).toBe("ready");
		expect(updated?.similarityScore).toBeGreaterThan(90);
		expect(updated?.viewportDiffs.length).toBe(3);
	});
});
