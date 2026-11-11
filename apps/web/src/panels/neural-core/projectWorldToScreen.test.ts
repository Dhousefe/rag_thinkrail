import { describe, expect, it } from "bun:test";
import { NeuralCoreEngine } from "./neuralEngine";

describe("NeuralCoreEngine - projectWorldToScreen", () => {
	it("projeta coordenadas 3D para tela sem NaN", () => {
		const canvas = {
			clientWidth: 1000,
			clientHeight: 800,
			width: 1000,
			height: 800,
			getContext: () => null,
		} as unknown as HTMLCanvasElement;

		const engine = new NeuralCoreEngine(canvas);
		const centerProj = engine.projectWorldToScreen([0, 0, 0], undefined, 1000, 800);

		expect(Number.isFinite(centerProj.x)).toBe(true);
		expect(Number.isFinite(centerProj.y)).toBe(true);
		expect(centerProj.depth).toBeGreaterThan(0);
		// Com câmera apontada para [0, 0, 0], o centro do mundo deve ficar próximo ao centro da tela (500, 400)
		expect(Math.abs(centerProj.x - 500)).toBeLessThan(5);
		expect(Math.abs(centerProj.y - 400)).toBeLessThan(5);
	});

	it("marca pontos muito distantes ou atrás da câmera como invisible", () => {
		const canvas = {
			clientWidth: 800,
			clientHeight: 600,
			width: 800,
			height: 600,
			getContext: () => null,
		} as unknown as HTMLCanvasElement;

		const engine = new NeuralCoreEngine(canvas);
		// Ponto localizado muito atrás da câmera na órbita
		const backProj = engine.projectWorldToScreen([0, 0, 9999], undefined, 800, 600);
		expect(backProj.visible).toBe(false);
	});
});
