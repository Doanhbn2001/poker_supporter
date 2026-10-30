/** Content for the /guide page: Texas Hold'em basics with worked examples. Cards are written rank + suit. */

export type HandRank = { name: string; vi: string; cards: string[]; note: string };

/** Strongest first. */
export const HAND_RANKINGS: HandRank[] = [
  { name: "Royal Flush", vi: "Thùng phá sảnh A", cards: ["A♠", "K♠", "Q♠", "J♠", "10♠"], note: "Sảnh từ 10 đến A, cùng chất. Mạnh nhất, cực hiếm." },
  { name: "Straight Flush", vi: "Thùng phá sảnh", cards: ["9♥", "8♥", "7♥", "6♥", "5♥"], note: "5 lá liên tiếp cùng chất. Lá cao hơn thắng." },
  { name: "Four of a Kind", vi: "Tứ quý", cards: ["Q♣", "Q♦", "Q♥", "Q♠", "7♠"], note: "4 lá cùng số. Lá thứ 5 là kicker." },
  { name: "Full House", vi: "Cù lũ", cards: ["J♠", "J♥", "J♦", "4♣", "4♠"], note: "Bộ ba + một đôi. So bộ ba trước, rồi mới tới đôi." },
  { name: "Flush", vi: "Thùng", cards: ["A♦", "J♦", "8♦", "6♦", "2♦"], note: "5 lá cùng chất, không cần liên tiếp. So lá cao nhất trở xuống." },
  { name: "Straight", vi: "Sảnh", cards: ["10♣", "9♦", "8♠", "7♥", "6♣"], note: "5 lá liên tiếp, khác chất. A dùng được ở cả đầu (10-J-Q-K-A) lẫn cuối (A-2-3-4-5)." },
  { name: "Three of a Kind", vi: "Bộ ba (sám)", cards: ["7♠", "7♥", "7♦", "K♣", "3♠"], note: "3 lá cùng số. Gọi là set nếu có đôi trong tay + 1 lá trên bàn, trips nếu 1 lá trong tay + đôi trên bàn." },
  { name: "Two Pair", vi: "Hai đôi (thú)", cards: ["K♥", "K♠", "5♦", "5♣", "9♠"], note: "So đôi cao trước, rồi đôi thấp, rồi kicker." },
  { name: "One Pair", vi: "Một đôi", cards: ["A♣", "A♦", "Q♠", "8♥", "4♣"], note: "So đôi trước, bằng nhau thì so lần lượt 3 kicker." },
  { name: "High Card", vi: "Mậu thầu", cards: ["A♠", "J♦", "9♣", "6♥", "3♠"], note: "Không có gì cả. So lá cao nhất trở xuống." },
];

export type Showdown = {
  title: string;
  board: string[];
  players: { name: string; hole: string[]; best: string }[];
  result: string;
};

/** Ties and close calls: how equal-looking hands are decided. */
export const TIEBREAKS: Showdown[] = [
  {
    title: "Cùng đôi, kicker quyết định",
    board: ["K♥", "8♣", "5♦", "3♠", "2♥"],
    players: [
      { name: "A", hole: ["A♠", "K♦"], best: "Đôi K, kicker A" },
      { name: "B", hole: ["K♣", "Q♠"], best: "Đôi K, kicker Q" },
    ],
    result: "A thắng: cả hai cùng đôi K, so lá kế tiếp thì A > Q.",
  },
  {
    title: "Thùng gặp thùng",
    board: ["2♥", "7♥", "9♥", "J♥", "K♦"],
    players: [
      { name: "A", hole: ["A♥", "3♠"], best: "Thùng A-J-9-7-2 (bàn có 4 lá cơ, chỉ cần 1 lá cơ trong tay)" },
      { name: "B", hole: ["Q♥", "10♥"], best: "Thùng Q-J-10-9-7" },
    ],
    result: "A thắng: so lá cao nhất của thùng, A > Q. Có 2 lá cùng chất trong tay không có nghĩa là thùng to hơn.",
  },
  {
    title: "Bài trên bàn là bài mạnh nhất → chia pot",
    board: ["A♠", "K♠", "Q♦", "J♣", "10♥"],
    players: [
      { name: "A", hole: ["2♣", "3♦"], best: "Sảnh A-K-Q-J-10 (dùng nguyên bàn)" },
      { name: "B", hole: ["4♥", "5♥"], best: "Sảnh A-K-Q-J-10 (dùng nguyên bàn)" },
    ],
    result: "Hoà, chia đôi pot. Không ai có lá nào làm bộ 5 lá tốt hơn bàn.",
  },
  {
    title: "Sảnh A-2-3-4-5 là sảnh nhỏ nhất",
    board: ["2♦", "3♣", "4♠", "5♥", "K♣"],
    players: [
      { name: "A", hole: ["A♣", "9♦"], best: "Sảnh A-2-3-4-5 (A đứng cuối, tính là 1)" },
      { name: "B", hole: ["6♠", "7♦"], best: "Sảnh 3-4-5-6-7" },
    ],
    result: "B thắng: sảnh 7 lớn hơn sảnh 5. Trong sảnh A-2-3-4-5, lá A chỉ có giá trị 1.",
  },
];
