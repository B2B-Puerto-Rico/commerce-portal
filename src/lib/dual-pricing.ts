/**
 * Dual Pricing Helper — Single source of truth for cash/card price calculations.
 *
 * All amounts are INTEGER CENTS. Never use floats for money.
 *
 * Business rule: menu prices are CASH prices (the base).
 * Card customers pay a surcharge percentage on top.
 *
 * Example: $100 cash @ 3.99% surcharge = $103.99 card = 10399 cents
 */

/** Calculate the card price given a cash price (cents) and surcharge percentage. */
export function calculateCardPriceCents(cashPriceCents: number, surchargePct: number): number {
  return Math.round(cashPriceCents * (1 + surchargePct / 100));
}

/** Calculate the surcharge amount in cents. */
export function calculateSurchargeCents(cashPriceCents: number, surchargePct: number): number {
  return calculateCardPriceCents(cashPriceCents, surchargePct) - cashPriceCents;
}

/** Calculate line item prices for both cash and card. */
export function calculateLineItemPrices(
  cashPriceCents: number,
  qty: number,
  surchargePct: number,
) {
  const cashSubtotal = cashPriceCents * qty;
  const cardSubtotal = calculateCardPriceCents(cashSubtotal, surchargePct);
  return { cashSubtotal, cardSubtotal };
}

/** Configuration for dual pricing from the merchant settings. */
export interface DualPriceConfig {
  enabled: boolean;
  surchargePct: number;
  allowCashOnFulfillment: boolean;
  label: string;
}

/** Get full breakdown of cash vs card totals. */
export function getDualPriceBreakdown(cashTotalCents: number, config: DualPriceConfig) {
  if (!config.enabled) {
    return {
      cashTotal: cashTotalCents,
      cardTotal: cashTotalCents,
      surchargeCents: 0,
      isDualPricing: false,
    };
  }
  const cardTotal = calculateCardPriceCents(cashTotalCents, config.surchargePct);
  return {
    cashTotal: cashTotalCents,
    cardTotal,
    surchargeCents: cardTotal - cashTotalCents,
    isDualPricing: true,
  };
}

/** Format a dual pricing label for display. */
export function formatDualPriceNote(
  cashPriceCents: number,
  config: DualPriceConfig,
): string | null {
  if (!config.enabled) return null;
  const cardCents = calculateCardPriceCents(cashPriceCents, config.surchargePct);
  const cashStr = `$${(cashPriceCents / 100).toFixed(2)}`;
  const cardStr = `$${(cardCents / 100).toFixed(2)}`;
  return `${cashStr} cash · ${cardStr} with card (${config.surchargePct}% ${config.label})`;
}
