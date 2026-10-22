"use client";

import { FREE_TRIAL_LIMIT } from "../../src/config/plans";
import { ACCOUNT_FEATURE_TIERS, canAccessDetailedFeedback, canAccessRewriteSuggestions, canUseStrictMode, getVisibleTopImprovementsCount } from "../../src/lib/accountFeatureAccess";
import { useLanguage } from "./LanguageProvider";
import styles from "./planComparison.module.css";

export function PlanComparison() {
  const { t } = useLanguage();
  return <details className={styles.comparison}>
    <summary>{t("Compare Free, top-ups and Pro")}<span aria-hidden="true">+</span></summary>
    <div className={styles.scroll} role="region" aria-label={t("Plan feature comparison")} tabIndex={0}>
      <table>
        <caption className="sr-only">{t("Plan feature comparison")}</caption>
        <thead><tr><th scope="col">{t("Included features")}</th><th scope="col">{t("Free")}</th><th scope="col">{t("Top-up")}</th><th scope="col">Pro</th></tr></thead>
        <tbody>
          <tr><th scope="row">{t("Evaluations")}</th><td>{t("{count} free checks", { count: FREE_TRIAL_LIMIT })}</td><td>{t("Per purchased pack")}</td><td>{t("Unlimited evaluations")}</td></tr>
          <tr><th scope="row">{t("Estimated scores")}</th>{ACCOUNT_FEATURE_TIERS.map(tier => <td key={tier}>{t("Included")}</td>)}</tr>
          <tr><th scope="row">{t("Improvement priorities")}</th>{ACCOUNT_FEATURE_TIERS.map(tier => <td key={tier}>{getVisibleTopImprovementsCount(tier)}</td>)}</tr>
          {[
            { label: "Detailed criterion feedback", included: canAccessDetailedFeedback },
            { label: "Strict Mode", included: canUseStrictMode },
            { label: "Rewrite suggestions", included: canAccessRewriteSuggestions },
          ].map(feature => <tr key={feature.label}><th scope="row">{t(feature.label)}</th>{ACCOUNT_FEATURE_TIERS.map(tier => <td key={tier} data-included={feature.included(tier)}>{t(feature.included(tier) ? "Included" : "Not included")}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
    <p className={styles.note}>{t("Before signing up, you can try one summary preview of your own assignment. The Free column describes the checks available after sign-up.")}</p>
  </details>;
}
