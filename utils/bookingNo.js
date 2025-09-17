import Counter from "../models/Counter.js";

function pad(n, w = 2) {
  return String(n).padStart(w, "0");
}

/**
 * bookingDateStr: "YYYY-MM-DD" (your Booking.date)
 * Returns { bookingNo: "RB202509170034", bookingNoShort: "RB0034", dayKey: "20250917", seq: 34 }
 */
export async function allocateBookingNo(session, bookingDateStr, prefix = "RB") {
  // Validate and normalize "YYYY-MM-DD"
  let dayKey;
  if (typeof bookingDateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(bookingDateStr)) {
    dayKey = bookingDateStr.replaceAll("-", ""); // "20250917"
  } else {
    // Fallback to today's date if missing/invalid
    const now = new Date();
    const y = now.getFullYear();
    const m = pad(now.getMonth() + 1);
    const d = pad(now.getDate());
    dayKey = `${y}${m}${d}`;
  }

  const counterId = `bookingNo:${dayKey}`;

  // Atomically increment the per-day counter
  const doc = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session }
  );

  const seq = doc.seq; // 1,2,3...
  const seqStr = String(seq).padStart(4, "0"); // 0001..9999
  const bookingNo = `${prefix}${dayKey}${seqStr}`; // "RB202509170034"
  const bookingNoShort = `${prefix}${seqStr}`;     // "RB0034" (optional display)

  return { bookingNo, bookingNoShort, dayKey, seq };
}
