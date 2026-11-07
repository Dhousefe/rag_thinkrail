import { afterEach, describe, expect, it } from "bun:test";
import { JinaServerManager } from "./jinaServerManager";

describe("JinaServerManager", () => {
	afterEach(() => {
		JinaServerManager.resetInstanceForTesting();
	});

	it("creates singleton instance with stopped status", () => {
		const instance = JinaServerManager.getInstance();
		const info = instance.getInfo();
		expect(info.status).toBe("stopped");
		expect(info.model).toBe("jina-embeddings-v2-base-code");
		expect(instance.baseUrl).toContain("127.0.0.1");
	});

	it("can start and stop heartbeat watcher cleanly without leaks", () => {
		const instance = JinaServerManager.getInstance();
		instance.startHeartbeatWatcher();
		instance.stopHeartbeatWatcher();
		expect(instance.getInfo().status).toBe("stopped");
	});

	it("disposes cleanly and resets instance", () => {
		const instance = JinaServerManager.getInstance();
		instance.dispose();
		expect(instance.getInfo().status).toBe("stopped");
		JinaServerManager.resetInstanceForTesting();
	});
});
