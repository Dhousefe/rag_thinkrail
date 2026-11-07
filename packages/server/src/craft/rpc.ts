import type {
	CraftStartProjectInput,
	CraftStartProjectResult,
	CraftGetProjectStateInput,
	CraftProjectState,
	CraftListProjectsResult,
	CraftSubmitApprovalInput,
} from "@thinkrail/contracts";
import { craftEngine } from "./engine";

export const craftRpc = {
	async startProject(input: CraftStartProjectInput): Promise<CraftStartProjectResult> {
		const projectState = await craftEngine.startProject(input);
		return {
			projectId: projectState.config.id,
			projectState,
		};
	},

	async getProjectState(input: CraftGetProjectStateInput): Promise<CraftProjectState | null> {
		return craftEngine.getProject(input.projectId) || null;
	},

	async listProjects(): Promise<CraftListProjectsResult> {
		return {
			projects: craftEngine.listProjects(),
		};
	},

	async submitApproval(input: CraftSubmitApprovalInput): Promise<{ success: boolean }> {
		const success = craftEngine.submitApproval(input.projectId, input.requestId, input.approved);
		return { success };
	},
};
