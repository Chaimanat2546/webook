"use client";

import * as React from "react";

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"));

const selectClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30";

function splitTime(value: string | null | undefined): { hour: string; minute: string } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value ?? "");

  return { hour: match?.[1] ?? "", minute: match?.[2] ?? "" };
}

export function HouseTimeSelect({
  defaultValue,
  id,
  label,
  name,
}: {
  defaultValue: string;
  id: string;
  label: string;
  name: string;
}) {
  const initial = splitTime(defaultValue);
  const [hour, setHour] = React.useState(initial.hour);
  const [minute, setMinute] = React.useState(initial.minute);
  const timeValue = hour && minute ? `${hour}:${minute}` : "";

  return (
    <div className="grid w-fit grid-cols-[4.5rem_auto_4.5rem] items-center gap-2">
      <input name={name} type="hidden" value={timeValue} />
      <select
        aria-label={`${label} hour`}
        className={selectClassName}
        id={`${id}_hour`}
        onChange={(event) => setHour(event.currentTarget.value)}
        value={hour}
      >
        <option value="">HH</option>
        {HOURS.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <span aria-hidden className="text-sm text-muted-foreground">
        :
      </span>
      <select
        aria-label={`${label} minute`}
        className={selectClassName}
        id={`${id}_minute`}
        onChange={(event) => setMinute(event.currentTarget.value)}
        value={minute}
      >
        <option value="">MM</option>
        {MINUTES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </div>
  );
}
