import { readFileSync } from "node:fs";
import { validateScoringDataset } from "../lib/scoringValidation.ts";

const input = process.argv[2];
if (!input) {
  console.error("Usage: npm run validate:scoring -- path/to/human-graded-holdout.json");
  process.exitCode = 1;
} else {
  try {
    console.log(JSON.stringify(validateScoringDataset(JSON.parse(readFileSync(input, "utf8"))), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid scoring dataset");
    process.exitCode = 1;
  }
}
