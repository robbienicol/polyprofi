import { downsideAtStake } from "@/lib/route-expected-value";
import type { Route } from "@/types/routes";

/** The bad outcome, as money, with a few words on when it happens. */
export function worstCase(route: Route, stake: number, debt: boolean): { value: string; note: string } {
  if (route.noCapitalRequired) return { value: "$0", note: "no money in" };
  if (route.lossProfile === "binary") return { value: `−$${Math.round(stake).toLocaleString()}`, note: "if it loses" };
  if (debt) return route.maturesInDays
    ? { value: "$0", note: "held to the end" }
    : { value: "$0", note: "rate can drop" };
  return { value: `−$${Math.round(downsideAtStake(route, stake)).toLocaleString()}`, note: "in a bad stretch" };
}

/** One sentence on what can go wrong, for someone who has never bought any of this. */
export function riskInPlainWords(route: Route, stake: number, debt: boolean): string {
  if (route.noCapitalRequired) return "Nothing to lose: this uses no money, only a change in what you already do.";
  if (route.lossProfile === "binary") {
    return `All or nothing. If it goes the other way, the $${Math.round(stake).toLocaleString()} is gone.`;
  }
  if (debt) {
    return route.maturesInDays
      ? "About as safe as it gets. Hold it to the end and you get it all back, plus the interest."
      : "Your money stays put and earns interest. The rate can move, but the money doesn't shrink.";
  }
  return "The value moves with the market. A bad stretch means it's worth less for a while, not that it's gone.";
}
