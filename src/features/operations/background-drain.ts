import { after } from "next/server";

export type BackgroundDrain = () => void | Promise<void>;
export type AfterResponseScheduler = (callback: BackgroundDrain) => void;

export const scheduleAfterResponse = (
  callback: BackgroundDrain,
  schedule: AfterResponseScheduler = after
): void => {
  schedule(callback);
};
