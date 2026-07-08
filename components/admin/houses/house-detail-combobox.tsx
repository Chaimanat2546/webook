"use client";

import * as React from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "../../ui/combobox";

export interface HouseDetailComboboxOption {
  label: string;
  value: string;
}

export function HouseDetailCombobox({
  defaultValue,
  emptyText,
  id,
  name,
  options,
  placeholder,
}: {
  defaultValue: string;
  emptyText: string;
  id: string;
  name: string;
  options: HouseDetailComboboxOption[];
  placeholder: string;
}) {
  const fallbackOption = options[0] ?? { label: "", value: "" };
  const [selectedOption, setSelectedOption] = React.useState<HouseDetailComboboxOption | null>(
    options.find((option) => option.value === defaultValue) ?? fallbackOption,
  );

  return (
    <>
      <input name={name} type="hidden" value={selectedOption?.value ?? ""} />
      <Combobox
        itemToStringValue={(option) => option.label}
        items={options}
        onValueChange={setSelectedOption}
        value={selectedOption}
      >
        <ComboboxInput id={id} placeholder={placeholder} />
        <ComboboxContent>
          <ComboboxEmpty>{emptyText}</ComboboxEmpty>
          <ComboboxList>
            {(option) => (
              <ComboboxItem key={option.value} value={option}>
                {option.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </>
  );
}
