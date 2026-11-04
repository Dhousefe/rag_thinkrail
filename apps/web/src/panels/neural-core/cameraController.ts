export class OrbitCameraController {
	private canvas: HTMLCanvasElement;
	private isDragging = false;
	private lastMouseX = 0;
	private lastMouseY = 0;

	public theta = 0.5;
	public phi = 0.35;
	public distance = 5.6;

	private flyTarget: { theta: number; phi: number; distance: number } | null = null;
	private onUpdate?: (() => void) | undefined;

	constructor(canvas: HTMLCanvasElement, onUpdate?: (() => void) | undefined) {
		this.canvas = canvas;
		this.onUpdate = onUpdate;
		this.attachEvents();
	}

	private attachEvents() {
		this.canvas.addEventListener("mousedown", (e) => {
			this.flyTarget = null; // Interrompe fly-to caso o usuário comece a mover manualmente
			this.isDragging = true;
			this.lastMouseX = e.clientX;
			this.lastMouseY = e.clientY;
		});

		window.addEventListener("mousemove", (e) => {
			if (!this.isDragging) return;
			const dx = e.clientX - this.lastMouseX;
			const dy = e.clientY - this.lastMouseY;
			this.lastMouseX = e.clientX;
			this.lastMouseY = e.clientY;

			this.theta -= dx * 0.008;
			this.phi = Math.max(-1.4, Math.min(1.4, this.phi + dy * 0.008));
			this.onUpdate?.();
		});

		window.addEventListener("mouseup", () => {
			this.isDragging = false;
		});

		this.canvas.addEventListener(
			"wheel",
			(e) => {
				e.preventDefault();
				this.flyTarget = null;
				// Zoom responsivo de 1.2 (close-up detalhado) até 22.0 (visão macro panorâmica)
				const zoomStep = (e.deltaY > 0 ? 1 : -1) * Math.max(0.2, this.distance * 0.08);
				this.distance = Math.max(1.2, Math.min(22.0, this.distance + zoomStep));
				this.onUpdate?.();
			},
			{ passive: false },
		);
	}

	public focusPosition(pos: [number, number, number], targetDist = 2.4) {
		const [x, y, z] = pos;
		const len = Math.sqrt(x * x + y * y + z * z) || 1;
		const targetTheta = Math.atan2(x, z);
		const targetPhi = Math.asin(Math.max(-0.95, Math.min(0.95, y / len)));
		this.flyTarget = { theta: targetTheta, phi: targetPhi, distance: targetDist };
	}

	public updateTween() {
		if (!this.flyTarget) return;
		const diffT = this.flyTarget.theta - this.theta;
		const diffP = this.flyTarget.phi - this.phi;
		const diffD = this.flyTarget.distance - this.distance;

		if (Math.abs(diffT) < 0.005 && Math.abs(diffP) < 0.005 && Math.abs(diffD) < 0.01) {
			this.theta = this.flyTarget.theta;
			this.phi = this.flyTarget.phi;
			this.distance = this.flyTarget.distance;
			this.flyTarget = null;
			this.onUpdate?.();
			return;
		}

		this.theta += diffT * 0.15;
		this.phi += diffP * 0.15;
		this.distance += diffD * 0.15;
		this.onUpdate?.();
	}

	public reset() {
		this.flyTarget = null;
		this.theta = 0.5;
		this.phi = 0.35;
		this.distance = 5.6;
		this.onUpdate?.();
	}
}
