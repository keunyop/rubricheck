"use client";

import Link from "next/link";
import { useLanguage } from "./LanguageProvider";
import styles from "./assignmentWorkspace.module.css";

export function SidebarAccountControls({ email, onAccount, onLogin, loginHref }: {
  email: string;
  onAccount: () => void;
  onLogin?: () => void;
  loginHref?: string;
}) {
  const { t } = useLanguage();
  return <div className={styles.sidebarFooter}>
    {email ? <button className={styles.accountTrigger} aria-label={t("Open account menu")} aria-haspopup="dialog" onClick={onAccount}>
      <span className={styles.avatar} aria-hidden="true">{email[0].toUpperCase()}</span><span className={styles.email} title={email}>{email}</span>
      <svg className={styles.accountMore} viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
    </button> : <div className="flex items-center gap-2">
      {loginHref ? <Link className={styles.login} href={loginHref}>{t("Log in")}</Link> : <button className={styles.login} onClick={onLogin}>{t("Log in")}</button>}
      <button className={styles.iconButton} aria-label={t("Language preferences")} title={t("Language preferences")} aria-haspopup="dialog" onClick={onAccount}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></svg>
      </button>
    </div>}
  </div>;
}
