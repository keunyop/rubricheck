"use client";

import { useRef, type ComponentProps } from "react";
import Image from "next/image";
import Link from "next/link";
import { QuizSidebar } from "./QuizSidebar";
import { useLanguage } from "./LanguageProvider";
import type { QuizLibrary } from "../../src/lib/quizTypes";
import styles from "../quizzes/quiz.module.css";
import workspaceStyles from "../home.module.css";

export function QuizWorkspace({ children, access, ...sidebar }: Omit<ComponentProps<typeof QuizSidebar>, "accountDialogRef"> & { access?: QuizLibrary["access"] }) {
  const { t, href } = useLanguage();
  const account = useRef<HTMLDialogElement>(null);
  const { email, loginHref } = sidebar;
  return <QuizSidebar {...sidebar} accountDialogRef={account}>
    <main id="main-content" tabIndex={-1} className={`${styles.page} ${styles.workspacePage}`}>
      <div className={styles.workspaceContent}>
        <header className={styles.workspaceHeader} aria-label={t("Workspace header")}>
          <div className={workspaceStyles.topbar}>
            <div className={workspaceStyles.brand}><Image src="/rubricheck-tab-icon.svg" alt="" width={32} height={32} /><span>RubriCheck</span></div>
            <div className={styles.workspaceActions}>
              <Link href={href("/pricing")} className={styles.headerAction}>{t("Pricing")}</Link>
              {email ? <>
                <button type="button" className={styles.headerAvatar} aria-label={t("Open account menu")} aria-haspopup="dialog" title={email} onClick={() => account.current?.showModal()}>{email[0].toUpperCase()}</button>
                {access && <Link className={styles.questionBalance} href={href(access.pro ? "/billing/manage" : "/pricing")}>{access.pro ? t("Pro") : t("{count} questions left", { count: access.remaining })}</Link>}
              </> : <Link className={styles.headerAction} href={loginHref ?? href("/workspace?start=login")}>{t("Log in")}</Link>}
            </div>
          </div>
          <nav aria-label={t("Product and support")} className={workspaceStyles.discoveryNav}>
            {[["/product", "Meet RubriCheck"], ["/help", "Help center"]].map(([url, label]) => <Link key={url} href={href(url)} target="_blank" rel="noopener">{t(label)} <span aria-hidden="true">↗</span><span className="sr-only"> ({t("opens in a new tab")})</span></Link>)}
          </nav>
        </header>
        <div className={styles.workspaceBody}>{children}</div>
      </div>
    </main>
  </QuizSidebar>;
}
