import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Deletes session content past each person's or workspace's retention limit.
// Does nothing for anyone who hasn't set a limit (the default).
crons.daily("purge expired session content", { hourUTC: 3, minuteUTC: 15 }, internal.privacy.purgeExpired, {});

export default crons;
