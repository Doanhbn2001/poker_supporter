import type { ReactNode } from "react";
import { CardRow } from "@/components/playing-card";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { HAND_RANKINGS, TIEBREAKS, type Showdown } from "@/lib/poker-guide";

const SECTIONS = [
  { id: "co-ban", title: "Luật cơ bản" },
  { id: "vi-tri", title: "Vị trí & blind" },
  { id: "vong-cuoc", title: "4 vòng cược" },
  { id: "thu-tu-bai", title: "Thứ tự bộ bài" },
  { id: "so-bai", title: "So bài khi bằng nhau" },
  { id: "the-thuc-cup", title: "Thể thức cup" },
  { id: "the-thuc-cash", title: "Thể thức cash game" },
];

function Section({ id, children }: { id: string; children: ReactNode }) {
  const i = SECTIONS.findIndex((s) => s.id === id);
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <h2 className="text-lg font-semibold">
        <span className="text-neutral-500">{i + 1}.</span> {SECTIONS[i].title}
      </h2>
      {children}
    </section>
  );
}

function ShowdownCard({ title, board, players, result }: Showdown) {
  return (
    <Card className="space-y-3 text-sm">
      <h3 className="font-semibold">{title}</h3>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16 text-neutral-500">Bàn</span>
        <CardRow cards={board} />
      </div>
      {players.map((p) => (
        <div key={p.name} className="flex flex-wrap items-center gap-2">
          <span className="w-16 font-medium">{p.name}</span>
          <CardRow cards={p.hole} />
          <span className="text-neutral-600 dark:text-neutral-300">→ {p.best}</span>
        </div>
      ))}
      <p className="rounded-md bg-emerald-50 px-3 py-2 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
        {result}
      </p>
    </Card>
  );
}

const ACTIONS = [
  ["Check", "Không cược thêm, nhường lượt. Chỉ được khi chưa ai bet ở vòng đó."],
  ["Bet", "Đặt cược đầu tiên trong vòng."],
  ["Call", "Theo đúng mức cược đang có."],
  ["Raise", "Tố thêm: cược cao hơn mức hiện tại, ít nhất bằng mức tăng trước đó."],
  ["Fold", "Bỏ bài, mất số chip đã đặt vào pot."],
  ["All-in", "Đẩy hết chip còn lại. Ai ít chip hơn chỉ thắng được phần pot tương ứng (side pot)."],
];

export default async function GuidePage() {
  await requireUser();

  return (
    <div lang="vi" className="max-w-4xl space-y-10">
      <div>
        <h1 className="text-xl font-semibold">Hướng dẫn chơi Texas Hold&apos;em</h1>
        <p className="text-sm text-neutral-500">Từ luật cơ bản đến một ván hoàn chỉnh, có ví dụ bằng bài thật.</p>
      </div>

      <nav className="flex flex-wrap gap-2 text-sm">
        {SECTIONS.map((s, i) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full border border-neutral-200 px-3 py-1 hover:border-emerald-600 dark:border-neutral-800"
          >
            {i + 1}. {s.title}
          </a>
        ))}
      </nav>

      <Section id="co-ban">
        <Card className="space-y-3 text-sm leading-relaxed">
          <p>
            Mỗi người nhận <b>2 lá bài riêng</b> (hole cards, úp, chỉ mình biết). Trên bàn lần lượt lật <b>5 lá chung</b>{" "}
            (community cards) mà ai cũng dùng được.
          </p>
          <p>
            Bài của bạn là <b>5 lá mạnh nhất</b> chọn từ 7 lá (2 riêng + 5 chung): dùng 2, 1 hay 0 lá riêng đều được.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2">
              <span className="text-neutral-500">Trong tay</span> <CardRow cards={["A♥", "K♥"]} />
            </span>
            <span className="flex items-center gap-2">
              <span className="text-neutral-500">Trên bàn</span> <CardRow cards={["Q♥", "J♥", "3♣", "10♥", "7♠"]} />
            </span>
          </div>
          <p>
            → Bộ mạnh nhất: <CardRow cards={["A♥", "K♥", "Q♥", "J♥", "10♥"]} /> = <b>Royal Flush</b>. Hai lá 3♣, 7♠ bị bỏ.
          </p>
          <p>
            Thắng ván bằng một trong hai cách: <b>mọi người khác bỏ bài</b>, hoặc tới cuối (<b>showdown</b>) lật bài và có
            bộ mạnh nhất. Người thắng ăn <b>pot</b> (tổng chip mọi người đã cược).
          </p>
        </Card>
      </Section>

      <Section id="vi-tri">
        <Card className="space-y-2 text-sm leading-relaxed">
          <p>
            <b>Dealer button (BTN)</b>: nút đánh dấu người &quot;chia bài&quot; trong ván, xoay theo chiều kim đồng hồ sau mỗi ván.
          </p>
          <p>
            <b>Small blind (SB)</b>: người ngay bên trái button, bắt buộc đặt nửa mức cược tối thiểu trước khi chia bài.
          </p>
          <p>
            <b>Big blind (BB)</b>: người tiếp theo, bắt buộc đặt đủ mức tối thiểu. Ví dụ blind 10/20: SB đặt 10, BB đặt 20.
          </p>
          <p>
            <b>Thứ tự nói:</b> preflop bắt đầu từ người ngay sau BB (gọi là UTG). Từ flop trở đi bắt đầu từ người còn trong
            ván gần bên trái button nhất. Button luôn nói cuối từ flop, nên đó là vị trí lợi nhất: được thấy mọi người làm gì
            trước khi quyết định.
          </p>
        </Card>
      </Section>

      <Section id="vong-cuoc">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Preflop", "Mỗi người có 2 lá riêng, chưa có bài chung.", ["?", "?"]],
            ["Flop", "Lật 3 lá chung cùng lúc.", ["K♣", "9♦", "4♣"]],
            ["Turn", "Lật lá chung thứ 4.", ["K♣", "9♦", "4♣", "2♥"]],
            ["River", "Lật lá chung cuối cùng. Sau vòng cược này là showdown.", ["K♣", "9♦", "4♣", "2♥", "A♣"]],
          ].map(([name, text, cards]) => (
            <Card key={name as string} className="space-y-2 text-sm">
              <h3 className="font-semibold">{name}</h3>
              <CardRow cards={cards as string[]} />
              <p className="text-neutral-600 dark:text-neutral-300">{text}</p>
            </Card>
          ))}
        </div>
        <Card className="p-0">
          <dl className="divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
            {ACTIONS.map(([term, meaning]) => (
              <div key={term} className="grid gap-1 px-4 py-3 sm:grid-cols-[8rem_1fr] sm:gap-4">
                <dt className="font-semibold">{term}</dt>
                <dd className="text-neutral-600 dark:text-neutral-300">{meaning}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <p className="text-sm text-neutral-500">
          Một vòng cược kết thúc khi mọi người còn trong ván đã đặt bằng nhau (hoặc đã all-in).
        </p>
      </Section>

      <Section id="thu-tu-bai">
        <Card className="p-0">
          <ol className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {HAND_RANKINGS.map((h, i) => (
              <li key={h.name} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[13rem_auto_1fr] sm:items-center sm:gap-4">
                <div>
                  <span className="text-neutral-500">{i + 1}.</span> <b>{h.name}</b>
                  <div className="text-neutral-500">{h.vi}</div>
                </div>
                <CardRow cards={h.cards} />
                <p className="text-neutral-600 dark:text-neutral-300">{h.note}</p>
              </li>
            ))}
          </ol>
        </Card>
        <p className="text-sm text-neutral-500">Chất không có lớn nhỏ: ♠ ♥ ♦ ♣ ngang nhau. Bằng hệt nhau thì chia pot.</p>
      </Section>

      <Section id="so-bai">
        <div className="grid gap-3 lg:grid-cols-2">
          {TIEBREAKS.map((t) => (
            <ShowdownCard key={t.title} {...t} />
          ))}
        </div>
      </Section>

      <Section id="the-thuc-cup">
        <Card className="space-y-2 text-sm leading-relaxed">
          <p>
            Một <b>cup</b> là một giải đấu nhỏ (tournament): mọi người đóng buy-in như nhau, nhận số chip ban đầu như nhau.
          </p>
          <p>
            Chơi tới khi <b>một người giữ hết chip</b>: người đó là <b>champion 👑</b>. Hết chip là bị loại (tuỳ nhóm có cho
            rebuy hay không).
          </p>
          <p>
            <b>Blind tăng dần</b> theo thời gian hoặc số ván (ví dụ 10/20 → 20/40 → 50/100…) để giải không kéo dài mãi.
          </p>
          <p>
            Tiền thưởng chia theo thứ hạng (vô địch, nhì, ba…). Trong app, lời/lỗ của mỗi người ở một cup được nhập thành
            buy-in và cash-out, tổng cả bàn luôn bằng 0.
          </p>
        </Card>
      </Section>

      <Section id="the-thuc-cash">
        <Card className="space-y-2 text-sm leading-relaxed">
          <p>
            Trong <b>cash game</b>, chip chính là tiền: mua bao nhiêu chip thì trả bấy nhiêu tiền. <b>Blind cố định</b> cả
            buổi (ví dụ 10/20), không tăng dần như cup.
          </p>
          <p>
            <b>Vào và rời bàn lúc nào cũng được.</b> Hết chip hoặc muốn thêm chip thì <b>mua thêm (rebuy / top-up)</b>, thường
            có mức tối thiểu và tối đa mỗi lần mua (ví dụ 20–100 big blind).
          </p>
          <p>
            Khi rời bàn, đổi số chip còn lại ra tiền (<b>cash-out</b>). Lời lỗ của buổi = cash-out − tổng tiền đã mua chip.
            Không có vô địch, nên cash game <b>không tính crown</b>.
          </p>
        </Card>
        <Card className="space-y-2 text-sm leading-relaxed">
          <h3 className="font-semibold">Ví dụ</h3>
          <p>
            An mua 200, thua hết, mua thêm 200, cuối buổi còn 550 chip → cash-out 550. Tổng đã mua là 400, nên An lời{" "}
            <b>+150</b>. Trong app nhập: <b>Buy-in 400</b>, <b>Cash-out 550</b>.
          </p>
          <p>Cả bàn cộng lại: tổng cash-out luôn bằng tổng buy-in, vì tiền chỉ chuyển từ người này sang người khác.</p>
        </Card>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-500">
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th className="px-4 py-2" />
                <th className="px-4 py-2">Cup (tournament)</th>
                <th className="px-4 py-2">Cash game</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Chip", "Chỉ là điểm, ai cũng nhận như nhau", "Là tiền thật"],
                ["Blind", "Tăng dần theo thời gian", "Cố định cả buổi"],
                ["Vào / rời bàn", "Vào từ đầu, chơi tới khi bị loại", "Lúc nào cũng được"],
                ["Mua thêm chip", "Tuỳ luật nhóm", "Được, trong mức cho phép"],
                ["Kết thúc", "Một người giữ hết chip", "Khi mọi người nghỉ"],
                ["Vô địch / crown", "Có 👑", "Không"],
              ].map(([k, cup, cash]) => (
                <tr key={k} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                  <td className="px-4 py-2 font-semibold">{k}</td>
                  <td className="px-4 py-2 text-neutral-600 dark:text-neutral-300">{cup}</td>
                  <td className="px-4 py-2 text-neutral-600 dark:text-neutral-300">{cash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>
    </div>
  );
}
