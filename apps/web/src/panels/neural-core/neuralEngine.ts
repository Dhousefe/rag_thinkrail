import {
	computeNodeRelations,
	createDodecahedronWireframe,
	createGimbalRingsWireframe,
	createIcosahedronWireframe,
	createMerkabaWireframe,
	createTesseractWireframe,
	createToolNodeSatellites,
	createTorusWireframe,
	createVectorConstellationWireframe,
	type GeometryMeshData,
	type GeometryShapeType,
	type VectorEdgeInput,
	type VectorNodeInput,
} from "./geometry";
import { GEOMETRY_RENDER_WGSL } from "./shaders.wgsl";
import type { NeuralActivityState, NeuralTelemetryState } from "./types";

const GPU_BUFFER_USAGE = {
	UNIFORM: 0x0040,
	VERTEX: 0x0020,
	INDEX: 0x0010,
	COPY_DST: 0x0008,
};

export class NeuralCoreEngine {
	private canvas: HTMLCanvasElement;
	private device: GPUDevice | null = null;
	private context: GPUCanvasContext | null = null;
	private renderPipeline: GPURenderPipeline | null = null;

	// Forma primária e geometria central decorativa removidas para visualização clara do grafo RAG
	public activeShape: GeometryShapeType = "tesseract";
	public showVectorConstellation = true;
	public showGimbalRings = false;
	public showCentralPolygon = false;

	private primaryMesh: GeometryMeshData;
	private gimbalMesh: GeometryMeshData;
	private satelliteMesh: GeometryMeshData;
	private vectorMesh: GeometryMeshData | null = null;

	// Buffers GPU
	private primaryVBuffer: GPUBuffer | null = null;
	private primaryIBuffer: GPUBuffer | null = null;
	private gimbalVBuffer: GPUBuffer | null = null;
	private gimbalIBuffer: GPUBuffer | null = null;
	private satelliteVBuffer: GPUBuffer | null = null;
	private satelliteIBuffer: GPUBuffer | null = null;
	private vectorVBuffer: GPUBuffer | null = null;
	private vectorIBuffer: GPUBuffer | null = null;

	private cameraBuffer: GPUBuffer | null = null;
	private renderBindGroup: GPUBindGroup | null = null;

	private isRunning = false;
	private animationFrameId: number | null = null;
	private lastTime = performance.now();
	private isWebGpuSupported = false;

	// Rotações e ângulos
	private angleRotation = 0;
	private angleRingPitch = 0;
	private angleRingRoll = 0;
	private angleRingYaw = 0;

	// Fallback 2D
	private ctx2d: CanvasRenderingContext2D | null = null;

	// Dados do Grafo Vetorial RAG
	public vectorNodes: VectorNodeInput[] = [];
	public vectorEdges: VectorEdgeInput[] = [];
	public highlightedNodeIndex: number | null = null;
	public selectedNodeIndex: number | null = null;
	public cursorScreenCoord: { x: number; y: number } | null = null;
	public isRagActive = false;
	public showPcbLines = true;
	public activeSearchQuery: string | null = null;
	private currentMotionSpeed = 0.0;
	private lastPulseMeshUpdate = 0;

	// Telemetria
	public telemetry: NeuralTelemetryState = {
		activity: "idle",
		intensity: 0.1,
		tokenStreamingSpeed: 0,
		shockwavePulse: 0,
		electricArcsCount: 0,
	};

	// Câmera
	public cameraOrbit: {
		theta: number;
		phi: number;
		distance: number;
		target: [number, number, number];
	} = { theta: 0.45, phi: 0.35, distance: 4.8, target: [0, 0, 0] };
	public isPaused = false;
	public searchingNodeId: string | null = null;
	public searchAnimStartTime = 0;
	public readonly searchAnimDurationMs = 2000;
	public onPauseChange?: ((isPaused: boolean) => void) | undefined;
	public visibleModules: Set<string> = new Set();
	public onFrameMetrics?: ((fps: number, elementsCount: number) => void) | undefined;
	public onBeforeRenderFrame?: (() => void) | undefined;
	private frameCounter = 0;
	private fpsTimer = performance.now();
	private currentFps = 60;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.primaryMesh = this.generatePrimaryMesh("tesseract", 0);
		this.gimbalMesh = createGimbalRingsWireframe([1.9, 2.3, 2.7], 64);
		this.satelliteMesh = createToolNodeSatellites(6, 3.2);
	}

	private generatePrimaryMesh(shape: GeometryShapeType, angle: number): GeometryMeshData {
		switch (shape) {
			case "tesseract":
				return createTesseractWireframe(1.2, angle * 0.7);
			case "icosahedron":
				return createIcosahedronWireframe(1.3);
			case "merkaba":
				return createMerkabaWireframe(1.3);
			case "torus":
				return createTorusWireframe(1.3, 0.45, 24, 16);
			case "dodecahedron":
				return createDodecahedronWireframe(1.25);
			default:
				return createTesseractWireframe(1.2, 0);
		}
	}

	public setShape(shape: GeometryShapeType) {
		this.activeShape = shape;
		this.primaryMesh = this.generatePrimaryMesh(shape, this.angleRotation);
		if (this.device && this.primaryVBuffer && this.primaryIBuffer) {
			this.uploadPrimaryMesh();
		}
	}

	public toggleVectorConstellation(show?: boolean) {
		this.showVectorConstellation = show !== undefined ? show : !this.showVectorConstellation;
	}

	public setShowPcbLines(show: boolean) {
		this.showPcbLines = show;
		this.rebuildVectorMesh();
	}

	public togglePcbLines(show?: boolean): boolean {
		this.showPcbLines = show !== undefined ? show : !this.showPcbLines;
		this.rebuildVectorMesh();
		return this.showPcbLines;
	}

	public toggleGimbalRings(show?: boolean) {
		this.showGimbalRings = show !== undefined ? show : !this.showGimbalRings;
	}

	public togglePause(paused?: boolean) {
		this.isPaused = paused !== undefined ? paused : !this.isPaused;
		this.onPauseChange?.(this.isPaused);
	}

	public setCursorScreenCoord(x: number | null, y: number | null) {
		if (x === null || y === null) {
			this.cursorScreenCoord = null;
		} else {
			this.cursorScreenCoord = { x, y };
		}
	}

	/**
	 * Aciona o alvo procurado pelo MCP/Chat, disparando animação de vida gradativa
	 * no polígono (respeitando a rotação dinâmica a menos que autoPause seja solicitado).
	 */
	public triggerMcpSearchTarget(nodeId: string | null, autoPause = false) {
		this.searchingNodeId = nodeId;
		this.searchAnimStartTime = performance.now();
		if (nodeId && autoPause) {
			this.isPaused = true;
			this.onPauseChange?.(true);
		}
		this.rebuildVectorMesh();
	}

	public setVisibleModules(modules: string[]) {
		this.visibleModules = new Set(modules);
		this.rebuildVectorMesh();
	}

	public setVectorGraphData(nodes: VectorNodeInput[], edges: VectorEdgeInput[]) {
		this.vectorNodes = nodes;
		this.vectorEdges = edges;
		this.rebuildVectorMesh();
	}

	/**
	 * Adiciona progressivamente novos nós e arestas sem resetar a cena
	 * para suporte ao carregador em lote (Batch Loader).
	 */
	public appendVectorGraphData(newNodes: VectorNodeInput[], newEdges: VectorEdgeInput[]) {
		if (!newNodes || newNodes.length === 0) return;
		const existingIds = new Set(this.vectorNodes.map((n) => n.id || n.path));
		const uniqueAdditions: VectorNodeInput[] = [];
		for (const node of newNodes) {
			const key = node.id || node.path;
			if (!existingIds.has(key)) {
				existingIds.add(key);
				uniqueAdditions.push(node);
			}
		}
		if (uniqueAdditions.length > 0) {
			this.vectorNodes = [...this.vectorNodes, ...uniqueAdditions];
			// Merge das arestas novas
			if (newEdges && newEdges.length > 0) {
				this.vectorEdges = [...this.vectorEdges, ...newEdges];
			}
			this.rebuildVectorMesh();
		}
	}

	public setRagSearch(query: string | null) {
		this.activeSearchQuery = query && query.trim().length > 0 ? query.trim() : null;
		this.isRagActive = Boolean(this.activeSearchQuery);
		if (this.isRagActive) {
			this.telemetry.shockwavePulse = 1.0;
		}
		const q = (this.activeSearchQuery || "").toLowerCase();
		for (const n of this.vectorNodes) {
			if (!q) {
				n.isMatchedBySearch = false;
			} else {
				const p = (n.path || "").toLowerCase();
				const qn = (n.relPath || "").toLowerCase();
				const id = (n.id || "").toLowerCase();
				const hasMatchingMethod = (n.methods || []).some(
					(m) => m.name.toLowerCase().includes(q) || (m.signature || "").toLowerCase().includes(q),
				);
				n.isMatchedBySearch =
					p.includes(q) || qn.includes(q) || id.includes(q) || hasMatchingMethod;
			}
		}
		this.rebuildVectorMesh();
	}

	public setHighlightedNode(index: number | null) {
		if (this.highlightedNodeIndex !== index) {
			this.highlightedNodeIndex = index;
			this.rebuildVectorMesh();
		}
	}

	public setSelectedNode(index: number | null) {
		if (this.selectedNodeIndex !== index) {
			this.selectedNodeIndex = index;
			this.rebuildVectorMesh(performance.now() / 1000);
		}
	}

	private rebuildVectorMesh(overrideAnimTime?: number) {
		if (this.vectorNodes.length === 0) {
			this.vectorMesh = null;
			return;
		}
		const filteredNodes =
			this.visibleModules.size > 0
				? this.vectorNodes.filter((n) => this.visibleModules.has(n.module))
				: this.vectorNodes;

		const now = performance.now();
		const elapsed = now - this.searchAnimStartTime;
		const searchingAnim = this.searchingNodeId
			? {
					nodeId: this.searchingNodeId,
					animProgress: Math.min(1.0, elapsed / this.searchAnimDurationMs),
				}
			: null;

		const animTime = overrideAnimTime !== undefined ? overrideAnimTime : now / 1000;

		this.vectorMesh = createVectorConstellationWireframe(
			filteredNodes,
			this.vectorEdges,
			this.highlightedNodeIndex,
			this.activeSearchQuery,
			searchingAnim,
			this.selectedNodeIndex,
			this.showPcbLines,
			animTime,
		);
		if (this.device) {
			this.uploadVectorMesh();
		}
	}

	private uploadPrimaryMesh() {
		if (!this.device) return;
		if (!this.primaryVBuffer || this.primaryVBuffer.size < this.primaryMesh.vertices.byteLength) {
			this.primaryVBuffer?.destroy();
			this.primaryVBuffer = this.device.createBuffer({
				size: Math.max(65536, this.primaryMesh.vertices.byteLength),
				usage: GPU_BUFFER_USAGE.VERTEX | GPU_BUFFER_USAGE.COPY_DST,
			});
		}
		this.device.queue.writeBuffer(this.primaryVBuffer, 0, this.primaryMesh.vertices as any);

		if (!this.primaryIBuffer || this.primaryIBuffer.size < this.primaryMesh.indices.byteLength) {
			this.primaryIBuffer?.destroy();
			this.primaryIBuffer = this.device.createBuffer({
				size: Math.max(32768, this.primaryMesh.indices.byteLength),
				usage: GPU_BUFFER_USAGE.INDEX | GPU_BUFFER_USAGE.COPY_DST,
			});
		}
		this.device.queue.writeBuffer(this.primaryIBuffer, 0, this.primaryMesh.indices as any);
	}

	private uploadVectorMesh() {
		if (!this.device || !this.vectorMesh) return;
		if (!this.vectorVBuffer || this.vectorVBuffer.size < this.vectorMesh.vertices.byteLength) {
			this.vectorVBuffer?.destroy();
			this.vectorVBuffer = this.device.createBuffer({
				size: Math.max(262144, this.vectorMesh.vertices.byteLength * 2),
				usage: GPU_BUFFER_USAGE.VERTEX | GPU_BUFFER_USAGE.COPY_DST,
			});
		}
		this.device.queue.writeBuffer(this.vectorVBuffer, 0, this.vectorMesh.vertices as any);

		if (!this.vectorIBuffer || this.vectorIBuffer.size < this.vectorMesh.indices.byteLength) {
			this.vectorIBuffer?.destroy();
			this.vectorIBuffer = this.device.createBuffer({
				size: Math.max(131072, this.vectorMesh.indices.byteLength * 2),
				usage: GPU_BUFFER_USAGE.INDEX | GPU_BUFFER_USAGE.COPY_DST,
			});
		}
		this.device.queue.writeBuffer(this.vectorIBuffer, 0, this.vectorMesh.indices as any);
	}

	async init(): Promise<boolean> {
		if ("gpu" in navigator) {
			try {
				const adapter = await (navigator as any).gpu.requestAdapter();
				if (adapter) {
					this.device = await adapter.requestDevice();
					this.context = this.canvas.getContext("webgpu") as unknown as GPUCanvasContext;
					const format = (navigator as any).gpu.getPreferredCanvasFormat();
					this.context.configure({
						device: this.device!,
						format,
						alphaMode: "premultiplied",
					});
					await this.setupWebGpuPipelines(format);
					this.isWebGpuSupported = true;
					return true;
				}
			} catch (err) {
				console.warn(
					"[NeuralCoreEngine] WebGPU indisponível, usando fallback geométrico Canvas2D:",
					err,
				);
			}
		}

		this.ctx2d = this.canvas.getContext("2d");
		return false;
	}

	private async setupWebGpuPipelines(format: GPUTextureFormat) {
		if (!this.device) return;

		const renderModule = this.device.createShaderModule({
			code: GEOMETRY_RENDER_WGSL,
		});

		this.renderPipeline = this.device.createRenderPipeline({
			layout: "auto",
			vertex: {
				module: renderModule,
				entryPoint: "vs_line",
				buffers: [
					{
						arrayStride: 28,
						stepMode: "vertex",
						attributes: [
							{ shaderLocation: 0, offset: 0, format: "float32x3" },
							{ shaderLocation: 1, offset: 12, format: "float32x4" },
						],
					},
				],
			},
			fragment: {
				module: renderModule,
				entryPoint: "fs_line",
				targets: [
					{
						format,
						blend: {
							color: {
								srcFactor: "src-alpha",
								dstFactor: "one",
								operation: "add",
							},
							alpha: {
								srcFactor: "one",
								dstFactor: "one",
								operation: "add",
							},
						},
					},
				],
			},
			primitive: {
				topology: "line-list",
			},
		});

		// Inicialização de buffers para primary mesh
		this.uploadPrimaryMesh();

		// Buffers para os anéis cardânicos (Gimbal)
		this.gimbalVBuffer = this.device.createBuffer({
			size: this.gimbalMesh.vertices.byteLength,
			usage: GPU_BUFFER_USAGE.VERTEX | GPU_BUFFER_USAGE.COPY_DST,
		});
		this.device.queue.writeBuffer(this.gimbalVBuffer, 0, this.gimbalMesh.vertices as any);

		this.gimbalIBuffer = this.device.createBuffer({
			size: this.gimbalMesh.indices.byteLength,
			usage: GPU_BUFFER_USAGE.INDEX | GPU_BUFFER_USAGE.COPY_DST,
		});
		this.device.queue.writeBuffer(this.gimbalIBuffer, 0, this.gimbalMesh.indices as any);

		// Buffers para satélites
		this.satelliteVBuffer = this.device.createBuffer({
			size: this.satelliteMesh.vertices.byteLength,
			usage: GPU_BUFFER_USAGE.VERTEX | GPU_BUFFER_USAGE.COPY_DST,
		});
		this.device.queue.writeBuffer(this.satelliteVBuffer, 0, this.satelliteMesh.vertices as any);

		this.satelliteIBuffer = this.device.createBuffer({
			size: this.satelliteMesh.indices.byteLength,
			usage: GPU_BUFFER_USAGE.INDEX | GPU_BUFFER_USAGE.COPY_DST,
		});
		this.device.queue.writeBuffer(this.satelliteIBuffer, 0, this.satelliteMesh.indices as any);

		// Uniforms
		this.cameraBuffer = this.device.createBuffer({
			size: 160,
			usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
		});

		this.renderBindGroup = this.device.createBindGroup({
			layout: this.renderPipeline.getBindGroupLayout(0),
			entries: [{ binding: 0, resource: { buffer: this.cameraBuffer } }],
		});
	}

	public triggerShockwave() {
		this.telemetry.shockwavePulse = 1.0;
	}

	public setActivity(activity: NeuralActivityState, intensity = 0.5) {
		this.telemetry.activity = activity;
		this.telemetry.intensity = Math.min(1.0, Math.max(0.1, intensity));
	}

	public start() {
		if (this.isRunning) return;
		this.isRunning = true;
		this.lastTime = performance.now();
		this.fpsTimer = performance.now();
		this.frameCounter = 0;

		const loop = (now: number) => {
			if (!this.isRunning) return;
			const dt = Math.min((now - this.lastTime) / 1000, 0.05);
			this.lastTime = now;

			// Executa interpolações antes do frame (ex: Fly-to da câmera)
			this.onBeforeRenderFrame?.();

			// O Neural Core só se move quando houver busca RAG ou atividade de ferramenta do agente
			const isMotionActive =
				this.isRagActive ||
				this.telemetry.activity === "tool_exec" ||
				this.telemetry.activity === "thinking";

			const targetSpeed = isMotionActive ? 1.0 + this.telemetry.intensity * 2.5 : 0.0;
			this.currentMotionSpeed += (targetSpeed - this.currentMotionSpeed) * Math.min(1.0, dt * 5.0);

			// Se houver polígono sendo buscado no MCP, anima gradativamente frame a frame por 2 segundos
			if (this.searchingNodeId && now - this.searchAnimStartTime <= this.searchAnimDurationMs) {
				this.rebuildVectorMesh(now / 1000);
			} else if (this.selectedNodeIndex !== null && now - this.lastPulseMeshUpdate >= 32) {
				// Anima continuamente feixes pulsantes das linhas de dependência e fluxo direcional a ~30 FPS
				this.lastPulseMeshUpdate = now;
				this.rebuildVectorMesh(now / 1000);
			}

			if (!this.isPaused && this.currentMotionSpeed > 0.001) {
				this.angleRotation += dt * 0.8 * this.currentMotionSpeed;
				this.angleRingPitch += dt * 0.6 * this.currentMotionSpeed;
				this.angleRingRoll -= dt * 0.45 * this.currentMotionSpeed;
				this.angleRingYaw += dt * 0.9 * this.currentMotionSpeed;
			}

			if (this.telemetry.shockwavePulse > 0.01) {
				this.telemetry.shockwavePulse *= 0.94;
			} else {
				this.telemetry.shockwavePulse = 0;
			}

			// Medição de FPS
			this.frameCounter++;
			if (now - this.fpsTimer >= 1000) {
				this.currentFps = Math.round((this.frameCounter * 1000) / (now - this.fpsTimer));
				this.frameCounter = 0;
				this.fpsTimer = now;
				let totalElements = this.primaryMesh.count + this.satelliteMesh.count;
				if (this.showGimbalRings) totalElements += this.gimbalMesh.count;
				if (this.showVectorConstellation && this.vectorMesh) totalElements += this.vectorMesh.count;
				this.onFrameMetrics?.(this.currentFps, totalElements);
			}

			if (this.isWebGpuSupported && this.device && this.context) {
				this.renderWebGpu(now / 1000);
			} else if (this.ctx2d) {
				this.renderGeometricCanvas2D();
			}

			this.animationFrameId = requestAnimationFrame(loop);
		};

		this.animationFrameId = requestAnimationFrame(loop);
	}

	private renderWebGpu(time: number) {
		if (!this.device || !this.context || !this.renderPipeline) return;

		const aspect = this.canvas.width / (this.canvas.height || 1);
		const viewProj = this.calculateViewProjMatrix(aspect);

		let tint = [0.0, 0.85, 1.0, 1.0];
		if (this.telemetry.activity === "thinking") {
			tint = [0.75, 0.2, 1.0, 1.0];
		} else if (this.telemetry.activity === "tool_exec") {
			tint = [1.0, 0.75, 0.0, 1.0];
		} else if (this.telemetry.activity === "error") {
			tint = [1.0, 0.15, 0.25, 1.0];
		}

		const model = this.createRotationMatrix(this.angleRotation, this.angleRingRoll * 0.5);

		const uniformData = new Float32Array(40);
		uniformData.set(viewProj, 0);
		uniformData.set(model, 16);
		uniformData.set(tint, 32);
		uniformData.set(
			[
				this.telemetry.shockwavePulse,
				this.telemetry.intensity,
				time,
				this.telemetry.activity === "thinking" ? 1.0 : 0.0,
			],
			36,
		);

		this.device.queue.writeBuffer(this.cameraBuffer!, 0, uniformData as any);

		// Se for Tesseract, atualiza a projeção 4D dinâmica
		if (this.activeShape === "tesseract") {
			this.primaryMesh = createTesseractWireframe(1.2, this.angleRotation * 0.7);
			this.device.queue.writeBuffer(this.primaryVBuffer!, 0, this.primaryMesh.vertices as any);
		}

		const commandEncoder = this.device.createCommandEncoder();
		const textureView = this.context.getCurrentTexture().createView();
		const renderPass = commandEncoder.beginRenderPass({
			colorAttachments: [
				{
					view: textureView,
					clearValue: { r: 0.015, g: 0.025, b: 0.045, a: 1.0 },
					loadOp: "clear",
					storeOp: "store",
				},
			],
		});

		renderPass.setPipeline(this.renderPipeline);
		renderPass.setBindGroup(0, this.renderBindGroup!);

		// 1. Desenha a Forma Primária Central (apenas se explicitamente habilitada)
		if (this.showCentralPolygon && this.primaryVBuffer && this.primaryIBuffer) {
			renderPass.setVertexBuffer(0, this.primaryVBuffer);
			renderPass.setIndexBuffer(this.primaryIBuffer, "uint16");
			renderPass.drawIndexed(this.primaryMesh.count);
		}

		// 2. Desenha os Anéis Cardânicos (apenas se habilitado)
		if (this.showGimbalRings && this.gimbalVBuffer && this.gimbalIBuffer) {
			renderPass.setVertexBuffer(0, this.gimbalVBuffer);
			renderPass.setIndexBuffer(this.gimbalIBuffer, "uint16");
			renderPass.drawIndexed(this.gimbalMesh.count);
		}

		// 3. Desenha a Constelação de Vetores RAG (índices de 32 bits para suportar dezenas de milhares de nós)
		if (
			this.showVectorConstellation &&
			this.vectorMesh &&
			this.vectorVBuffer &&
			this.vectorIBuffer
		) {
			renderPass.setVertexBuffer(0, this.vectorVBuffer);
			renderPass.setIndexBuffer(this.vectorIBuffer, "uint32");
			renderPass.drawIndexed(this.vectorMesh.count);
		}

		// 4. Desenha os Satélites e Feixes de Ferramentas
		if (this.satelliteVBuffer && this.satelliteIBuffer) {
			renderPass.setVertexBuffer(0, this.satelliteVBuffer);
			renderPass.setIndexBuffer(this.satelliteIBuffer, "uint16");
			renderPass.drawIndexed(this.satelliteMesh.count);
		}

		renderPass.end();
		this.device.queue.submit([commandEncoder.finish()]);
	}

	private calculateViewProjMatrix(aspect: number): Float32Array {
		const { theta, phi, distance, target } = this.cameraOrbit;
		const tx0 = target ? target[0] : 0;
		const ty0 = target ? target[1] : 0;
		const tz0 = target ? target[2] : 0;

		const eyeX = tx0 + distance * Math.cos(phi) * Math.sin(theta);
		const eyeY = ty0 + distance * Math.sin(phi);
		const eyeZ = tz0 + distance * Math.cos(phi) * Math.cos(theta);

		// Vetor Z (forward/depth da câmera apontando para trás da direção de visão - Right Handed)
		const dirX = eyeX - tx0;
		const dirY = eyeY - ty0;
		const dirZ = eyeZ - tz0;
		const zLen = Math.hypot(dirX, dirY, dirZ) || 1;
		const z0 = dirX / zLen;
		const z1 = dirY / zLen;
		const z2 = dirZ / zLen;

		// Vetor Up de referência com proteção contra singularidade de Gimbal Lock em vista zenital (|phi| -> pi/2)
		let upX = 0;
		let upY = 1;
		let upZ = 0;
		if (Math.abs(z0) < 0.0001 && Math.abs(z2) < 0.0001) {
			// Se a câmera estiver alinhada verticalmente com o eixo Y, usa o vetor Z como up secundário
			upX = 0;
			upY = 0;
			upZ = z1 > 0 ? -1 : 1;
		}

		// Vetor X = normalize(cross(up, Z))
		const x0_raw = upY * z2 - upZ * z1;
		const x1_raw = upZ * z0 - upX * z2;
		const x2_raw = upX * z1 - upY * z0;
		const xLen = Math.hypot(x0_raw, x1_raw, x2_raw) || 1;
		const x0 = x0_raw / xLen;
		const x1 = x1_raw / xLen;
		const x2 = x2_raw / xLen;

		// Vetor Y = cross(Z, X) (sempre ortogonal e normalizado)
		const y0 = z1 * x2 - z2 * x1;
		const y1 = z2 * x0 - z0 * x2;
		const y2 = z0 * x1 - z1 * x0;

		// Componentes de translação da visão V: -dot(axis, eye)
		const tx = -(x0 * eyeX + x1 * eyeY + x2 * eyeZ);
		const ty = -(y0 * eyeX + y1 * eyeY + y2 * eyeZ);
		const tz = -(z0 * eyeX + z1 * eyeY + z2 * eyeZ);

		// Projeção perspectiva WebGPU (NDC z in [0, 1]) com frustum amplo e estável
		const fov = Math.PI / 4;
		const near = 0.05;
		const far = 2000.0;
		const f = 1.0 / Math.tan(fov / 2);
		const rangeInv = 1.0 / (near - far);

		// Termos exatos da linha 2 da matriz de projeção P (sem distorção de -z0)
		const p22 = far * rangeInv;
		const p23 = near * far * rangeInv;

		const out = new Float32Array(16);
		out[0] = (f / aspect) * x0;
		out[1] = f * y0;
		out[2] = p22 * z0;
		out[3] = -z0;

		out[4] = (f / aspect) * x1;
		out[5] = f * y1;
		out[6] = p22 * z1;
		out[7] = -z1;

		out[8] = (f / aspect) * x2;
		out[9] = f * y2;
		out[10] = p22 * z2;
		out[11] = -z2;

		out[12] = (f / aspect) * tx;
		out[13] = f * ty;
		out[14] = p22 * tz + p23;
		out[15] = -tz;

		return out;
	}

	private createRotationMatrix(ax: number, ay: number): Float32Array {
		const out = new Float32Array(16);
		const cx = Math.cos(ax);
		const sx = Math.sin(ax);
		const cy = Math.cos(ay);
		const sy = Math.sin(ay);

		out[0] = cy;
		out[2] = sy;
		out[5] = cx;
		out[6] = -sx;
		out[8] = -sy;
		out[9] = sx * cy;
		out[10] = cx * cy;
		out[15] = 1.0;
		return out;
	}

	/**
	 * Detecta com precisão determinística o polígono vetorial sob as coordenadas da tela (mouse hover / clique).
	 * Utiliza z-sorting (ordenação por profundidade da câmera): quando o cursor passa sobre uma região,
	 * seleciona sempre o polígono mais próximo dos olhos do observador (menor depth), eliminando qualquer
	 * oclusão ou confusão entre polígonos adjacentes.
	 */
	public findNodeUnderScreenCoord(
		screenX: number,
		screenY: number,
		tolerancePx = 18,
	): number | null {
		if (!this.showVectorConstellation || this.vectorNodes.length === 0) return null;

		// Usa as dimensões CSS reais do canvas para coincidir exatamente com os ponteiros do mouse
		const w = this.canvas.clientWidth || this.canvas.width;
		const h = this.canvas.clientHeight || this.canvas.height;
		const cx = w / 2;
		const cy = h / 2;
		const scale = Math.min(w, h) * 0.22;

		const cosO = Math.cos(this.cameraOrbit.theta);
		const sinO = Math.sin(this.cameraOrbit.theta);
		const cosPhi = Math.cos(this.cameraOrbit.phi);
		const sinPhi = Math.sin(this.cameraOrbit.phi);

		const baseDist = Math.max(1.0, this.cameraOrbit.distance);
		const [tx0, ty0, tz0] = this.cameraOrbit.target || [0, 0, 0];

		// Candidatos dentro da tolerância do ponteiro
		const candidates: Array<{ index: number; distance2D: number; depth: number }> = [];

		for (let i = 0; i < this.vectorNodes.length; i++) {
			const node = this.vectorNodes[i]!;
			if (this.visibleModules.size > 0 && !this.visibleModules.has(node.module)) {
				continue;
			}
			const [vx0, vy0, vz0] = node.position;
			const vx = vx0 - tx0;
			const vy = vy0 - ty0;
			const vz = vz0 - tz0;

			// Projeção da rotação orbital da câmera
			const rx = vx * cosO - vz * sinO;
			const rz = vx * sinO + vz * cosO;
			const ry = vy * cosPhi - rz * sinPhi;
			const depth = Math.max(0.2, baseDist + (vy * sinPhi + rz * cosPhi) * 0.45);

			const px = cx + (rx / depth) * scale * 5.6;
			const py = cy - (ry / depth) * scale * 5.6;

			const dx = screenX - px;
			const dy = screenY - py;
			const d = Math.sqrt(dx * dx + dy * dy);

			// Raio aparente do polígono 3D projetado na tela:
			// Um nó comum tem tamanho s=0.024 a 0.057. Em tela isso corresponde a ~14-30px.
			const approxNodeRadiusPx = Math.max(12, Math.min(32, (0.055 / depth) * scale * 5.6));
			const dynamicTolerance = Math.max(tolerancePx, approxNodeRadiusPx + 4.0);

			if (d <= dynamicTolerance) {
				candidates.push({
					index: i,
					distance2D: d,
					depth,
				});
			}
		}

		if (candidates.length === 0) return null;

		// Ordenação por profundidade da câmera (o mais à frente tem prioridade total)
		// e desempate secundário pela menor distância ao centro do cursor
		candidates.sort((a, b) => {
			const depthDiff = a.depth - b.depth;
			// Se a diferença de profundidade for perceptível (> 0.12), o mais frontal vence sempre
			if (Math.abs(depthDiff) > 0.12) {
				return depthDiff;
			}
			// Para nós em profundidade quase idêntica, escolhe o mais próximo do cursor
			return a.distance2D - b.distance2D;
		});

		return candidates[0]?.index ?? null;
	}

	/**
	 * Calcula coordenadas 2D na tela para nós estratégicos exibirem labels inteligentes (Graphify style).
	 */
	public getProjectedNodeLabels(maxLabels = 8): Array<{
		index: number;
		id: string;
		label: string;
		module: string;
		x: number;
		y: number;
		isHovered: boolean;
		isMatched: boolean;
		isSearchingTarget: boolean;
		methodsCount: number;
		isSelected?: boolean | undefined;
		isRelated?: boolean | undefined;
		relationKind?: "CALLER" | "IMPORT" | "TYPE" | "DEPENDENCY" | undefined;
	}> {
		if (!this.showVectorConstellation || this.vectorNodes.length === 0) return [];

		const w = this.canvas.clientWidth || this.canvas.width;
		const h = this.canvas.clientHeight || this.canvas.height;
		const cx = w / 2;
		const cy = h / 2;
		const scale = Math.min(w, h) * 0.22;

		const cosO = Math.cos(this.cameraOrbit.theta);
		const sinO = Math.sin(this.cameraOrbit.theta);
		const cosPhi = Math.cos(this.cameraOrbit.phi);
		const sinPhi = Math.sin(this.cameraOrbit.phi);
		const baseDist = Math.max(1.0, this.cameraOrbit.distance);
		const [tx0, ty0, tz0] = this.cameraOrbit.target || [0, 0, 0];

		const hasActiveSelection =
			this.selectedNodeIndex !== null &&
			this.selectedNodeIndex >= 0 &&
			this.selectedNodeIndex < this.vectorNodes.length;
		const relations = hasActiveSelection
			? computeNodeRelations(this.selectedNodeIndex, this.vectorNodes, this.vectorEdges)
			: null;

		// Raio seguro a partir do cursor para evitar poluição visual (em pixels)
		const cursorRadiusPx = 135;
		const cursor = this.cursorScreenCoord;

		// 1. Projeção de todos os nós visíveis na tela para uso na repulsão magnética
		const allProjectedNodes: Array<{ index: number; px: number; py: number; depth: number }> = [];

		for (let i = 0; i < this.vectorNodes.length; i++) {
			const node = this.vectorNodes[i]!;
			if (this.visibleModules.size > 0 && !this.visibleModules.has(node.module)) {
				continue;
			}
			const [vx0, vy0, vz0] = node.position;
			const vx = vx0 - tx0;
			const vy = vy0 - ty0;
			const vz = vz0 - tz0;

			const rx = vx * cosO - vz * sinO;
			const rz = vx * sinO + vz * cosO;
			const ry = vy * cosPhi - rz * sinPhi;
			const depth = Math.max(0.2, baseDist + (vy * sinPhi + rz * cosPhi) * 0.45);

			const px = cx + (rx / depth) * scale * 5.6;
			const py = cy - (ry / depth) * scale * 5.6;

			if (px >= 20 && px <= w - 20 && py >= 20 && py <= h - 20) {
				allProjectedNodes.push({ index: i, px, py, depth });
			}
		}

		// 2. Filtra nós candidatos para receberem rótulo conforme raio do cursor e prioridade
		const candidateLabels: Array<{
			index: number;
			id: string;
			label: string;
			module: string;
			nodePx: number;
			nodePy: number;
			x: number;
			y: number;
			depth: number;
			isHovered: boolean;
			isMatched: boolean;
			isSearchingTarget: boolean;
			methodsCount: number;
			importanceScore: number;
			isSelected: boolean;
			isRelated: boolean;
			relationKind?: "CALLER" | "IMPORT" | "TYPE" | "DEPENDENCY" | undefined;
		}> = [];

		for (const proj of allProjectedNodes) {
			const i = proj.index;
			const node = this.vectorNodes[i]!;
			const isSelected = hasActiveSelection && i === this.selectedNodeIndex;
			const isRelated = Boolean(relations?.directNeighbors.has(i));
			const isUnrelated = hasActiveSelection && !isSelected && !isRelated;

			// Se houver seleção ativa, suprime nós não relacionados
			if (isUnrelated) continue;

			const isHovered = i === this.highlightedNodeIndex;
			const isMatched = Boolean(node.isMatchedBySearch);
			const isSearchingTarget = this.searchingNodeId === node.id;
			const methodsCount = node.methods?.length || 0;

			// Determina a tag de relação para classes conectadas ao nó selecionado
			let relationKind: "CALLER" | "IMPORT" | "TYPE" | "DEPENDENCY" | undefined;
			if (isRelated && relations) {
				if (relations.callNeighbors.has(i)) relationKind = "CALLER";
				else if (relations.importNeighbors.has(i)) relationKind = "IMPORT";
				else if (relations.typeNeighbors.has(i)) relationKind = "TYPE";
				else relationKind = "DEPENDENCY";
			}

			// Checa se está dentro do raio seguro a partir do cursor
			let isWithinCursorRadius = false;
			if (cursor) {
				const cdx = proj.px - cursor.x;
				const cdy = proj.py - cursor.y;
				const distCursor = Math.sqrt(cdx * cdx + cdy * cdy);
				if (distCursor <= cursorRadiusPx) {
					isWithinCursorRadius = true;
				}
			}

			// Rótulo é exibido se:
			// 1) O nó estiver em hover direto pelo cursor;
			// 2) O nó estiver selecionado por clique;
			// 3) O nó for relacionado/conectado ao polígono selecionado;
			// 4) For alvo de busca ativa MCP/RAG;
			// 5) Estiver no raio pequeno do cursor
			if (!isHovered && !isSelected && !isRelated && !isSearchingTarget && !isWithinCursorRadius) {
				continue;
			}

			let score = methodsCount;
			if (isSelected) score += 6000;
			if (isHovered) score += 5000;
			if (isSearchingTarget) score += 3000;
			if (isRelated) score += 2500;
			if (isMatched) score += 800;
			if (isWithinCursorRadius) score += 500;

			const nameParts = (node.relPath || node.id).split(/[/\\]/);
			const cleanLabel = nameParts[nameParts.length - 1] || node.id;

			// Posição base do rótulo: SEMPRE ACIMA do polígono em questão (offset inicial -22px em Y)
			const initialLabelX = proj.px;
			const initialLabelY = proj.py - 22;

			candidateLabels.push({
				index: i,
				id: node.id,
				label: cleanLabel,
				module: node.module,
				nodePx: proj.px,
				nodePy: proj.py,
				x: initialLabelX,
				y: initialLabelY,
				depth: proj.depth,
				isHovered,
				isMatched,
				isSearchingTarget,
				methodsCount,
				importanceScore: score,
				isSelected,
				isRelated,
				relationKind,
			});
		}

		// Ordena por prioridade e limita ao máximo de rótulos permitidos (expandido quando há nós relacionados)
		candidateLabels.sort((a, b) => b.importanceScore - a.importanceScore);
		const effectiveMax = hasActiveSelection ? Math.max(maxLabels, 32) : maxLabels;
		const selectedCandidates = candidateLabels.slice(0, effectiveMax);

		// 3. Aplicação do MAGNETISMO DE MESMA POLARIDADE (Repulsão Coulombiana Suave):
		// Garante que o rótulo NUNCA fique sobreposto em cima de outro polígono vizinho.
		// Quando um polígono vizinho estiver muito próximo da área do rótulo, repele suavemente
		// o rótulo para cima e diagonal livre.
		const minSafeLabelDist = 32;

		for (const item of selectedCandidates) {
			for (const otherProj of allProjectedNodes) {
				if (otherProj.index === item.index) continue;

				const dx = item.x - otherProj.px;
				const dy = item.y - otherProj.py;
				const dist = Math.sqrt(dx * dx + dy * dy);

				if (dist < minSafeLabelDist) {
					const safeD = Math.max(dist, 1.0);
					const overlap = minSafeLabelDist - safeD;
					const repulseStrength = overlap / minSafeLabelDist;

					const nx = dx / safeD;
					const ny = dy < 0 ? dy / safeD : -0.85;

					item.x += nx * repulseStrength * 16;
					item.y += ny * repulseStrength * 20;
				}
			}
		}

		return selectedCandidates.map((c) => ({
			index: c.index,
			id: c.id,
			label: c.label,
			module: c.module,
			x: c.x,
			y: c.y,
			isHovered: c.isHovered,
			isMatched: c.isMatched,
			isSearchingTarget: c.isSearchingTarget,
			methodsCount: c.methodsCount,
			isSelected: c.isSelected,
			isRelated: c.isRelated,
			relationKind: c.relationKind,
		}));
	}

	private renderGeometricCanvas2D() {
		if (!this.ctx2d) return;
		const ctx = this.ctx2d;
		const w = this.canvas.width;
		const h = this.canvas.height;

		ctx.globalAlpha = 0.25;
		ctx.fillStyle = "black";
		ctx.fillRect(0, 0, w, h);
		ctx.globalAlpha = 1.0;

		const cx = w / 2;
		const cy = h / 2;
		const scale = Math.min(w, h) * 0.22;

		const baseDist = Math.max(1.0, this.cameraOrbit.distance);
		const zoomFactor = 5.6 / baseDist;

		// 1. Projeção da Forma Primária no Canvas2D (apenas se habilitada)
		if (this.showCentralPolygon) {
			const m = this.generatePrimaryMesh(this.activeShape, this.angleRotation);
			ctx.lineWidth = 1.5;
			ctx.strokeStyle = this.telemetry.activity === "thinking" ? "magenta" : "cyan";

			const cosO = Math.cos(this.cameraOrbit.theta);
			const sinO = Math.sin(this.cameraOrbit.theta);
			const cosPhi = Math.cos(this.cameraOrbit.phi);
			const sinPhi = Math.sin(this.cameraOrbit.phi);

			const vertexCount = m.vertices.length / 7;
			const projectedPts: Array<[number, number]> = [];
			for (let i = 0; i < vertexCount; i++) {
				const off = i * 7;
				const x = m.vertices[off + 0]!;
				const y = m.vertices[off + 1]!;
				const z = m.vertices[off + 2]!;

				const rx = x * cosO - z * sinO;
				const rz = x * sinO + z * cosO;
				const ry = y * cosPhi - rz * sinPhi;
				const d = Math.max(0.2, baseDist + (y * sinPhi + rz * cosPhi) * 0.45);

				projectedPts.push([cx + (rx / d) * scale * 5.6, cy - (ry / d) * scale * 5.6]);
			}

			ctx.beginPath();
			for (let i = 0; i < m.indices.length; i += 2) {
				const p1 = projectedPts[m.indices[i]!]!;
				const p2 = projectedPts[m.indices[i + 1]!]!;
				if (p1 && p2) {
					ctx.moveTo(p1[0], p1[1]);
					ctx.lineTo(p2[0], p2[1]);
				}
			}
			ctx.stroke();
		}

		const cosO = Math.cos(this.cameraOrbit.theta);
		const sinO = Math.sin(this.cameraOrbit.theta);
		const cosPhi = Math.cos(this.cameraOrbit.phi);
		const sinPhi = Math.sin(this.cameraOrbit.phi);

		// 2. Anéis Cardânicos (apenas se habilitado)
		if (this.showGimbalRings) {
			ctx.lineWidth = 1.0;
			ctx.strokeStyle = "cyan";
			ctx.beginPath();
			ctx.ellipse(
				cx,
				cy,
				scale * 1.5 * zoomFactor,
				scale * 0.5 * zoomFactor,
				this.angleRingPitch,
				0,
				Math.PI * 2,
			);
			ctx.stroke();

			ctx.strokeStyle = "magenta";
			ctx.beginPath();
			ctx.ellipse(
				cx,
				cy,
				scale * 1.8 * zoomFactor,
				scale * 0.6 * zoomFactor,
				this.angleRingRoll,
				0,
				Math.PI * 2,
			);
			ctx.stroke();
		}

		// 3. Nós da Constelação Vetorial (Canvas2D)
		if (this.showVectorConstellation && this.vectorNodes.length > 0) {
			const [tx0, ty0, tz0] = this.cameraOrbit.target || [0, 0, 0];
			for (let i = 0; i < this.vectorNodes.length; i++) {
				const node = this.vectorNodes[i]!;
				const vx = node.position[0] - tx0;
				const vy = node.position[1] - ty0;
				const vz = node.position[2] - tz0;
				const rx = vx * cosO - vz * sinO;
				const rz = vx * sinO + vz * cosO;
				const ry = vy * cosPhi - rz * sinPhi;
				const d = Math.max(0.2, baseDist + (vy * sinPhi + rz * cosPhi) * 0.45);
				const px = cx + (rx / d) * scale * 5.6;
				const py = cy - (ry / d) * scale * 5.6;

				const isHighlight = i === this.highlightedNodeIndex;
				const isMatched = Boolean(node.isMatchedBySearch);

				if (isMatched) {
					// Feixe luminoso de busca conectando o centro até o nó pesquisado
					ctx.strokeStyle = "yellow";
					ctx.lineWidth = 1.8;
					ctx.beginPath();
					ctx.moveTo(cx, cy);
					ctx.lineTo(px, py);
					ctx.stroke();
				}

				const ptSize = Math.max(1.2, (isMatched ? 4.5 : isHighlight ? 3.5 : 2.0) * zoomFactor);
				ctx.fillStyle = isMatched ? "yellow" : isHighlight ? "white" : "skyblue";
				ctx.beginPath();
				ctx.arc(px, py, ptSize, 0, Math.PI * 2);
				ctx.fill();

				// 3.1 Desenho dos métodos filhos em sub-órbita no Canvas2D
				if (node.methods && node.methods.length > 0) {
					const totalM = node.methods.length;
					for (let mIdx = 0; mIdx < totalM; mIdx++) {
						const m = node.methods[mIdx]!;
						const mAngle = m.orbitAngle ?? (mIdx / totalM) * Math.PI * 2;
						const mRadius = m.orbitRadius ?? 0.16;

						const mx = vx + Math.cos(mAngle) * mRadius;
						const my = vy + Math.sin(mAngle) * 0.45 * mRadius;
						const mz = vz + Math.sin(mAngle) * mRadius;

						const mrx = mx * cosO - mz * sinO;
						const mrz = mx * sinO + mz * cosO;
						const mry = my * cosPhi - mrz * sinPhi;
						const md = Math.max(0.2, baseDist + (my * sinPhi + mrz * cosPhi) * 0.45);
						const mpx = cx + (mrx / md) * scale * 5.6;
						const mpy = cy - (mry / md) * scale * 5.6;

						// Linha radial
						ctx.strokeStyle = "cyan";
						ctx.lineWidth = 0.6;
						ctx.beginPath();
						ctx.moveTo(px, py);
						ctx.lineTo(mpx, mpy);
						ctx.stroke();

						// Micro-ponto do método
						ctx.fillStyle = isMatched ? "yellow" : "white";
						ctx.beginPath();
						ctx.arc(mpx, mpy, Math.max(0.8, 1.2 * zoomFactor), 0, Math.PI * 2);
						ctx.fill();
					}
				}
			}
		}
	}

	public stop() {
		this.isRunning = false;
		if (this.animationFrameId !== null) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
	}
}
