/* v8 ignore file */
/* eslint-disable no-process-env */
import { environmentSchema } from "./environment.schema";

export { environmentSchema } from "./environment.schema";

export const environmentConfiguration = environmentSchema.parse(process.env);
