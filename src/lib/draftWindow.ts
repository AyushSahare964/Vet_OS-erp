/**
 * Drafts stay editable until the end of the calendar month (clinic time, IST) they were created in.
 * Year is part of the comparison, so a draft never becomes editable again in the same month next year.
 */
const IST = 330 * 6e4;

/** First instant of the month after `t`'s month, in ms. */
const nextMonthStart = (t: number) => {
  const d = new Date(t + IST);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - IST;
};

/** Last millisecond a draft created at `createdAt` can be edited. */
export const draftEditableUntil = (createdAt: string | number | Date) =>
  nextMonthStart(new Date(createdAt).getTime()) - 1;

/** Start of the current month: drafts created before this are past their window. */
export const currentMonthStart = (now = Date.now()) => {
  const d = new Date(now + IST);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - IST;
};
