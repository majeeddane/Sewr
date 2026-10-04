"use client";

import * as React from "react";
import { SOCIAL_ICONS, SOCIAL_KEYS, type SocialKey } from "@/components/site/social-icons";
import { Input } from "@/components/ui/form";

/**
 * One URL field per platform, written into `socialsJson`.
 *
 * The keys are exactly `SOCIAL_KEYS` from the footer icon map, so whatever the
 * owner fills in here is what the public footer renders — leave a field blank
 * to hide that platform.
 */
export function SocialLinksEditor({
  initial,
  disabled,
}: {
  initial: Record<string, string>;
  disabled?: boolean;
}) {
  const [values, setValues] = React.useState<Record<string, string>>(initial);

  const filled = SOCIAL_KEYS.filter((key) => (values[key] ?? "").trim().length > 0).length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[0.8125rem] leading-relaxed text-ink-500">
        المنصات التي تتركها فارغة لا تظهر في تذييل الموقع. الروابط الحالية:{" "}
        <strong className="text-brand-700 dark:text-brand-300">{filled}</strong> من{" "}
        {SOCIAL_KEYS.length}.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {SOCIAL_KEYS.map((key: SocialKey) => {
          const { label, Icon } = SOCIAL_ICONS[key];
          const id = `social-${key}`;
          return (
            <div key={key} className="flex flex-col gap-1.5">
              <label
                htmlFor={id}
                className="flex items-center gap-2 text-sm font-bold text-ink-800 dark:text-ink-200"
              >
                <span className="grid size-6 place-items-center rounded-md bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                  <Icon className="size-3.5" />
                </span>
                {label}
              </label>
              <Input
                id={id}
                name={`social_${key}`}
                type="url"
                dir="ltr"
                value={values[key] ?? ""}
                disabled={disabled}
                placeholder={`https://…`}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [key]: event.target.value }))
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}