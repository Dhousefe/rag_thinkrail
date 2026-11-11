import { describe, expect, it } from "bun:test";
import {
	normalizePathForComparison,
	resolveTargetProjectSlug,
} from "../NeuralCorePanel";

describe("normalizePathForComparison", () => {
	it("normaliza barras invertidas do Windows para barras normais", () => {
		expect(normalizePathForComparison("D:\\Projet_Thinkrail\\source\\thinkrail")).toBe(
			"d:/projet_thinkrail/source/thinkrail",
		);
	});

	it("converte drive letters do Windows para minúsculo", () => {
		expect(normalizePathForComparison("C:/Users/Dhousefe/.hermes")).toBe(
			"c:/users/dhousefe/.hermes",
		);
		expect(normalizePathForComparison("c:/Users/Dhousefe/.hermes")).toBe(
			"c:/users/dhousefe/.hermes",
		);
	});

	it("remove trailing slashes duplicadas", () => {
		expect(normalizePathForComparison("D:/source/thinkrail///")).toBe(
			"d:/source/thinkrail",
		);
	});

	it("trata nulo e indefinido de forma segura", () => {
		expect(normalizePathForComparison(null)).toBe("");
		expect(normalizePathForComparison(undefined)).toBe("");
	});
});

describe("resolveTargetProjectSlug", () => {
	const mockProjects = [
		{
			slug: "project-thinkrail",
			path: "D:\\Projet_Thinkrail\\source\\thinkrail",
		},
		{
			slug: "hermes-3-0",
			path: "C:/Users/Dhousefe/.hermes/projects/hermes-3-0",
		},
		{
			slug: "project-gif",
			path: "D:/Project_gif/project-gif",
		},
	];

	it("resolve o slug correto com correspondência exata de caminho no Windows com drive letters maiúsculas e minúsculas", () => {
		const ws = {
			worktreePath: "d:/projet_thinkrail/source/thinkrail/",
			projectId: "thinkrail",
		};
		expect(resolveTargetProjectSlug(ws, mockProjects)).toBe("project-thinkrail");
	});

	it("resolve o slug através do nome da pasta raiz do workspace quando caminhos absolutos divergirem", () => {
		const ws = {
			worktreePath: "E:/dev/sources/thinkrail",
		};
		expect(resolveTargetProjectSlug(ws, mockProjects)).toBe("project-thinkrail");
	});

	it("resolve pelo projectId do workspace caso não haja correspondência de caminho", () => {
		const ws = {
			projectId: "project-gif",
		};
		expect(resolveTargetProjectSlug(ws, mockProjects)).toBe("project-gif");
	});

	it("utiliza fallbackSlug se fornecido e existente na lista de projetos", () => {
		const ws = {
			worktreePath: "/outro/caminho/desconhecido",
		};
		expect(resolveTargetProjectSlug(ws, mockProjects, "hermes-3-0")).toBe("hermes-3-0");
	});

	it("retorna o primeiro projeto como fallback seguro se nada corresponder", () => {
		const ws = {
			worktreePath: "/outro/caminho/desconhecido",
		};
		expect(resolveTargetProjectSlug(ws, mockProjects)).toBe("project-thinkrail");
	});

	it("retorna null se não houver projetos nem workspace nem fallback", () => {
		expect(resolveTargetProjectSlug(null, [], null)).toBeNull();
	});
});
