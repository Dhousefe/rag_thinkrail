import { describe, expect, it } from "bun:test";
import { OrbitCameraController } from "./cameraController";

describe("OrbitCameraController drag protection", () => {
	it("identifica quando houve arraste da câmera (wasJustDragging)", () => {
		const canvasListeners: Record<string, ((e: unknown) => void)[]> = {};
		const canvasMock = {
			addEventListener: (type: string, fn: (e: unknown) => void) => {
				canvasListeners[type] = canvasListeners[type] || [];
				canvasListeners[type].push(fn);
			},
		} as unknown as HTMLCanvasElement;

		const windowListeners: Record<string, ((e: unknown) => void)[]> = {};
		if (typeof window === "undefined") {
			Object.defineProperty(globalThis, "window", {
				value: {
					addEventListener: (type: string, fn: (e: unknown) => void) => {
						windowListeners[type] = windowListeners[type] || [];
						windowListeners[type].push(fn);
					},
				},
				writable: true,
				configurable: true,
			});
		}

		const controller = new OrbitCameraController(canvasMock);
		expect(controller.wasJustDragging()).toBe(false);

		// Simula mousedown
		for (const fn of canvasListeners.mousedown || []) {
			fn({ clientX: 100, clientY: 100, button: 0, shiftKey: false });
		}
		expect(controller.wasJustDragging()).toBe(false);

		// Simula mousemove com arraste amplo (> 4px)
		for (const fn of windowListeners.mousemove || []) {
			fn({ clientX: 150, clientY: 140 });
		}

		// Durante o arraste, deve reportar dragging ativo
		expect(controller.wasJustDragging()).toBe(true);

		// Simula mouseup
		for (const fn of windowListeners.mouseup || []) {
			fn({});
		}

		// Imediatamente após mouseup (dentro da janela de 250ms), ainda reporta wasJustDragging = true
		expect(controller.wasJustDragging()).toBe(true);
	});

	it("calcula fitBounds estável com múltiplos nós sem NaN", () => {
		const canvasMock = {
			addEventListener: () => {},
		} as unknown as HTMLCanvasElement;

		const controller = new OrbitCameraController(canvasMock);
		const mockPositions: Array<[number, number, number]> = [
			[-15, 0, -10],
			[12, 0.05, 30],
			[0, -0.04, 5],
		];

		controller.fitBounds(mockPositions);
		expect(controller.distance).toBeGreaterThanOrEqual(5.2);
		expect(Number.isFinite(controller.target[0])).toBe(true);
		expect(Number.isFinite(controller.target[1])).toBe(true);
		expect(Number.isFinite(controller.target[2])).toBe(true);
	});
});
