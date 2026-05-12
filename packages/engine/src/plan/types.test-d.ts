import * as v from "valibot";
import { PlanSchema, parsePlan } from "./schema.js";
import type { Plan } from "./types.js";

type Assert<T extends true> = T;

type _schemaHasPlanVersion = Assert<v.InferOutput<typeof PlanSchema>["schemaVersion"] extends 1 ? true : false>;
type _parsePlanReturnsPlan = Assert<ReturnType<typeof parsePlan> extends Plan ? true : false>;
type _planMatchesParsePlan = Assert<Plan extends ReturnType<typeof parsePlan> ? true : false>;
