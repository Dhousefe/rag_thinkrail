import { useState } from "react";
import {
	RiHammerLine,
	RiGlobalLine,
	RiGamepadLine,
	RiTerminalBoxLine,
	RiFolderLine,
	RiCheckLine,
	RiPlayFill,
	RiShieldCheckLine,
	RiEyeLine,
	RiSparklingFill,
} from "@remixicon/react";
import type {
	CraftProjectState,
	CraftTargetType,
	CraftInspectionMode,
	CraftViewportDiff,
} from "@thinkrail/contracts";

export function CraftPanel() {
	const [target, setTarget] = useState("https://news.ycombinator.com");
	const [targetType, setTargetType] = useState<CraftTargetType>("website");
	const [mode, setMode] = useState<CraftInspectionMode>("clean_room");
	const [targetStack, setTargetStack] = useState("TypeScript / React + Tailwind");
	const [instructions, setInstructions] = useState("Recriar layout limpo e responsivo mantendo todas as funcionalidades");
	const [projectState, setProjectState] = useState<CraftProjectState | null>(null);
	const [activeViewport, setActiveViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
	const [isRunning, setIsRunning] = useState(false);

	const handleStartCraft = () => {
		setIsRunning(true);
		const now = Date.now();
		const dummyDiffs: CraftViewportDiff[] = [
			{ viewport: "desktop", width: 1280, height: 800, similarityScore: 94.8, mismatchCount: 42 },
			{ viewport: "tablet", width: 768, height: 1024, similarityScore: 92.1, mismatchCount: 88 },
			{ viewport: "mobile", width: 375, height: 667, similarityScore: 96.5, mismatchCount: 19 },
		];

		const initial: CraftProjectState = {
			config: {
				id: `craft_${now}`,
				name: `Craft: ${target.slice(0, 30)}`,
				target,
				targetType,
				mode,
				targetStack,
				instructions,
				outputPath: `./craft-projects/${targetType}`,
				createdAt: now,
				updatedAt: now,
			},
			currentStep: "study",
			steps: [
				{ step: "study", title: "1. Estudo (Study)", status: "in_progress", startedAt: now },
				{ step: "build", title: "2. Criação (Build)", status: "pending" },
				{ step: "verify", title: "3. Verificação (Verify)", status: "pending" },
				{ step: "ready", title: "4. Pronto (Ready)", status: "pending" },
			],
			feed: [
				{ kind: "step", step: "study", text: `Iniciando análise do alvo (${mode === "clean_room" ? "Clean Room: isolamento ativado" : "Deep inspection"}).`, timestamp: now },
				{ kind: "user", text: instructions, timestamp: now },
			],
			viewportDiffs: dummyDiffs,
			similarityScore: 94.5,
			selfTest: {
				version: 1,
				passed: true,
				totalSteps: 3,
				passedSteps: 3,
				steps: [
					{ step: "core_layout", passed: true, detail: "Grid e componentes estruturados" },
					{ step: "data_binding", passed: true, detail: "Fluxo de dados validado" },
					{ step: "interaction", passed: true, detail: "Eventos e navegação verificados" },
				],
			},
			unknowns: [],
		};

		setProjectState(initial);

		setTimeout(() => {
			setProjectState((prev) => {
				if (!prev) return null;
				const s0 = prev.steps[0];
				const s1 = prev.steps[1];
				if (!s0 || !s1) return prev;
				const updated: CraftProjectState = {
					...prev,
					currentStep: "build",
					steps: prev.steps.map((s, i) => {
						if (i === 0) return { ...s, status: "passed" };
						if (i === 1) return { ...s, status: "in_progress" };
						return s;
					}),
					feed: [
						...prev.feed,
						{
							kind: "agent",
							text: `Gerando código nativo ${targetStack} com Pi Coding Agent...`,
							timestamp: Date.now(),
						},
					],
				};
				return updated;
			});
		}, 800);

		setTimeout(() => {
			setProjectState((prev) => {
				if (!prev) return null;
				const updated: CraftProjectState = {
					...prev,
					currentStep: "verify",
					steps: prev.steps.map((s, i) => {
						if (i === 1) return { ...s, status: "passed" };
						if (i === 2) return { ...s, status: "in_progress" };
						return s;
					}),
					feed: [
						...prev.feed,
						{
							kind: "step",
							step: "verify",
							text: "Calculando métricas visuais e validando --self-test em 3 resoluções...",
							timestamp: Date.now(),
						},
					],
				};
				return updated;
			});
		}, 1600);

		setTimeout(() => {
			setProjectState((prev) => {
				if (!prev) return null;
				const updated: CraftProjectState = {
					...prev,
					currentStep: "ready",
					steps: prev.steps.map((s, i) => {
						if (i === 2 || i === 3) return { ...s, status: "passed" };
						return s;
					}),
					feed: [
						...prev.feed,
						{
							kind: "agent",
							text: "Reconstrução concluída! Sua versão nativa atingiu 94.5% de conformidade com o original.",
							timestamp: Date.now(),
						},
					],
				};
				setIsRunning(false);
				return updated;
			});
		}, 2400);
	};

	return (
		<div className="flex flex-col h-full bg-container-workspace-bg text-text-default p-16 overflow-y-auto space-y-24">
			{/* Cabeçalho do Craft */}
			<div className="flex items-center justify-between border-b border-border-default pb-12">
				<div className="flex items-center space-x-8">
					<div className="p-8 bg-primary-subtle rounded-md text-primary">
						<RiHammerLine className="size-5" />
					</div>
					<div>
						<h2 className="tr-text-emphasis text-text-default leading-none">Craft Anything</h2>
						<p className="tr-text-metadata text-text-muted mt-4">
							Engenharia reversa e reconstrução de software orientada a Clean-Room e IA
						</p>
					</div>
				</div>
				<div className="flex items-center space-x-6 tr-text-metadata px-8 py-4 rounded-md bg-control-bg text-feedback-success">
					<RiShieldCheckLine className="size-3.5" />
					<span>Nativo ThinkRail (TypeScript)</span>
				</div>
			</div>

			{/* Formulário de Configuração */}
			<div className="bg-container-elevated-bg rounded-lg p-16 border border-border-default space-y-16">
				<div className="grid grid-cols-2 gap-16">
					<div>
						<label className="block tr-text-metadata text-text-muted mb-4">Tipo do Alvo</label>
						<div className="flex rounded-md border border-control-border-default overflow-hidden bg-container-workspace-bg tr-text-metadata">
							{[
								{ type: "website", label: "Website", icon: RiGlobalLine },
								{ type: "game", label: "Jogo", icon: RiGamepadLine },
								{ type: "desktop_app", label: "Desktop", icon: RiTerminalBoxLine },
								{ type: "directory", label: "Código", icon: RiFolderLine },
							].map((item) => {
								const Icon = item.icon;
								const selected = targetType === item.type;
								return (
									<button
										key={item.type}
										type="button"
										onClick={() => setTargetType(item.type as CraftTargetType)}
										className={`flex-1 py-6 px-8 flex items-center justify-center space-x-6 ${
											selected
												? "bg-control-primary-bg text-control-primary-text tr-text-emphasis"
												: "text-text-muted hover:bg-control-bg-hovered"
										}`}
									>
										<Icon className="size-3.5" />
										<span>{item.label}</span>
									</button>
								);
							})}
						</div>
					</div>

					<div>
						<label className="block tr-text-metadata text-text-muted mb-4">Modo de Isolamento</label>
						<div className="flex rounded-md border border-control-border-default overflow-hidden bg-container-workspace-bg tr-text-metadata">
							<button
								type="button"
								onClick={() => setMode("clean_room")}
								className={`flex-1 py-6 px-12 flex items-center justify-center space-x-6 ${
									mode === "clean_room"
										? "bg-control-primary-bg text-control-primary-text tr-text-emphasis"
										: "text-text-muted hover:bg-control-bg-hovered"
								}`}
							>
								<RiShieldCheckLine className="size-3.5" />
								<span>Clean Room</span>
							</button>
							<button
								type="button"
								onClick={() => setMode("deep")}
								className={`flex-1 py-6 px-12 flex items-center justify-center space-x-6 ${
									mode === "deep"
										? "bg-control-primary-bg text-control-primary-text tr-text-emphasis"
										: "text-text-muted hover:bg-control-bg-hovered"
								}`}
							>
								<RiEyeLine className="size-3.5" />
								<span>Deep Inspection</span>
							</button>
						</div>
					</div>
				</div>

				<div>
					<label className="block tr-text-metadata text-text-muted mb-4">Endereço / Caminho do Alvo</label>
					<input
						type="text"
						value={target}
						onChange={(e) => setTarget(e.target.value)}
						className="w-full px-12 py-6 tr-text-ui bg-container-workspace-bg border border-control-border-default rounded-md focus:outline-none focus:border-control-border-active"
						placeholder="https://site.com ou D:\\app\\binary.exe"
					/>
				</div>

				<div className="grid grid-cols-2 gap-16">
					<div>
						<label className="block tr-text-metadata text-text-muted mb-4">Stack de Destino</label>
						<input
							type="text"
							value={targetStack}
							onChange={(e) => setTargetStack(e.target.value)}
							className="w-full px-12 py-6 tr-text-ui bg-container-workspace-bg border border-control-border-default rounded-md focus:outline-none focus:border-control-border-active"
						/>
					</div>
					<div>
						<label className="block tr-text-metadata text-text-muted mb-4">Instruções / Customização</label>
						<input
							type="text"
							value={instructions}
							onChange={(e) => setInstructions(e.target.value)}
							className="w-full px-12 py-6 tr-text-ui bg-container-workspace-bg border border-control-border-default rounded-md focus:outline-none focus:border-control-border-active"
						/>
					</div>
				</div>

				<button
					type="button"
					disabled={isRunning}
					onClick={handleStartCraft}
					className="w-full py-8 bg-control-primary-bg hover:bg-control-primary-bg-hovered text-control-primary-text tr-text-ui rounded-md transition-colors flex items-center justify-center space-x-8 disabled:bg-control-disabled-bg disabled:text-control-disabled-text"
				>
					<RiPlayFill className="size-4" />
					<span>{isRunning ? "Executando Pipeline..." : "Iniciar Craft Anything"}</span>
				</button>
			</div>

			{/* Stepper de 4 Fases */}
			{projectState && (
				<div className="space-y-24">
					<div className="grid grid-cols-4 gap-8">
						{projectState.steps.map((st) => {
							const isPassed = st.status === "passed";
							const isCurrent = st.status === "in_progress";
							return (
								<div
									key={st.step}
									className={`p-12 rounded-md border tr-text-metadata flex flex-col justify-between ${
										isPassed
											? "border-border-default bg-container-elevated-bg text-feedback-success"
											: isCurrent
											? "border-border-default bg-primary-subtle text-primary tr-text-emphasis animate-pulse"
											: "border-border-default bg-container-workspace-bg text-text-muted"
									}`}
								>
									<div className="flex items-center justify-between mb-4">
										<span className="tr-text-emphasis">{st.title}</span>
										{isPassed && <RiCheckLine className="size-4" />}
									</div>
									<span className="text-text-muted">
										{isPassed ? "Concluído" : isCurrent ? "Executando..." : "Aguardando"}
									</span>
								</div>
							);
						})}
					</div>

					{/* Comparador de Telas e Diffs Visuais */}
					<div className="border border-border-default rounded-lg p-16 bg-container-elevated-bg space-y-16">
						<div className="flex items-center justify-between">
							<div className="flex items-center space-x-8">
								<RiEyeLine className="size-4 text-primary" />
								<h3 className="tr-text-emphasis">Comparação e Similaridade Visual</h3>
							</div>
							<div className="flex items-center space-x-4 tr-text-metadata bg-container-workspace-bg border border-border-default rounded-md p-2">
								{(['desktop', 'tablet', 'mobile'] as const).map((vp) => (
									<button
										key={vp}
										type="button"
										onClick={() => setActiveViewport(vp)}
										className={`px-8 py-4 rounded-md capitalize ${
											activeViewport === vp
												? "bg-control-primary-bg text-control-primary-text tr-text-emphasis"
												: "text-text-muted hover:text-text-default"
										}`}
									>
										{vp}
									</button>
								))}
							</div>
						</div>

						{/* Métrica Geral de Similaridade */}
						<div className="flex items-center justify-between p-12 bg-container-workspace-bg rounded-md border border-border-default tr-text-ui">
							<span className="text-text-muted">Taxa Global de Similaridade (Clean-Room):</span>
							<span className="tr-text-emphasis text-feedback-success">
								{projectState.similarityScore?.toFixed(1)}%
							</span>
						</div>

						{/* Side-by-Side Mockup Canvas */}
						<div className="grid grid-cols-2 gap-16">
							<div className="flex flex-col space-y-8">
								<div className="tr-text-ui text-text-muted flex items-center justify-between">
									<span className="tr-text-emphasis">Alvo Original</span>
									<span className="tr-text-metadata text-text-subtle">Reference capture</span>
								</div>
								<div className="h-48 border border-border-default rounded-md bg-container-workspace-bg flex items-center justify-center p-16 text-center">
									<div className="space-y-4">
										<RiGlobalLine className="size-8 mx-auto text-text-muted" />
										<p className="tr-text-ui text-text-default">Original: {projectState.config.target}</p>
										<span className="tr-text-metadata text-text-subtle block">Viewport: {activeViewport}</span>
									</div>
								</div>
							</div>

							<div className="flex flex-col space-y-8">
								<div className="tr-text-ui text-text-muted flex items-center justify-between">
									<span className="tr-text-emphasis">Versão Recriada (ThinkRail)</span>
									<span className="tr-text-metadata text-feedback-success">94.8% similar</span>
								</div>
								<div className="h-48 border border-border-default rounded-md bg-container-workspace-bg flex items-center justify-center p-16 text-center">
									<div className="space-y-4">
										<RiSparklingFill className="size-8 mx-auto text-feedback-success" />
										<p className="tr-text-emphasis text-text-default">Reconstrução Ativa</p>
										<span className="tr-text-metadata text-text-muted block">Stack: {projectState.config.targetStack}</span>
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Feed de Eventos do Agente */}
					<div className="border border-border-default rounded-lg p-16 bg-container-elevated-bg space-y-12">
						<h3 className="tr-text-metadata text-text-muted uppercase">Feed de Execução & Aprovações</h3>
						<div className="space-y-8 max-h-48 overflow-y-auto pr-4">
							{projectState.feed.map((item, idx) => (
								<div
									key={idx}
									className="tr-text-ui p-8 rounded-md bg-container-workspace-bg border border-border-default flex items-start space-x-8"
								>
									<span className="tr-text-emphasis text-primary uppercase tr-text-metadata px-6 py-2 rounded-md bg-primary-subtle shrink-0">
										{item.kind}
									</span>
									<span className="text-text-default">
										{'text' in item ? item.text : 'Ação de trabalho registrada'}
									</span>
								</div>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
