import { loadUserTemplates } from "../loader.js";
import { BUILTIN_TEMPLATES, getBuiltinTemplate } from "./builtin.js";
import type { PlanTemplate } from "./types.js";

type PlanTemplateLookupOptions = {
  userTemplatesDir?: string;
};

export async function resolvePlanTemplate(
  name: string,
  options?: PlanTemplateLookupOptions
): Promise<PlanTemplate | undefined> {
  if (!options?.userTemplatesDir) {
    return getBuiltinTemplate(name);
  }

  const userTemplates = await loadUserTemplates(options.userTemplatesDir);
  return userTemplates.find((template) => template.name === name) ?? getBuiltinTemplate(name);
}

export async function listPlanTemplates(
  options?: PlanTemplateLookupOptions
): Promise<PlanTemplate[]> {
  if (!options?.userTemplatesDir) {
    return [...BUILTIN_TEMPLATES];
  }

  const userTemplates = await loadUserTemplates(options.userTemplatesDir);
  return [...userTemplates, ...BUILTIN_TEMPLATES];
}
