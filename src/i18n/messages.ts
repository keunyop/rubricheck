// English source messages are the stable fallback. Each entry supplies Korean and Malay.
import { core } from "./core";
import { errors } from "./errors";
import { extras } from "./extras";
import { billing } from "./billing";
import { legal } from "./legal";
export const messages: Record<string, readonly [string, string]> = { ...core, ...errors, ...extras, ...billing, ...legal };
