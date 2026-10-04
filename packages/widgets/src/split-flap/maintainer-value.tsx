"use client";

// Answers one maintainer row: the greeting needs only the client, the health and heaviest
// rows read the maintainer service through one shared query, so both rows cost a single
// request. Like the widget-backed adapters it renders nothing and reports its text up.

import { useEffect } from "react";

import { clientApi } from "@homarr/api/client";
import { useSession } from "@homarr/auth/client";

import { useWidgetNow } from "../common/use-widget-now";
import { splitFlapMaxColumns } from "./lines";
import { greetingText, healthText, heaviestText } from "./maintainer";

export interface SplitFlapMaintainerProps {
  metric: string;
  url: string;
  onValue: (text: string) => void;
}

export const SplitFlapMaintainer = ({ metric, url, onValue }: SplitFlapMaintainerProps) => {
  const now = useWidgetNow("minute");
  const session = useSession();
  const needsService = metric === "health" || metric === "heaviest";
  const { data, isPending } = clientApi.widget.splitFlap.getMaintainer.useQuery({ url }, { enabled: needsService });

  let text: string | null = null;
  if (metric === "greeting") {
    text = greetingText(now, session.data?.user?.name ?? null);
  } else if (metric === "health") {
    // Blank while the first answer is in flight; NO DATA once it has failed or omitted a level.
    text = isPending ? null : healthText(data?.level ?? null);
  } else if (metric === "heaviest") {
    text = isPending ? null : heaviestText(data?.topName ?? null, data?.topSize ?? null, splitFlapMaxColumns);
  }

  useEffect(() => {
    onValue(text ?? "");
  }, [onValue, text]);

  return null;
};
