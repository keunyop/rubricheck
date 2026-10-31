// English source messages are the stable fallback. Each entry supplies Korean and Malay.
import { core } from "./core";
import { errors } from "./errors";
import { extras } from "./extras";
import { billing } from "./billing";
import { legal } from "./legal";
import { growth } from "./growth";
import { saas } from "./saas";
import { entry } from "./entry";
import { onboarding } from "./onboarding";
export const messages: Record<string, readonly [string, string]> = { ...core, ...errors, ...extras, ...billing, ...legal, ...growth, ...saas, ...onboarding, ...entry,
  "Rubric point adjustments": ["루브릭 감점·가산점", "Pelarasan mata rubrik"],
  "Criterion range totals {low}-{high}, plus rubric adjustments {adjustment}, divided by the base rubric total {total} x 100, give {range} / 100 (bounded to 0-100). Bonus and deduction rules do not increase the base total.": [
    "항목별 범위 합계 {low}-{high}에 루브릭 감점·가산점 {adjustment}를 적용하고 기본 총점 {total}로 나눈 뒤 100을 곱하면 {range} / 100입니다(0~100 범위). 가산점과 감점은 기본 총점을 늘리지 않습니다.",
    "Jumlah julat kriteria {low}-{high}, ditambah pelarasan rubrik {adjustment}, dibahagi jumlah asas rubrik {total} x 100, memberikan {range} / 100 (dihadkan kepada 0-100). Bonus dan potongan tidak menambah jumlah asas.",
  ],
};
