import Link from "next/link";
import { deleteTransaction } from "@/app/actions/fund";
import { Card, Money } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getFund, getLeaderboards } from "@/lib/stats";
import { DeleteTransactionButton, SettleAllForm, TransactionForm } from "./fund-forms";

export default async function FundPage() {
  const me = await requireUser();
  const isAdmin = me.role === "ADMIN";
  const [{ all }, { transactions, held }, players] = await Promise.all([
    getLeaderboards(),
    getFund(),
    isAdmin
      ? prisma.user.findMany({ where: { role: "PLAYER" }, select: { id: true, displayName: true }, orderBy: { displayName: "asc" } })
      : [],
  ]);

  const moved = new Map<string, { deposited: number; withdrawn: number }>();
  for (const t of transactions) {
    const m = moved.get(t.userId) ?? { deposited: 0, withdrawn: 0 };
    if (t.kind === "DEPOSIT") m.deposited += t.amount;
    else m.withdrawn += t.amount;
    moved.set(t.userId, m);
  }
  const wallets = [...all].sort((a, b) => b.wallet - a.wallet);
  const owedToPlayers = wallets.reduce((t, p) => t + Math.max(p.wallet, 0), 0);
  const owedToFund = wallets.reduce((t, p) => t + Math.max(-p.wallet, 0), 0);
  const open = wallets.filter((p) => p.wallet !== 0).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Fund</h1>
        <p lang="vi" className="text-sm text-neutral-500">
          Ví = lời lỗ + tiền đã nạp − tiền đã rút. Ví dương là số tiền người chơi còn được rút, ví âm là số tiền còn phải
          nạp vào quỹ. Nạp/rút không làm thay đổi lời lỗ hay bảng xếp hạng.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="py-3">
          <div className="text-xs text-neutral-500">Cash held by the treasurer</div>
          <div className="mt-1 text-lg font-semibold">{formatMoney(held, { signed: held < 0 })}</div>
        </Card>
        <Card className="py-3">
          <div className="text-xs text-neutral-500">Players can withdraw</div>
          <div className="mt-1 text-lg font-semibold">{formatMoney(owedToPlayers)}</div>
        </Card>
        <Card className="py-3">
          <div className="text-xs text-neutral-500">Players still owe</div>
          <div className="mt-1 text-lg font-semibold">{formatMoney(owedToFund)}</div>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Wallets</h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-500">
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th className="px-4 py-2">Player</th>
                <th className="px-4 py-2 text-right">Profit</th>
                <th className="px-4 py-2 text-right">Deposited</th>
                <th className="px-4 py-2 text-right">Withdrawn</th>
                <th className="px-4 py-2 text-right">Wallet</th>
              </tr>
            </thead>
            <tbody>
              {wallets.map((p) => {
                const m = moved.get(p.userId);
                return (
                  <tr key={p.userId} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/players/${p.userId}`} className="hover:underline">{p.displayName}</Link>
                    </td>
                    <td className="px-4 py-2 text-right"><Money cents={p.net} /></td>
                    <td className="px-4 py-2 text-right tabular-nums">{m?.deposited ? formatMoney(m.deposited) : "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{m?.withdrawn ? formatMoney(m.withdrawn) : "—"}</td>
                    <td className="px-4 py-2 text-right font-semibold"><Money cents={p.wallet} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </section>

      {isAdmin && (
        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Record a deposit or withdrawal</h2>
            <Card><TransactionForm players={players} ids={transactions.map((t) => t.id)} /></Card>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-semibold">Settle everyone</h2>
            <Card className="space-y-3 text-sm">
              <p lang="vi" className="text-neutral-600 dark:text-neutral-300">
                Ghi một khoản nạp cho mọi người đang nợ và một khoản rút cho mọi người đang dư, để tất cả ví về 0. Chỉ bấm
                khi tiền đã thực sự được trao tay xong.
              </p>
              <SettleAllForm count={open} />
            </Card>
          </section>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">History</h2>
        {transactions.length === 0 ? (
          <Card lang="vi" className="text-center text-neutral-500">Chưa có khoản nạp/rút nào.</Card>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-neutral-500">
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Player</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2">Note</th>
                  {isAdmin && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(t.happenedAt)}</td>
                    <td className="px-4 py-2">
                      <Link href={`/players/${t.user.id}`} className="hover:underline">{t.user.displayName}</Link>
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {t.kind === "DEPOSIT" ? "Deposit " : "Withdraw "}
                      <span className="font-medium tabular-nums">{formatMoney(t.amount)}</span>
                    </td>
                    <td className="px-4 py-2 text-neutral-500">{t.note}</td>
                    {isAdmin && (
                      <td className="px-4 py-2 text-right">
                        <DeleteTransactionButton action={deleteTransaction.bind(null, t.id)} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
