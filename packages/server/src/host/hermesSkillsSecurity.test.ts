import { describe, expect, it } from "bun:test";
import { findHermesSkills, installHermesSkill } from "./hermes";

describe("Hermes Skills Security", () => {
	describe("installHermesSkill security validation", () => {
		it("rejects leading hyphens and option injection", async () => {
			const result = await installHermesSkill({
				repoUrl: "--upload-pack=evil.sh",
			});
			expect(result.success).toBe(false);
			expect(result.message).toContain("opções ou argumentos com traço");
		});

		it("rejects non-http(s) protocols like file:// or ssh://", async () => {
			const fileResult = await installHermesSkill({
				repoUrl: "file:///etc/passwd",
			});
			expect(fileResult.success).toBe(false);
			expect(fileResult.message).toContain("protocolo HTTP ou HTTPS");

			const sshResult = await installHermesSkill({
				repoUrl: "git@github.com:foo/bar.git",
			});
			expect(sshResult.success).toBe(false);
		});

		it("rejects empty or whitespace URLs", async () => {
			const result = await installHermesSkill({
				repoUrl: "   ",
			});
			expect(result.success).toBe(false);
			expect(result.message).toContain("inválida");
		});
	});

	describe("findHermesSkills input sanitization", () => {
		it("sanitizes special search syntax and control characters", async () => {
			const result = await findHermesSkills({
				query: 'react:foo"stars:\u0000\n',
				limit: 5,
				minStars: 100000,
			});
			expect(result.query).toBeDefined();
			expect(Array.isArray(result.results)).toBe(true);
		});

		it("returns empty results for empty or blank query after sanitization", async () => {
			const result = await findHermesSkills({
				query: '   ::: ""  ',
			});
			expect(result.results).toEqual([]);
		});
	});
});
