import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Users } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { getAffiliateLinksForCreator, type AffiliateLink } from "../../services/affiliateService";
import { getCreatorAffiliateSales, type AffiliateInvitation } from "../../services/affiliateHistoryService";
import { computeLinkPerformance, summarizeByAffiliate } from "../../services/affiliateEarnings";
import { CurrencyCode, formatCurrency } from "../../utils/currency";
import { getUserFacingErrorMessage } from "../../utils/userFacingError";

interface Props {
  currency?: CurrencyCode | string;
  companyName?: string;
  demo?: { links: AffiliateLink[]; sales: AffiliateInvitation[]; names?: Record<string, string> };
}

/** Enterprise space: who promotes this creator's products and what they brought in. */
export const CreatorAffiliatesView: React.FC<Props> = ({ currency = "XOF", companyName, demo }) => {
  const { user } = useAuth();
  const creatorUid = demo ? "demo-creator" : user?.uid || "";
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [sales, setSales] = useState<AffiliateInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const money = (v: number) => formatCurrency(v, currency as CurrencyCode);

  const load = useCallback(async () => {
    if (demo) {
      setLinks(demo.links);
      setSales(demo.sales);
      setLoading(false);
      return;
    }
    if (!creatorUid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [l, s] = await Promise.all([
        getAffiliateLinksForCreator(creatorUid),
        getCreatorAffiliateSales(creatorUid),
      ]);
      setLinks(l);
      setSales(s);
    } catch (e) {
      setError(getUserFacingErrorMessage(e, "Impossible de charger vos affiliés. Réessayez."));
    } finally {
      setLoading(false);
    }
  }, [creatorUid, demo]);

  useEffect(() => {
    void load();
  }, [load]);

  const performance = useMemo(() => computeLinkPerformance(links, sales), [links, sales]);
  const affiliates = useMemo(
    () => summarizeByAffiliate(performance, new Set(links.map((l) => l.productId)), demo?.names),
    [performance, links, demo],
  );
  const totals = affiliates.reduce(
    (t, a) => ({ sales: t.sales + a.sales, revenue: t.revenue + a.revenue, commission: t.commission + a.commission }),
    { sales: 0, revenue: 0, commission: 0 },
  );

  return (
    <main className="min-h-screen pb-16 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Affiliés{companyName ? ` – ${companyName}` : ""}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Les personnes qui promeuvent vos produits avec leur lien, et ce qu’elles vous ont rapporté.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">
          {error}
        </p>
      )}

      {loading ? (
        <p role="status" className="mt-6 text-sm text-zinc-400">Chargement de vos affiliés…</p>
      ) : !error && (
        <>
          <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ["Ventes via affiliés", String(totals.sales)],
              ["Chiffre d’affaires apporté", money(totals.revenue)],
              ["Commissions dues", money(totals.commission)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <dt className="text-xs text-zinc-400">{label}</dt>
                <dd className="mt-1 text-lg font-bold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <section className="mt-8" aria-labelledby="creator-affiliates-heading">
            <h2 id="creator-affiliates-heading" className="mb-3 text-base font-bold">Vos affiliés</h2>
            {affiliates.length === 0 ? (
              <div className="rounded-xl border border-white/10 p-6 text-center">
                <Users className="mx-auto size-6 text-zinc-500" />
                <p className="mt-3 text-sm text-zinc-300">Personne n’a encore créé de lien pour vos produits.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {affiliates.map((a) => (
                  <li key={a.affiliateUid} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold break-words">{a.affiliateName}</p>
                      <p className="text-sm tabular-nums text-emerald-300">{money(a.revenue)} apportés</p>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400 tabular-nums">
                      {a.links} lien{a.links > 1 ? "s" : ""} · {a.sales} vente{a.sales > 1 ? "s" : ""} · commission {money(a.commission)}
                    </p>
                    <ul className="mt-3 space-y-1 border-t border-white/[0.06] pt-3 text-xs text-zinc-300">
                      {performance
                        .filter((p) => p.link.affiliateUid === a.affiliateUid)
                        .map((p) => (
                          <li key={p.link.id} className="flex flex-wrap justify-between gap-2">
                            <span className="break-words">{p.link.productName} ({p.link.commissionRate} %)</span>
                            <span className="tabular-nums">{p.sales} vente{p.sales > 1 ? "s" : ""} · {money(p.revenue)}</span>
                          </li>
                        ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
};
