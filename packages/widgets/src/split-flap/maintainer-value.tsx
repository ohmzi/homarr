"use client";

// Answers one maintainer row: the greeting needs only the client, the status and the fun
// row read the maintainer service through one shared query, so they cost a single request.
// Like the widget-backed adapters it renders nothing and reports its text up.

import { useEffect, useMemo } from "react";

import { clientApi } from "@homarr/api/client";
import { useSession } from "@homarr/auth/client";

import { useWidgetNow } from "../common/use-widget-now";
import { funText, greetingText, healthText, pickQuote } from "./maintainer";

export interface SplitFlapMaintainerProps {
  metric: string;
  url: string;
  /** Overrides the signed-in user's name when set, so the board can greet a fixed name. */
  name: string;
  onValue: (text: string) => void;
}

export const SplitFlapMaintainer = ({ metric, url, name, onValue }: SplitFlapMaintainerProps) => {
  const now = useWidgetNow("minute");
  const session = useSession();
  const needsService = metric === "health" || metric === "fun";
  const { data, isPending } = clientApi.widget.splitFlap.getPipeline.useQuery({ url }, { enabled: needsService });
  // Drawn once per mount, so the fun line changes when the board is opened and not on
  // every poll, which would spin the flaps for no reason.
  const quote = useMemo(() => pickQuote(), []);

  let text: string | null = null;
  if (metric === "greeting") {
    text = greetingText(now, name.trim() === "" ? (session.data?.user?.name ?? null) : name);
  } else if (metric === "health") {
    // Blank while the first answer is in flight; NO DATA once it has failed or omitted a level.
    text = isPending ? null : healthText(data?.level ?? null);
  } else if (metric === "fun") {
    text = isPending ? null : funText(data?.level ?? null, data?.unhealthy ?? [], data?.reasons ?? [], quote);
  }

  useEffect(() => {
    onValue(text ?? "");
  }, [onValue, text]);

  return null;
};
