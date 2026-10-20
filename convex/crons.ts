import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Deletes session content past each person's or workspace's retention limit.
// Does nothing for anyone who hasn't set a limit (the default).
crons.daily("purge expired session content", { hourUTC: 3, minuteUTC: 15 }, internal.privacy.purgeExpired, {});

// Daily: places the check-in calls that are due. Does nothing unless
// DAILY_CALLS_ENABLED is "1" on the deployment (see convex/dailyCalls.ts).
crons.interval("place due Daily calls", { minutes: 5 }, internal.dailyCalls.tick, {});

export default crons;
