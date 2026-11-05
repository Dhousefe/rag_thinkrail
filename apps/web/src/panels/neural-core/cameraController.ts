export class OrbitCameraController {
	private canvas: HTMLCanvasElement;
	private isDragging = false;
	private dragMode: "orbit" | "pan" = "orbit";
	private lastMouseX = 0;
	private lastMouseY = 0;

	public theta = 0.5;
	public phi = 0.35;
	public distance = 5.6;
	public target: [number, number, number] = [0, 0, 0];

	private flyTarget: {
		targetX: number;
		targetY: number;
		targetZ: number;
		theta: number;
		phi: number;
		distance: number;
	} | null = null;
	private onUpdate?: (() => void) | undefined;

	constructor(canvas: HTMLCanvasElement, onUpdate?: (() => void) | undefined) {
		this.canvas = canvas;
		this.onUpdate = onUpdate;
		this.attachEvents();
	}

	private attachEvents() {
		this.canvas.addEventListener("contextmenu", (e) => {
			e.preventDefault(); // Previne menu de contexto para habilitar Pan com botão direito
		});

		this.canvas.addEventListener("mousedown", (e) => {
			this.flyTarget = null; // Interrompe fly-to caso o usuário comece a mover manualmente
			this.isDragging = true;
			this.lastMouseX = e.clientX;
			this.lastMouseY = e.clientY;

			// Botão direito, botão do meio ou Shift+Clique ativa modo Pan (arraste lateral do grafo)
			if (e.button === 2 || e.button === 1 || e.shiftKey) {
				this.dragMode = "pan";
			} else {
				this.dragMode = "orbit";
			}
		});

		window.addEventListener("mousemove", (e) => {
			if (!this.isDragging) return;
			const dx = e.clientX - this.lastMouseX;
			const dy = e.clientY - this.lastMouseY;
			this.lastMouseX = e.clientX;
			this.lastMouseY = e.clientY;

			if (this.dragMode === "pan") {
				// Pan 3D: translada o target ao longo dos vetores de câmera (Right e Up)
				const panFactor = Math.max(0.001, this.distance * 0.0016);

				// Vetor Right da câmera
				const rightX = Math.cos(this.theta);
				const rightZ = -Math.sin(this.theta);

				// Vetor Up da câmera
				const upX = -Math.sin(this.phi) * Math.sin(this.theta);
				const upY = Math.cos(this.phi);
				const upZ = -Math.sin(this.phi) * Math.cos(this.theta);

				this.target[0] -= (rightX * dx - upX * dy) * panFactor;
				this.target[1] -= (-upY * dy) * panFactor;
				this.target[2] -= (rightZ * dx - upZ * dy) * panFactor;
			} else {
				// Rotação Orbital
				this.theta -= dx * 0.008;
				this.phi = Math.max(-1.4, Math.min(1.4, this.phi + dy * 0.008));
			}
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

	public zoomIn() {
		this.flyTarget = null;
		this.distance = Math.max(1.2, this.distance * 0.8);
		this.onUpdate?.();
	}

	public zoomOut() {
		this.flyTarget = null;
		this.distance = Math.min(22.0, this.distance * 1.25);
		this.onUpdate?.();
	}

	public focusPosition(pos: [number, number, number], targetDist = 2.4) {
		const [x, y, z] = pos;
		// Centraliza o target no nó desejado e interpola suavemente a câmera
		this.flyTarget = {
			targetX: x,
			targetY: y,
			targetZ: z,
			theta: this.theta,
			phi: this.phi,
			distance: targetDist,
		};
	}

	public updateTween() {
		if (!this.flyTarget) return;
		const diffT = this.flyTarget.theta - this.theta;
		const diffP = this.flyTarget.phi - this.phi;
		const diffD = this.flyTarget.distance - this.distance;
		const diffTx = this.flyTarget.targetX - this.target[0];
		const diffTy = this.flyTarget.targetY - this.target[1];
		const diffTz = this.flyTarget.targetZ - this.target[2];

		const isClose =
			Math.abs(diffT) < 0.005 &&
			Math.abs(diffP) < 0.005 &&
			Math.abs(diffD) < 0.01 &&
			Math.abs(diffTx) < 0.005 &&
			Math.abs(diffTy) < 0.005 &&
			Math.abs(diffTz) < 0.005;

		if (isClose) {
			this.theta = this.flyTarget.theta;
			this.phi = this.flyTarget.phi;
			this.distance = this.flyTarget.distance;
			this.target[0] = this.flyTarget.targetX;
			this.target[1] = this.flyTarget.targetY;
			this.target[2] = this.flyTarget.targetZ;
			this.flyTarget = null;
			this.onUpdate?.();
			return;
		}

		this.theta += diffT * 0.15;
		this.phi += diffP * 0.15;
		this.distance += diffD * 0.15;
		this.target[0] += diffTx * 0.15;
		this.target[1] += diffTy * 0.15;
		this.target[2] += diffTz * 0.15;
		this.onUpdate?.();
	}

	public reset() {
		this.flyTarget = null;
		this.theta = 0.5;
		this.phi = 0.35;
		this.distance = 5.6;
		this.target = [0, 0, 0];
		this.onUpdate?.();
	}
}
