export class OrbitCameraController {
	private canvas: HTMLCanvasElement;
	private isDragging = false;
	private dragMode: "orbit" | "pan" = "orbit";
	private lastMouseX = 0;
	private lastMouseY = 0;
	private totalDragDistance = 0;
	private lastDragEndTime = 0;

	public theta = 0.6;
	public phi = 0.45;
	public distance = 5.2;
	public target: [number, number, number] = [0, 0, 0];

	private cameraSnapshot: {
		targetX: number;
		targetY: number;
		targetZ: number;
		theta: number;
		phi: number;
		distance: number;
	} | null = null;
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
			this.totalDragDistance = 0;
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
			this.totalDragDistance += Math.hypot(dx, dy);
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

				this.target[0] += (rightX * dx - upX * dy) * panFactor;
				this.target[1] += -upY * dy * panFactor;
				this.target[2] += (rightZ * dx - upZ * dy) * panFactor;
			} else {
				// Rotação Orbital invertida para movimentação natural solicitada pelo usuário
				this.theta += dx * 0.008;
				this.phi = Math.max(-1.5, Math.min(1.5, this.phi - dy * 0.008));
			}
			this.onUpdate?.();
		});

		window.addEventListener("mouseup", () => {
			if (this.totalDragDistance > 4) {
				this.lastDragEndTime = Date.now();
			}
			this.isDragging = false;
		});

		this.canvas.addEventListener(
			"wheel",
			(e) => {
				e.preventDefault();
				this.flyTarget = null;
				// Zoom responsivo e progressivo: amplo alcance [0.3 a 60.0]
				const zoomStep = (e.deltaY > 0 ? 1 : -1) * Math.max(0.08, this.distance * 0.09);
				this.distance = Math.max(0.3, Math.min(60.0, this.distance + zoomStep));
				this.onUpdate?.();
			},
			{ passive: false },
		);
	}

	public wasJustDragging(thresholdMs = 250): boolean {
		return (
			Date.now() - this.lastDragEndTime < thresholdMs ||
			(this.isDragging && this.totalDragDistance > 4)
		);
	}

	public panBy(deltaX: number, deltaY: number) {
		this.flyTarget = null;
		const panFactor = Math.max(0.001, this.distance * 0.0022);

		// Vetor Right da câmera no plano horizontal
		const rightX = Math.cos(this.theta);
		const rightZ = -Math.sin(this.theta);

		// Vetor Up da câmera
		const upX = -Math.sin(this.phi) * Math.sin(this.theta);
		const upY = Math.cos(this.phi);
		const upZ = -Math.sin(this.phi) * Math.cos(this.theta);

		this.target[0] -= (rightX * deltaX - upX * deltaY) * panFactor;
		this.target[1] -= -upY * deltaY * panFactor;
		this.target[2] -= (rightZ * deltaX - upZ * deltaY) * panFactor;
		this.onUpdate?.();
	}

	public panLeft(step = 120) {
		this.panBy(step, 0);
	}

	public panRight(step = 120) {
		this.panBy(-step, 0);
	}

	public panUp(step = 120) {
		this.panBy(0, step);
	}

	public panDown(step = 120) {
		this.panBy(0, -step);
	}

	public setPcbTopView() {
		this.flyTarget = {
			targetX: this.target[0],
			targetY: 0,
			targetZ: this.target[2],
			theta: 0,
			phi: 1.25, // Visão zenital de placa PCB
			distance: Math.max(4.2, this.distance),
		};
		this.onUpdate?.();
	}

	public zoomIn() {
		this.flyTarget = null;
		this.distance = Math.max(0.3, this.distance * 0.78);
		this.onUpdate?.();
	}

	public zoomOut() {
		this.flyTarget = null;
		this.distance = Math.min(60.0, this.distance * 1.25);
		this.onUpdate?.();
	}

	public focusPosition(pos: [number, number, number], targetDist = 2.0) {
		const [x, y, z] = pos;
		// Centraliza o target no nó desejado com ângulo de visão ideal para polígonos e métodos
		this.flyTarget = {
			targetX: x,
			targetY: y,
			targetZ: z,
			theta: this.theta,
			phi: Math.max(0.25, Math.min(0.65, this.phi)),
			distance: targetDist,
		};
	}

	public updateTween() {
		if (!this.flyTarget) return;

		// Normalização da menor distância angular para evitar voltas de 360° e teleportes bruscos
		let diffT = this.flyTarget.theta - this.theta;
		while (diffT > Math.PI) diffT -= Math.PI * 2;
		while (diffT < -Math.PI) diffT += Math.PI * 2;

		const diffP = this.flyTarget.phi - this.phi;
		const diffD = this.flyTarget.distance - this.distance;
		const diffTx = this.flyTarget.targetX - this.target[0];
		const diffTy = this.flyTarget.targetY - this.target[1];
		const diffTz = this.flyTarget.targetZ - this.target[2];

		const isClose =
			Math.abs(diffT) < 0.003 &&
			Math.abs(diffP) < 0.003 &&
			Math.abs(diffD) < 0.008 &&
			Math.abs(diffTx) < 0.003 &&
			Math.abs(diffTy) < 0.003 &&
			Math.abs(diffTz) < 0.003;

		if (isClose) {
			this.theta = this.flyTarget.theta;
			this.phi = this.flyTarget.phi;
			this.distance = this.flyTarget.distance;
			this.target[0] = this.flyTarget.targetX;
			this.target[1] = this.flyTarget.targetY;
			this.target[2] = this.flyTarget.targetZ;
			// Ao concluir a animação do fly-to, limpe cameraSnapshot somente se ela corresponde ao destino
			if (this.cameraSnapshot) {
				const snapMatches =
					Math.abs(this.cameraSnapshot.targetX - this.target[0]) < 0.01 &&
					Math.abs(this.cameraSnapshot.targetY - this.target[1]) < 0.01 &&
					Math.abs(this.cameraSnapshot.targetZ - this.target[2]) < 0.01;
				if (snapMatches) {
					this.cameraSnapshot = null;
				}
			}
			this.flyTarget = null;
			this.onUpdate?.();
			return;
		}

		// Easing constante suave sem saltos
		const factor = 0.16;
		this.theta += diffT * factor;
		this.phi += diffP * factor;
		this.distance += diffD * factor;
		this.target[0] += diffTx * factor;
		this.target[1] += diffTy * factor;
		this.target[2] += diffTz * factor;
		this.onUpdate?.();
	}

	/**
	 * Salva o estado atual da câmera (posição de foco, ângulo e distância).
	 * Utilizado antes de selecionar/focar um nó, para permitir restaurar a visualização.
	 */
	public saveCameraSnapshot() {
		this.cameraSnapshot = {
			targetX: this.target[0],
			targetY: this.target[1],
			targetZ: this.target[2],
			theta: this.theta,
			phi: this.phi,
			distance: this.distance,
		};
	}

	/**
	 * Restaura suavemente o estado salvo anteriormente na câmera, se existir.
	 */
	public restoreCameraSnapshot(): boolean {
		if (!this.cameraSnapshot) return false;
		// Protege a restauração colocando o flyTarget e preservando uma cópia
		const snapshot = { ...this.cameraSnapshot };
		this.flyTarget = {
			targetX: snapshot.targetX,
			targetY: snapshot.targetY,
			targetZ: snapshot.targetZ,
			theta: snapshot.theta,
			phi: snapshot.phi,
			distance: snapshot.distance,
		};
		// Não limpe o cameraSnapshot imediatamente: somente ao concluir a animação
		// para evitar que chamadas intermediárias (setSelectedNode etc.) descartem a restauração.
		this.onUpdate?.();
		return true;
	}

	/**
	 * Limpa o snapshot salvo sem restaurar.
	 */
	public clearCameraSnapshot() {
		this.cameraSnapshot = null;
	}

	public reset() {
		this.flyTarget = {
			targetX: 0,
			targetY: -0.4,
			targetZ: 0,
			theta: 0.6,
			phi: 0.55,
			distance: 5.2,
		};
		this.onUpdate?.();
	}

	/**
	 * Enquadra perfeitamente todos os nós informados dentro do campo de visão da câmera,
	 * elevando o enquadramento vertical para exibir na área superior/central livre da tela.
	 */
	public fitBounds(positions: Array<[number, number, number]>, margin = 1.6) {
		if (!positions || positions.length === 0) {
			this.reset();
			return;
		}

		let minX = Infinity,
			maxX = -Infinity;
		let minY = Infinity,
			maxY = -Infinity;
		let minZ = Infinity,
			maxZ = -Infinity;

		for (const [x, y, z] of positions) {
			if (x < minX) minX = x;
			if (x > maxX) maxX = x;
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
			if (z < minZ) minZ = z;
			if (z > maxZ) maxZ = z;
		}

		const centerX = (minX + maxX) / 2;
		const centerY = (minY + maxY) / 2;
		const centerZ = (minZ + maxZ) / 2;

		// Calcula o raio máximo a partir do centro
		let maxRadius = 0.5;
		for (const [x, y, z] of positions) {
			const r = Math.hypot(x - centerX, y - centerY, z - centerZ);
			if (r > maxRadius) maxRadius = r;
		}

		// Com FOV de 45 deg (~0.785 rad), distância = raio / tan(FOV / 2) * margem
		const fitDist = Math.max(2.8, Math.min(50.0, maxRadius * 2.4 * margin));

		// Offset vertical (-fitDist * 0.12) para que o grafo fique na metade superior/central da tela
		this.flyTarget = {
			targetX: centerX,
			targetY: centerY - fitDist * 0.12,
			targetZ: centerZ,
			theta: this.theta,
			phi: 0.55,
			distance: fitDist,
		};
		this.onUpdate?.();
	}
}
