"use client";

import { BoardColorInput } from "@homarr/ui";

import type { CommonWidgetInputProps } from "./common";
import { useWidgetInputTranslation } from "./common";
import { useFormContext } from "./form";

export const WidgetColorInput = ({ property, kind, options }: CommonWidgetInputProps<"color">) => {
  const t = useWidgetInputTranslation(kind, property);
  const form = useFormContext();

  return (
    <BoardColorInput
      label={t("label")}
      description={options.withDescription ? t("description") : undefined}
      format="hex"
      {...form.getInputProps(`options.${property}`)}
    />
  );
};
