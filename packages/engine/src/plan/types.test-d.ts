import * as v from "valibot";
import { PlanSchema } from "./schema.js";
import type { Plan } from "./types.js";

type Assert<T extends true> = T;

type _interfaceFitsSchema = Assert<Plan extends v.InferOutput<typeof PlanSchema> ? true : false>;
type _schemaFitsInterface = Assert<v.InferOutput<typeof PlanSchema> extends Plan ? true : false>;
