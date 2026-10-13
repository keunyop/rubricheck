import type { Locale } from "./config";
export const HOME_SEO: Record<Locale, { title: string; description: string; keywords: string[] }> = {
  en: { title: "RubriCheck | AI Rubric Checker", description: "Check your essay or assignment against your own rubric. Get estimated scores and revision priorities before submission. Try RubriCheck for free.", keywords: ["rubric checker", "ai rubric grader", "assignment rubric checker", "essay rubric checker", "rubric feedback tool"] },
  ko: { title: "RubriCheck | AI 과제 채점·에세이 피드백", description: "과제와 에세이를 채점 기준표에 맞춰 점검하세요. AI 예상 점수, 평가 항목별 피드백과 우선 개선 사항을 한국어로 확인하고 제출 전에 완성도를 높여보세요. 무료 체험 제공.", keywords: ["AI 과제 채점", "에세이 피드백", "루브릭 채점", "채점 기준표", "과제 검토", "AI 글쓰기 피드백"] },
  ms: { title: "RubriCheck | Semakan Rubrik dan Penilaian Tugasan AI", description: "Semak esei dan tugasan berdasarkan rubrik anda. Dapatkan anggaran markah, maklum balas dalam Bahasa Melayu dan cadangan penambahbaikan sebelum menghantar. Cuba percuma.", keywords: ["semakan rubrik", "penilaian tugasan AI", "semak esei", "maklum balas tugasan", "rubrik pemarkahan", "anggaran markah"] },
};
