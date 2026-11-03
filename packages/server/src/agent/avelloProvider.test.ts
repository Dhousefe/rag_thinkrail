import { expect, test } from "bun:test";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import {
	AVELLO_BASE_URL,
	AVELLO_DEFAULT_MODEL_ID,
	AVELLO_PROVIDER_ID,
	createAvelloProvider,
	registerAvelloProvider,
} from "./avelloProvider";
import { HOST_DEFAULT_MODEL_PER_PROVIDER } from "./modelDefaults";

test("createAvelloProvider configures Anthropic-compatible gateway and models", () => {
	const provider = createAvelloProvider();
	expect(provider.id).toBe(AVELLO_PROVIDER_ID);
	expect(provider.name).toBe("Avello");
	expect(provider.baseUrl).toBe(AVELLO_BASE_URL);
	expect(provider.auth.apiKey).toBeDefined();

	const defaultModel = provider.getModels().find((m) => m.id === AVELLO_DEFAULT_MODEL_ID);
	expect(defaultModel).toBeDefined();
	expect(defaultModel?.api).toBe("anthropic-messages");
	expect(defaultModel?.contextWindow).toBe(200_000);
	expect(defaultModel?.provider).toBe(AVELLO_PROVIDER_ID);
	expect(HOST_DEFAULT_MODEL_PER_PROVIDER.avello).toBe("Claude Opus 5.5-opus-5");
});

test("registerAvelloProvider registers with ModelRuntime", async () => {
	const runtime = await ModelRuntime.create({
		allowModelNetwork: false,
		modelsPath: null,
		refreshOnCreate: false,
	});
	registerAvelloProvider(runtime);

	const provider = runtime.getProvider(AVELLO_PROVIDER_ID);
	expect(provider).toBeDefined();
	expect(provider?.name).toBe("Avello");

	const models = runtime.getModels(AVELLO_PROVIDER_ID);
	expect(models.some((m) => m.id === "Claude Opus 5.5-opus-5")).toBe(true);
});
