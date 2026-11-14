// Tells the booking page which nights are taken (Airbnb calendars plus stays
// already paid on this site) and which payment methods are switched on.
import { takenAll, payments, json } from "../lib/shared.mjs";

export default async () => {
  const { spaces, synced } = await takenAll();
  return json(
    { updated: new Date().toISOString(), spaces, synced, payments: payments() },
    200,
    { "cache-control": "public, max-age=300" }
  );
};

export const config = { path: "/api/availability" };
