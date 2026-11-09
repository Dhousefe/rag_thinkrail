import {
	RiCheckDoubleLine,
	RiCloseLine,
	RiFileCopyLine,
	RiFingerprintLine,
	RiShieldCheckLine,
} from "@remixicon/react";
import { useState } from "react";
import { toast } from "@/store";
import type { SemanticFingerprintInfo } from "../geometry";

interface NeuralCoreFingerprintCardProps {
	fingerprint: SemanticFingerprintInfo;
	onClose?: () => void;
}

export function NeuralCoreFingerprintCard({
	fingerprint,
	onClose,
}: NeuralCoreFingerprintCardProps) {
	const [copied, setCopied] = useState(false);

	const handleCopyHash = () => {
		if (navigator.clipboard) {
			navigator.clipboard.writeText(fingerprint.fingerprintHash);
			setCopied(true);
			toast.success("Impressão digital copiada", fingerprint.shortHash);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	return (
		<div className="flex flex-col gap-8 rounded-lg border border-feedback-success-muted bg-container-elevated-bg p-12 text-text-default shadow-2xl backdrop-blur-md max-w-[420px] pointer-events-auto transition-all animate-in fade-in duration-200">
			{/* Cabeçalho do Auditor Anti-Plágio */}
			<div className="flex items-center justify-between border-b border-border-default pb-8">
				<div className="flex items-center gap-6">
					<div className="flex size-24 items-center justify-center rounded-full bg-feedback-success-subtle text-feedback-success">
						<RiShieldCheckLine className="size-16" />
					</div>
					<div>
						<div className="flex items-center gap-4">
							<span className="tr-text-emphasis text-feedback-success uppercase">
								Auditor Anti-Plágio
							</span>
							<span className="rounded bg-feedback-success-subtle px-4 py-2 tr-code-text text-feedback-success tr-text-emphasis">
								{fingerprint.integrityStatus}
							</span>
						</div>
						<h4 className="tr-text-ui text-text-default tr-text-emphasis">
							Impressão Digital Semântica
						</h4>
					</div>
				</div>
				{onClose && (
					<button
						type="button"
						onClick={onClose}
						className="rounded p-2 text-text-muted hover:text-text-default hover:bg-control-bg transition-colors"
						title="Fechar auditor"
						aria-label="Fechar"
					>
						<RiCloseLine className="size-14" />
					</button>
				)}
			</div>

			{/* Hash Semântico Topológico */}
			<div className="flex flex-col gap-4 rounded border border-border-default bg-control-bg p-8">
				<div className="flex items-center justify-between tr-text-metadata text-text-muted">
					<span className="flex items-center gap-4">
						<RiFingerprintLine className="size-12 text-primary" />
						Hash Topológico RAG (SHA-256 equiv)
					</span>
					<button
						type="button"
						onClick={handleCopyHash}
						className="flex items-center gap-2 tr-text-metadata text-primary hover:underline"
						title="Copiar Hash Completo"
					>
						{copied ? (
							<RiCheckDoubleLine className="size-12 text-feedback-success" />
						) : (
							<RiFileCopyLine className="size-12" />
						)}
						{copied ? "Copiado!" : "Copiar"}
					</button>
				</div>
				<div className="tr-code-text break-all leading-tight text-primary select-all">
					{fingerprint.fingerprintHash}
				</div>
			</div>

			{/* Métricas de Integridade Estrutural */}
			<div className="grid grid-cols-3 gap-6 text-center tr-text-ui">
				<div className="flex flex-col rounded bg-control-bg p-6">
					<span className="tr-text-metadata text-text-muted uppercase">Classes</span>
					<span className="tr-text-emphasis text-text-default">
						{fingerprint.totalClasses}
					</span>
				</div>
				<div className="flex flex-col rounded bg-control-bg p-6">
					<span className="tr-text-metadata text-text-muted uppercase">Relações</span>
					<span className="tr-text-emphasis text-text-default">
						{fingerprint.totalRelations}
					</span>
				</div>
				<div className="flex flex-col rounded bg-control-bg p-6">
					<span className="tr-text-metadata text-text-muted uppercase">Entropia</span>
					<span className="tr-text-emphasis text-text-default">
						{fingerprint.entropy} bit
					</span>
				</div>
			</div>

			{/* Composição Poligonal Auditada */}
			{Object.keys(fingerprint.typeDistribution).length > 0 && (
				<div className="flex flex-col gap-4">
					<span className="tr-text-metadata text-text-muted uppercase">
						Polígonos Indexados por Tipo
					</span>
					<div className="flex flex-wrap gap-4 tr-text-metadata">
						{Object.entries(fingerprint.typeDistribution).map(([kind, count]) => (
							<span
								key={kind}
								className="rounded border border-border-default bg-control-bg px-6 py-2 text-text-muted tr-code-text"
							>
								<strong className="text-text-default tr-text-emphasis">{kind}</strong>: {count}
							</span>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
