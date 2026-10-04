"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AccordionItemData {
  question: string;
  answer: string;
}

/**
 * Accessible accordion used for FAQs.
 * Follows the WAI-ARIA disclosure pattern: button controls region, arrow keys
 * move between headers, Home/End jump to the first/last.
 */
export function Accordion({
  items,
  defaultOpen = 0,
  className,
  allowMultiple = false,
}: {
  items: AccordionItemData[];
  defaultOpen?: number | null;
  className?: string;
  allowMultiple?: boolean;
}) {
  const [open, setOpen] = React.useState<number[]>(() =>
    defaultOpen === null ? [] : [defaultOpen],
  );
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const toggle = (index: number) => {
    setOpen((current) => {
      if (current.includes(index)) return current.filter((i) => i !== index);
      if (allowMultiple) return [...current, index];
      return [index];
    });
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = items.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next !== null) {
      event.preventDefault();
      refs.current[next]?.focus();
    }
  };

  if (!items.length) return null;

  return (
    <div className={cn("divide-y divide-sand-200 overflow-hidden rounded-2xl border border-sand-200 bg-white", className)}>
      {items.map((item, index) => {
        const isOpen = open.includes(index);
        return (
          <div key={index}>
            <h3>
              <button
                ref={(el) => {
                  refs.current[index] = el;
                }}
                type="button"
                id={`faq-btn-${index}`}
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${index}`}
                onClick={() => toggle(index)}
                onKeyDown={(e) => onKeyDown(e, index)}
                className="flex w-full items-center justify-between gap-4 px-5 py-5 text-start transition-colors hover:bg-sand-50 sm:px-7"
              >
                <span
                  className={cn(
                    "text-base font-bold leading-relaxed transition-colors sm:text-[1.0625rem]",
                    isOpen ? "text-brand-800" : "text-ink-800",
                  )}
                >
                  {item.question}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full transition-all duration-300",
                    isOpen
                      ? "rotate-180 bg-brand-800 text-white"
                      : "bg-sand-100 text-brand-700",
                  )}
                >
                  <ChevronDown className="size-4" />
                </span>
              </button>
            </h3>
            <div
              id={`faq-panel-${index}`}
              role="region"
              aria-labelledby={`faq-btn-${index}`}
              hidden={!isOpen}
              className="grid transition-all"
            >
              <div className="px-5 pb-6 sm:px-7">
                <p className="whitespace-pre-line text-[0.9375rem] leading-[2] text-ink-600">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
