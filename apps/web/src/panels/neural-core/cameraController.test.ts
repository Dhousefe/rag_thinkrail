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

	it("salva e restaura suavemente snapshot de pose de câmera com tween", () => {
		const canvasMock = {
			addEventListener: () => {},
		} as unknown as HTMLCanvasElement;

		const controller = new OrbitCameraController(canvasMock);
		controller.target = [5, 2, -3];
		controller.theta = 1.2;
		controller.phi = 0.5;
		controller.distance = 10.0;

		// Salva o snapshot da pose inicial
		controller.saveCameraSnapshot();

		// Foca em um nó distante
		controller.focusPosition([20, 0, 50], 2.5);

		// Atualiza tween para mover câmera para o novo nó focado
		for (let i = 0; i < 30; i++) {
			controller.updateTween();
		}
		expect(controller.distance).toBeLessThan(5.0);

		// Restaura o snapshot
		const restored = controller.restoreCameraSnapshot();
		expect(restored).toBe(true);

		// Executa o tween de retorno
		for (let i = 0; i < 40; i++) {
			controller.updateTween();
		}

		// Deve ter voltado próximo dos valores originais
		expect(controller.target[0]).toBeCloseTo(5, 1);
		expect(controller.target[1]).toBeCloseTo(2, 1);
		expect(controller.target[2]).toBeCloseTo(-3, 1);
		expect(controller.distance).toBeCloseTo(10.0, 1);

		// Segunda restauração sem novo snapshot deve retornar false
		expect(controller.restoreCameraSnapshot()).toBe(false);
	});
});
