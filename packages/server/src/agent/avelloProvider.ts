import { createProvider, envApiKeyAuth, type Model, type Provider } from "@earendil-works/pi-ai";
import { stream, streamSimple } from "@earendil-works/pi-ai/api/anthropic-messages";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";

export const AVELLO_PROVIDER_ID = "avello";
export const AVELLO_BASE_URL = "https://avellogateway.online";
export const AVELLO_DEFAULT_MODEL_ID = "Claude Opus 5.5-opus-5";

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

const AVELLO_MODELS: Model<"anthropic-messages">[] = [
	{
		id: "Claude Opus 5.5-opus-5",
		name: "Claude Opus 5.5",
		api: "anthropic-messages",
		provider: AVELLO_PROVIDER_ID,
		baseUrl: AVELLO_BASE_URL,
		reasoning: true,
		input: ["text", "image"],
		cost: ZERO_COST,
		contextWindow: 200_000,
		maxTokens: 8192,
		compat: {
			supportsStrictTools: true,
			forceAdaptiveThinking: true,
		},
		type: "chat",
	},
	{
		id: "Claude Opus 5.5-opus-4-8",
		name: "Claude Opus 5.5",
		api: "anthropic-messages",
		provider: AVELLO_PROVIDER_ID,
		baseUrl: AVELLO_BASE_URL,
		reasoning: true,
		input: ["text", "image"],
		cost: ZERO_COST,
		contextWindow: 200_000,
		maxTokens: 8192,
		compat: {
			supportsStrictTools: true,
		},
		type: "chat",
	},
	{
		id: "Claude Opus 5.5-sonnet-4-6",
		name: "Claude Opus 5.5",
		api: "anthropic-messages",
		provider: AVELLO_PROVIDER_ID,
		baseUrl: AVELLO_BASE_URL,
		reasoning: true,
		input: ["text", "image"],
		cost: ZERO_COST,
		contextWindow: 200_000,
		maxTokens: 8192,
		compat: {
			supportsStrictTools: true,
		},
		type: "chat",
	},
	{
		id: "Claude Opus 5.5-haiku-4-5",
		name: "Claude Opus 5.5",
		api: "anthropic-messages",
		provider: AVELLO_PROVIDER_ID,
		baseUrl: AVELLO_BASE_URL,
		reasoning: false,
		input: ["text", "image"],
		cost: ZERO_COST,
		contextWindow: 200_000,
		maxTokens: 8192,
		compat: {
			supportsStrictTools: true,
		},
		type: "chat",
	},
];

export function createAvelloProvider(): Provider {
	return createProvider({
		id: AVELLO_PROVIDER_ID,
		name: "Avello",
		baseUrl: AVELLO_BASE_URL,
		auth: {
			apiKey: envApiKeyAuth("Avello API key", ["AVELLO_API_KEY", "AVELLO_KEY"]),
		},
		models: AVELLO_MODELS,
		api: { stream, streamSimple },
	});
}

export function registerAvelloProvider(runtime: ModelRuntime): void {
	runtime.registerNativeProvider(createAvelloProvider());
}
