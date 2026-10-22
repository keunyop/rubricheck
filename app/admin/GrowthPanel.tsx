"use client";
import { useState } from "react";
import type { GrowthReport } from "../../src/lib/growthReport";

export function GrowthPanel() {
  const [days,setDays]=useState("30"),[report,setReport]=useState<GrowthReport|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  async function load() {
    setBusy(true); setMessage("");
    try { const res=await fetch(`/api/admin/growth?days=${days}`,{cache:"no-store"}); const data=await res.json(); if (!res.ok || !data.available) {setReport(null);setMessage(data.reason ?? "Admin access or data is unavailable.");} else setReport(data); }
    catch {setReport(null);setMessage("Unable to load growth metrics.");} finally {setBusy(false);}
  }
  return <section className="rounded-xl border border-slate-200 bg-white p-5">
    <h2 className="text-lg font-semibold">Revenue and conversion measurement</h2>
    <p className="mt-2 text-sm text-slate-600">Seven-day observation windows. Recent cohorts remain pending; unobserved history stays unknown. All amounts retain their original currency.</p>
    <label className="mt-3 inline-block text-sm">Reporting period <select className="ml-2 rounded border p-1" value={days} onChange={e=>setDays(e.target.value)}>{[7,14,30,60,89].map(n=><option key={n} value={n}>{n} days</option>)}</select></label>
    <button type="button" disabled={busy} onClick={load} className="ml-3 rounded bg-slate-900 px-3 py-2 text-sm text-white">{busy?"Loading…":"Review growth"}</button>
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    {report && <div className="mt-4 space-y-4 text-sm">
      <p>{report.coverage} First-purchase rates exclude known previous payers and accounts with unknown prior payment history.</p>
      {!report.complete && <p role="alert">Report exceeds 50,000 rows. Narrow the period; rates are withheld.</p>}
      <p>Collection started: {report.collectionStartedAt ?? "No events collected"}. Failures: server {report.failures.server}, validation {report.failures.validation}, access {report.failures.access}, network {report.failures.network}.</p>
      <div className="overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Conversion by journey, first source and country</caption><thead><tr>{["Step","Journey / source / country","Mature users","Converted","Pending","Rate"].map(h=><th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{report.funnel.map((r,i)=><tr key={i} className="border-t"><td className="p-2">{r.step}</td><td className="p-2">{r.journey} / {r.source} / {r.country}</td><td className="p-2">{r.eligible}</td><td className="p-2">{r.converted}</td><td className="p-2">{r.pending}</td><td className="p-2">{r.rate===null?"Unavailable":(100*r.rate).toFixed(1)+"%"}</td></tr>)}</tbody></table></div>
      <p>Paid subscription starts: {report.subscriptionStarts}; ended subscriptions: {report.subscriptionCancellations}; payments with unknown first-purchase history: {report.firstPurchaseUnknown}.</p>
      <div className="overflow-x-auto"><table className="w-full text-left"><caption>Acquisition and collected revenue (not MRR)</caption><thead><tr>{["First / last source","Country","First payers","Gross","Refunds","Renewals","Lifetime"].map(h=><th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{report.acquisition.map((r,i)=><tr key={i} className="border-t"><td className="p-2">{r.source} / {r.lastSource}</td><td className="p-2">{r.country}</td><td className="p-2">{r.firstPayingCustomers}</td>{[r.revenueMinor,r.refundsMinor,r.renewalMinor,r.lifetimeMinor].map((n,j)=><td className="p-2" key={j}>{r.currency.toUpperCase()} {["cad","usd"].includes(r.currency) ? (n/100).toFixed(2) : `${n.toLocaleString()} minor units`}</td>)}</tr>)}</tbody></table></div>
    </div>}
  </section>;
}
