import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import postcss from "postcss";

const require = createRequire(import.meta.url);

test("legacy native selects keep disabled surfaces and customer wrappers do not override child backgrounds", () => {
  const customer = readFileSync(new URL("../components/admin/houses/bookings/booking-customer-form.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(customer, /\[&_.*?\]:bg-field-background/);
  for (const path of ["houses/bookings/booking-customer-form.tsx", "houses/bookings/booking-editor.tsx", "quotations/payment-method-list.tsx"]) {
    const source = readFileSync(new URL(`../components/admin/${path}`, import.meta.url), "utf8");
    const selects = source.match(/<select className="[^"]+"/g) ?? [];
    assert.ok(selects.length > 0);
    for (const select of selects) {
      assert.match(select, /border-field-border/);
      assert.match(select, /bg-field-background/);
      assert.match(select, /disabled:bg-muted/);
    }
  }
});

async function controls() {
  const bundle = await build({ stdin: { contents: `
    import React from 'react';
    import { Input } from './components/ui/input';
    import { Textarea } from './components/ui/textarea';
    import { InputGroup, InputGroupInput } from './components/ui/input-group';
    import { Select, SelectTrigger, SelectValue } from './components/ui/select';
    import { Combobox, ComboboxInput } from './components/ui/combobox';
    import { ThaiMonthPicker } from './components/ui/thai-month-picker';
    import { ThaiDateRangePicker } from './components/ui/thai-date-range-picker';
    export function Controls() { return <>
      <Input aria-label="ข้อความ" /><Input type="number" aria-label="ตัวเลข" />
      <Input type="search" aria-label="ค้นหา" /><Input type="date" aria-label="วันที่" />
      <Input disabled aria-label="ปิดใช้งาน" /><Input aria-invalid aria-label="มีข้อผิดพลาด" />
      <Textarea aria-label="หมายเหตุ" />
      <InputGroup><InputGroupInput aria-label="ค้นหาแบบกลุ่ม" /></InputGroup>
      <Select><SelectTrigger aria-label="เลือกสถานะ"><SelectValue placeholder="เลือก" /></SelectTrigger></Select>
      <Combobox items={['บ้าน A']}><ComboboxInput aria-label="ค้นหาตัวเลือก" /></Combobox>
      <ThaiMonthPicker month="2026-10" onMonthChange={() => {}} />
      <ThaiDateRangePicker value={undefined} onChange={() => {}} />
    </>; }
  `, loader: "tsx", resolveDir: process.cwd() }, bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(require, loaded, loaded.exports);
  return renderToStaticMarkup(createElement(loaded.exports.Controls as ComponentType));
}

test("standalone controls and grouped shells have their own surface, while grouped inputs remain transparent", async () => {
  const html = await controls();
  for (const slot of ["input", "textarea", "select-trigger", "input-group"]) {
    const tags = html.match(new RegExp(`<[^>]+data-slot="${slot}"[^>]*>`, "g")) ?? [];
    assert.ok(tags.length > 0, slot);
    for (const tag of tags) {
      assert.match(tag, /bg-field-background/, slot);
      assert.match(tag, /border-field-border/, slot);
    }
  }
  for (const tag of html.match(/<input[^>]+data-slot="input-group-control"[^>]*>/g) ?? []) {
    assert.match(tag, /bg-transparent/);
    assert.doesNotMatch(tag, /bg-field-background/);
  }
  const month = html.match(/<button[^>]+data-thai-month-picker[^>]*>/)?.[0];
  const date = html.match(/<button[^>]+aria-label="ช่วงวันที่เข้าพัก"[^>]*>/)?.[0];
  assert.ok(month && date);
  for (const tag of [month, date]) {
    assert.match(tag, /bg-field-background/);
    assert.match(tag, /border-field-border/);
  }
  assert.ok(html.includes('disabled=""'));
  assert.ok(html.includes('aria-invalid="true"'));
  assert.ok(html.includes("disabled:bg-muted"));
  assert.ok(html.includes("aria-invalid:border-destructive"));
});

function luminance(hex: string) {
  const channels = hex.replace("#", "").match(/../g)!.map(value => {
    const channel = parseInt(value, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(first: string, second: string) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("dark primary text stays readable on canvas, cards and selected surfaces", () => {
  const stylesheet = postcss.parse(readFileSync(new URL("../app/globals.css", import.meta.url), "utf8"));
  const tokens = new Map<string,string>();
  stylesheet.walkRules(".dark", rule => { rule.walkDecls(declaration => { tokens.set(declaration.prop,declaration.value); }); });
  const foreground = tokens.get("--primary-text") ?? tokens.get("--primary")!;
  for (const role of ["--background","--card","--muted"]) assert.ok(contrast(foreground,tokens.get(role)!) >= 4.5, `primary text contrast on ${role}`);
});

test("light fields use the approved soft border while dark borders retain contrast", () => {
  const stylesheet = postcss.parse(readFileSync(new URL("../app/globals.css", import.meta.url), "utf8"));
  for (const selector of [":root", ".dark"]) {
    const tokens = new Map<string, string>();
    stylesheet.walkRules(selector, rule => { rule.walkDecls(declaration => { tokens.set(declaration.prop, declaration.value); }); });
    const field = tokens.get("--field-background");
    const border = tokens.get("--field-border");
    assert.ok(field && border, selector);
    if (selector === ":root") {
      assert.equal(border, "#DDE2EC");
      assert.equal(field, "#FFFFFF");
      assert.equal(tokens.get("--border"), "#DDE2EC");
      assert.equal(tokens.get("--ring"), "#5B8CFF");
    }
    for (const background of [field, tokens.get("--background")!, tokens.get("--card")!]) {
      if (selector === ".dark") {
        assert.ok(contrast(border, background) >= 3, "dark field border should remain visible");
      }
    }
    if (selector === ".dark") assert.notEqual(border, tokens.get("--border"));
  }
});
