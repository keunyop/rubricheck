"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DRAFT_KEY, parseDraft } from "../../src/lib/evaluationDraft";
import { useLanguage } from "./LanguageProvider";
import { useAccountSummary } from "./AccountSummaryProvider";
import styles from "./product.module.css";

// Visiting an introduction is not a signal that someone has used the product.
// Only offer to continue a real, unexpired draft belonging to this browser's user.
export function LandingEntry({ home = false }: { home?: boolean }) {
  const { t, href } = useLanguage();
  const router = useRouter();
  const { signedInEmail, hasLoadedAccountSummary } = useAccountSummary();
  const [hasDraft, setHasDraft] = useState(false);

  // A public page may already be in Next's navigation cache when login completes.
  // The account summary also validates the session for that client navigation.
  useEffect(() => {
    if (home && hasLoadedAccountSummary && signedInEmail) {
      router.replace(href("/workspace") + window.location.search + window.location.hash);
    }
  }, [home, hasLoadedAccountSummary, signedInEmail, href, router]);

  useEffect(() => {
    if (!home) return;
    const restoreLegacyAnchor = () => {
      if (window.location.hash === "#rubric-checker") {
        window.location.replace(href("/workspace") + window.location.search + window.location.hash);
      }
    };
    restoreLegacyAnchor();
    window.addEventListener("hashchange", restoreLegacyAnchor);
    return () => window.removeEventListener("hashchange", restoreLegacyAnchor);
  }, [home, href]);

  useEffect(() => {
    if (!hasLoadedAccountSummary) return;
    const checkDraft = () => {
      try {
        const draft = parseDraft(sessionStorage.getItem(DRAFT_KEY) ?? localStorage.getItem(DRAFT_KEY));
        setHasDraft(Boolean(draft && (!draft.ownerEmail || draft.ownerEmail === signedInEmail) && (
          draft.rubricText.trim() || draft.assignmentText.trim() || draft.assignmentInstructions?.trim() ||
          draft.hadRubricFile || draft.hadAssignmentFile || draft.rubricMode === "library"
        )));
      } catch { setHasDraft(false); }
    };
    checkDraft();
    window.addEventListener("pageshow", checkDraft);
    return () => window.removeEventListener("pageshow", checkDraft);
  }, [hasLoadedAccountSummary, signedInEmail]);

  if (!hasDraft) return null;
  return <aside className={styles.resume} aria-label={t("Continue your work")}>
    <div><strong>{t("Have a draft in progress?")}</strong><p>{t("Continue with the inputs saved in this browser.")}</p></div>
    <Link href={href("/workspace")}>{t("Continue my draft")} <span aria-hidden="true">→</span></Link>
  </aside>;
}
