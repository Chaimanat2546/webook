"use client";

import {
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  Download,
  GripVertical,
  Printer,
  Share2,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  deleteQuotationAction,
  saveQuotationAction,
  saveQuotationDocumentDisplayDefaultsAction,
} from "../../../app/admin/quotations/actions";
import {
  applyQuotationDocumentDisplay,
  type QuotationDocumentDisplay,
} from "../../../lib/quotation-document-display";
import {
  calculateQuotation,
  formatThaiBahtText,
  type QuotationItemInput,
} from "../../../lib/quotation-calculator";
import { addQuotationCalendarDays } from "../../../lib/quotation-dates";
import {
  emptyPaymentMethod,
  normalizePaymentPositions,
  paymentMethodListState,
  type BankOption,
} from "../../../lib/quotation-payment-methods";
import {
  formatBaht,
  formatMoney,
  normalizeMoneyInput,
} from "../../../lib/quotation-money";
import {
  buildQuotationPublicUrl,
  createQuotationPublicQrDataUrl,
} from "../../../lib/quotation-public-qr";
import { waitForQuotationPrintImages } from "../../../lib/quotation-print";
import type {
  CustomerSnapshot,
  OfficeType,
  QuotationPayload,
  SellerSnapshot,
} from "../../../lib/quotation-types";
import type { QuotationTemplate } from "../../../lib/quotation-template";
import { normalizeQuotationVatChoices } from "../../../lib/quotation-vat";
import { cn } from "../../../lib/utils";
import { Alert, AlertDescription } from "../../ui/alert";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import { RadioGroup, RadioGroupItem } from "../../ui/radio-group";
import { Textarea } from "../../ui/textarea";
import { CertificationFields } from "./certification-fields";
import { QuotationCustomerPicker } from "./customers/customer-picker-dialog";
import { QuotationDocument } from "./quotation-document";
import { QuotationDocumentDisplayDialog } from "./quotation-document-display-dialog";
import { PaymentMethodList } from "./payment-method-list";

export interface QuotationEditorProps {
  banks: BankOption[];
  documentNumber: string | null;
  initialPayload: QuotationPayload;
  initialTemplateDefault: QuotationTemplate;
  itemNames: string[];
  printOnLoad?: boolean;
  publicOrigin: string | null;
  publicToken: string | null;
}
type PendingConfirmation = "close" | null;
type FieldProps = {
  children: React.ReactNode;
  error?: string;
  field: string;
  label: string;
};
type ItemProps = {
  calculation?: ReturnType<typeof calculateQuotation>;
  errors: Record<string, string>;
  index: number;
  item: QuotationItemInput;
  itemNames: string[];
  onRemove: () => void;
  onUpdate: <K extends keyof QuotationItemInput>(
    key: K,
    value: QuotationItemInput[K],
  ) => void;
  showDiscount: boolean;
  showTax: boolean;
  showUnit: boolean;
  totalItems: number;
};
type FieldSize =
  | "fluid"
  | "compact"
  | "date"
  | "identifier"
  | "money"
  | "name"
  | "address";

const fieldSizeClassNames = {
  fluid: "w-full",
  compact: "w-full sm:max-w-28",
  date: "w-full sm:max-w-40",
  identifier: "w-full sm:max-w-56",
  money: "w-full sm:max-w-32",
  name: "w-full sm:max-w-96",
  address: "w-full sm:max-w-[36rem]",
} satisfies Record<FieldSize, string>;

const selectClassName =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

function controlClassName(size: FieldSize, className?: string) {
  return cn(fieldSizeClassNames[size], className);
}

function fieldErrorId(field: string) {
  return `quotation-field-error-${field.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function focusField(field: string) {
  const fields = document.querySelectorAll<HTMLElement>(
    `[data-field="${CSS.escape(field)}"]`,
  );
  const target =
    Array.from(fields).find((element) => element.offsetParent !== null) ??
    fields[0];
  target?.scrollIntoView({ block: "center" });
  target?.focus({ preventScroll: true });
}

function FieldError({ error, field }: { error?: string; field: string }) {
  return error ? (
    <span className="text-xs text-destructive" id={fieldErrorId(field)}>
      {error}
    </span>
  ) : null;
}

function Field({ children, error, field, label }: FieldProps) {
  return (
    <label className="grid gap-1 text-sm">
      <span>{label}</span>
      {children}
      <FieldError error={error} field={field} />
    </label>
  );
}
function TextInput({
  disabled,
  digitsOnly,
  error,
  field,
  inputClassName,
  inputMode,
  label,
  onBlur,
  onChange,
  onFocus,
  size = "fluid",
  value,
}: {
  disabled?: boolean;
  digitsOnly?: boolean;
  error?: string;
  field: string;
  inputClassName?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  label?: string;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onChange: (value: string) => void;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  size?: FieldSize;
  value: string;
}) {
  const input = (
    <>
      <Input
        aria-describedby={error ? fieldErrorId(field) : undefined}
        aria-invalid={Boolean(error)}
        aria-label={label ?? field}
        className={controlClassName(size, inputClassName)}
        data-field={field}
        disabled={disabled}
        inputMode={digitsOnly ? "numeric" : inputMode}
        maxLength={digitsOnly ? 13 : undefined}
        onBlur={onBlur}
        onChange={(event) => onChange(
          digitsOnly
            ? event.target.value.replace(/\D/g, "").slice(0, 13)
            : event.target.value,
        )}
        onFocus={onFocus}
        value={value}
      />
      <FieldError error={error} field={field} />
    </>
  );
  return label ? (
    <Field error={undefined} field={field} label={label}>
      {input}
    </Field>
  ) : (
    input
  );
}

function OfficeTypeControls({
  error,
  field,
  label,
  onChange,
  value,
}: {
  error?: string;
  field: string;
  label: string;
  onChange: (value: OfficeType) => void;
  value: OfficeType;
}) {
  const options = [
    ["unspecified", "ไม่ระบุ"],
    ["head_office", "สำนักงานใหญ่"],
    ["branch", "สาขา"],
  ] as const;
  return (
    <fieldset className="grid gap-1 text-sm">
      <legend>{label}</legend>
      <RadioGroup
        aria-describedby={error ? fieldErrorId(field) : undefined}
        aria-invalid={Boolean(error)}
        className="flex min-h-8 flex-wrap items-center gap-x-4 gap-y-2"
        name={field}
        onValueChange={(option) => onChange(option as OfficeType)}
        value={value}
      >
        {options.map(([option, optionLabel]) => (
          <label
            className="flex items-center gap-2"
            htmlFor={`${field}-${option}`}
            key={option}
          >
            <RadioGroupItem
              data-field={field}
              id={`${field}-${option}`}
              value={option}
            />
            <span>{optionLabel}</span>
          </label>
        ))}
      </RadioGroup>
      <FieldError error={error} field={field} />
    </fieldset>
  );
}
function Numeric({
  disabled,
  error,
  field,
  grouped = false,
  inputClassName,
  label,
  onChange,
  size = "fluid",
  value,
}: {
  disabled?: boolean;
  error?: string;
  field: string;
  grouped?: boolean;
  inputClassName?: string;
  label?: string;
  onChange: (value: string) => void;
  size?: FieldSize;
  value: string;
}) {
  const [displayValue, setDisplayValue] = useState(
    grouped && value ? formatMoney(value) : value,
  );
  const [focused, setFocused] = useState(false);

  function handleChange(next: string) {
    if (!grouped) return onChange(next);
    setDisplayValue(next);
    const normalized = normalizeMoneyInput(next);
    onChange(normalized === null ? next : normalized);
  }

  function handleBlur() {
    setFocused(false);
    if (!grouped) return;
    const normalized = normalizeMoneyInput(displayValue);
    if (normalized === null || normalized === "") return;
    onChange(normalized);
    setDisplayValue(formatMoney(normalized));
  }

  const input = (
    <Input
      aria-describedby={error ? fieldErrorId(field) : undefined}
      aria-invalid={Boolean(error)}
      aria-label={label ?? field}
      className={controlClassName(size, inputClassName)}
      data-field={field}
      disabled={disabled}
      inputMode="decimal"
      onBlur={handleBlur}
      onChange={(event) => handleChange(event.target.value)}
      onFocus={() => {
        setDisplayValue(grouped && value ? formatMoney(value) : value);
        setFocused(true);
      }}
      value={
        grouped
          ? focused
            ? displayValue
            : value
              ? formatMoney(value)
              : value
          : value
      }
    />
  );

  return label ? (
    <Field error={undefined} field={field} label={label}>
      {input}
      <FieldError error={error} field={field} />
    </Field>
  ) : (
    <>
      {input}
      <FieldError error={error} field={field} />
    </>
  );
}
function Totals({
  bold,
  label,
  value,
}: {
  bold?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-x-3 gap-y-1",
        bold && "border-t pt-2 font-semibold",
      )}
    >
      <span className="shrink-0">{label}</span>
      <output className="ml-auto max-w-full text-right tabular-nums [overflow-wrap:anywhere]">
        {value}
      </output>
    </div>
  );
}
function positions(items: QuotationItemInput[]) {
  return items.map((item, index) => ({ ...item, position: index + 1 }));
}
function itemGrid() {
  return "xl:grid-cols-[2.5rem_minmax(16rem,1fr)_5rem_5rem_7.5rem_9rem_9rem_8.5rem_2.5rem]";
}
function SortableQuotationItem(props: ItemProps) {
  const { index, item, onRemove } = props;
  const { handleRef, isDragging, ref } = useSortable({
    group: "quotation-items",
    id: item.id,
    index,
  });

  return (
    <article
      className={cn(
        "rounded-md border p-3 xl:grid xl:items-start xl:gap-2 xl:rounded-none xl:border-x-0 xl:border-t-0 xl:px-0 xl:py-2",
        itemGrid(),
        isDragging && "opacity-60",
      )}
      data-sortable-item
      ref={ref}
    >
      <header className="mb-3 flex items-center justify-between xl:contents">
        <div className="flex items-center gap-1 xl:col-start-1 xl:row-start-1">
          <Button
            aria-label={`ลากเพื่อจัดลำดับรายการ ${index + 1}`}
            ref={handleRef}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <GripVertical aria-hidden="true" />
          </Button>
          <span className="font-mono text-xs text-muted-foreground xl:sr-only">
            {index + 1}
          </span>
        </div>
        <Button
          aria-label={`ลบรายการ ${index + 1}`}
          className="xl:col-start-[-2]"
          disabled={props.totalItems === 1}
          onClick={onRemove}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </header>
      <div className="xl:col-start-2 xl:row-start-1">
        <ItemDetailsControls {...props} />
      </div>
      <div
        data-item-detail-grid
        className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:contents xl:[&_label>span:first-child]:sr-only"
      >
        <div className="xl:col-start-3 xl:row-start-1">
          <ItemQuantityControl {...props} labelled />
        </div>
        {props.showUnit ? <div className="xl:col-start-4 xl:row-start-1">
          <ItemUnitControl {...props} labelled />
        </div> : null}
        <div className="xl:col-start-5 xl:row-start-1">
          <ItemPriceControls {...props} labelled />
        </div>
        {props.showDiscount ? <div className="xl:col-start-6 xl:row-start-1">
          <ItemDiscountControls {...props} labelled />
        </div> : null}
        {props.showTax ? <div className="xl:col-start-7 xl:row-start-1">
          <ItemVatControls {...props} labelled />
        </div> : null}
      </div>
      <p className="mt-3 max-w-full border-t pt-2 text-right font-medium tabular-nums [overflow-wrap:anywhere] xl:col-start-[-3] xl:row-start-1 xl:mt-0 xl:border-0 xl:pt-2">
        <span className="xl:sr-only">มูลค่าก่อนภาษี </span>
        {props.calculation?.lines[index]?.preTaxAmount
          ? formatBaht(props.calculation.lines[index]!.preTaxAmount)
          : "—"}
      </p>
    </article>
  );
}

function ItemDetailsControls({ errors, index, item, itemNames, onUpdate }: ItemProps) {
  const error = (field: string) => errors[`items.${index}.${field}`];
  const legacyItemName = item.name && !itemNames.includes(item.name)
    ? item.name
    : null;
  return (
    <div data-item-details className="grid gap-1">
      <select
        aria-describedby={
          error("name") ? fieldErrorId(`items.${index}.name`) : undefined
        }
        aria-invalid={Boolean(error("name"))}
        aria-label="ชื่อรายการ"
        className={cn("w-full", selectClassName)}
        data-field={`items.${index}.name`}
        onChange={(event) => {
          const name = event.target.value;
          onUpdate("name", name);
          onUpdate("description", name);
        }}
        value={item.name}
      >
        <option value="">เลือกรายการ</option>
        {legacyItemName ? (
          <option disabled value={legacyItemName}>
            ค่าเดิม: {legacyItemName} — กรุณาเลือกใหม่
          </option>
        ) : null}
        {itemNames.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
      <FieldError error={error("name")} field={`items.${index}.name`} />
      <Textarea
        aria-describedby={
          error("description")
            ? fieldErrorId(`items.${index}.description`)
            : undefined
        }
        aria-invalid={Boolean(error("description"))}
        aria-label="รายละเอียด"
        data-field={`items.${index}.description`}
        onChange={(event) => onUpdate("description", event.target.value)}
        placeholder="รายละเอียด"
        value={item.description}
      />
      <FieldError
        error={error("description")}
        field={`items.${index}.description`}
      />
    </div>
  );
}

function ItemQuantityControl({
  errors,
  index,
  item,
  onUpdate,
  labelled,
}: Pick<ItemProps, "errors" | "index" | "item" | "onUpdate"> & {
  labelled?: boolean;
}) {
  return (
    <Numeric
      error={errors[`items.${index}.quantity`]}
      field={`items.${index}.quantity`}
      label={labelled ? "จำนวน" : undefined}
      onChange={(value) => onUpdate("quantity", value)}
      size="compact"
      value={item.quantity}
    />
  );
}
function ItemUnitControl({
  errors,
  index,
  item,
  onUpdate,
  labelled,
}: Pick<ItemProps, "errors" | "index" | "item" | "onUpdate"> & {
  labelled?: boolean;
}) {
  return (
    <TextInput
      error={errors[`items.${index}.unit`]}
      field={`items.${index}.unit`}
      label={labelled ? "หน่วย" : undefined}
      onChange={(value) => onUpdate("unit", value)}
      size="compact"
      value={item.unit}
    />
  );
}
function ItemPriceControls({
  errors,
  index,
  item,
  onUpdate,
  labelled,
}: Pick<ItemProps, "errors" | "index" | "item" | "onUpdate"> & {
  labelled?: boolean;
}) {
  return (
    <Numeric
      grouped
      error={errors[`items.${index}.unitPrice`]}
      field={`items.${index}.unitPrice`}
      label={labelled ? "ราคา" : undefined}
      onChange={(value) => onUpdate("unitPrice", value)}
      size="money"
      value={item.unitPrice}
    />
  );
}
function ItemDiscountControls({
  errors,
  index,
  item,
  onUpdate,
  labelled,
}: Pick<ItemProps, "errors" | "index" | "item" | "onUpdate"> & {
  labelled?: boolean;
}) {
  return (
    <Numeric
      grouped
      error={errors[`items.${index}.discountAmount`]}
      field={`items.${index}.discountAmount`}
      label={labelled ? "ส่วนลด" : undefined}
      onChange={(value) => onUpdate("discountAmount", value)}
      size="money"
      value={item.discountAmount}
    />
  );
}
function ItemVatControls({
  errors,
  index,
  item,
  onUpdate,
  labelled,
}: Pick<ItemProps, "errors" | "index" | "item" | "onUpdate"> & {
  labelled?: boolean;
}) {
  const error = (field: string) => errors[`items.${index}.${field}`];
  const vatError = error("vatTreatment") ?? error("vatRate");
  const field = `items.${index}.${error("vatRate") ? "vatRate" : "vatTreatment"}`;
  const select = (
    <select
      aria-describedby={vatError ? fieldErrorId(field) : undefined}
      aria-invalid={Boolean(vatError)}
      aria-label={`items.${index}.vatTreatment`}
      className={cn("w-full min-w-0", selectClassName)}
      data-field={field}
      onChange={(event) => {
        const choice = event.target.value;
        onUpdate("vatTreatment", choice === "none" ? "none" : "taxable");
        onUpdate("vatRate", choice === "7" ? "7" : "0");
      }}
      value={
        item.vatTreatment === "none"
          ? "none"
          : Number(item.vatRate) === 0
            ? "0"
            : "7"
      }
    >
      <option value="7">7%</option>
      <option value="0">0%</option>
      <option value="none">ไม่มี</option>
    </select>
  );
  const treatmentControl = labelled ? (
    <Field
      error={vatError}
      field={field}
      label="VAT"
    >
      {select}
    </Field>
  ) : (
    <>
      {select}
      <FieldError
        error={vatError}
        field={field}
      />
    </>
  );
  return <div className="grid gap-1">{treatmentControl}</div>;
}

export function QuotationEditor({
  banks,
  documentNumber: initialDocumentNumber,
  initialPayload,
  itemNames,
  printOnLoad = false,
  publicOrigin,
  publicToken: initialPublicToken,
}: QuotationEditorProps) {
  const router = useRouter();
  const [payload, setPayload] = useState<QuotationPayload>(() =>
    normalizeQuotationVatChoices(initialPayload),
  );
  const [documentNumber, setDocumentNumber] = useState(initialDocumentNumber);
  const [publicToken, setPublicToken] = useState(initialPublicToken);
  const [publicQrDataUrl, setPublicQrDataUrl] = useState("");
  const [publicQrSettledToken, setPublicQrSettledToken] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleteError, setDeleteError] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [activeCompletionTab, setActiveCompletionTab] = useState<
    "certification" | "payments"
  >("payments");
  const [completionExpanded, setCompletionExpanded] = useState(false);
  const [uploadingFields, setUploadingFields] = useState(new Set<string>());
  const [isPending, startTransition] = useTransition();
  const [logoUnavailable, setLogoUnavailable] = useState(false);
  const [sellerExpanded, setSellerExpanded] = useState(false);
  const [lastSavedPayload, setLastSavedPayload] =
    useState<QuotationPayload | null>(
      initialDocumentNumber ? initialPayload : null,
    );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const autoPrintStarted = useRef(false);
  const pendingFocusField = useRef<string | null>(null);
  useEffect(() => {
    const field = pendingFocusField.current;
    if (!field || isPending) return;
    pendingFocusField.current = null;
    focusField(field);
  }, [activeCompletionTab, completionExpanded, fieldErrors, isPending]);
  const canUseSavedDocument = Boolean(
      documentNumber &&
      lastSavedPayload &&
      publicOrigin &&
      publicToken &&
      !isDirty &&
      !isPending,
  );
  const shareUnavailableMessage = !publicOrigin
    ? "ยังไม่ได้ตั้งค่า URL สาธารณะสำหรับใบเสนอราคา"
    : "";
  const publicQrPending = Boolean(
    lastSavedPayload?.documentDisplay.certificationQr
    && publicOrigin
    && publicToken
    && publicQrSettledToken !== publicToken,
  );
  const savedPublicQrDataUrl =
    publicOrigin && publicToken && publicQrSettledToken === publicToken
      ? publicQrDataUrl
      : "";
  const draftPublicQrDataUrl = !isDirty ? savedPublicQrDataUrl : "";
  const canPrint = Boolean(
    documentNumber && lastSavedPayload && !isPending && !publicQrPending,
  );
  const calculationResult = useMemo(() => {
    try {
      return { calculation: calculateQuotation(payload), calculationError: "" };
    } catch (error) {
      return {
        calculation: null,
        calculationError:
          error instanceof Error ? error.message : "คำนวณยอดไม่ได้",
      };
    }
  }, [payload]);
  const { calculation, calculationError } = calculationResult;
  const savedCalculation = useMemo(
    () => (lastSavedPayload ? calculateQuotation(lastSavedPayload) : null),
    [lastSavedPayload],
  );
  const paymentListState = paymentMethodListState(payload.paymentMethods, fieldErrors);
  const money = (value?: string) => (value ? formatBaht(value) : "—");
  function changed(field: string) {
    setIsDirty(true);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }
  async function applyDocumentDisplay(
    value: QuotationDocumentDisplay,
    saveAsDefault: boolean,
  ): Promise<boolean> {
    if (saveAsDefault) {
      const result = await saveQuotationDocumentDisplayDefaultsAction(value);
      if (!result.ok) {
        toast.error(result.formError);
        return false;
      }
    }
    changed("documentDisplay");
    setPayload((current) => applyQuotationDocumentDisplay(current, value));
    if (saveAsDefault) toast.success("บันทึกค่าเริ่มต้นรูปแบบเอกสารแล้ว");
    return true;
  }
  function updateRoot<K extends keyof QuotationPayload>(
    key: K,
    value: QuotationPayload[K],
  ) {
    changed(String(key));
    setPayload((current) => ({ ...current, [key]: value }));
  }
  function updateCertification(
    value: SetStateAction<QuotationPayload["certification"]>,
  ) {
    changed("certification");
    setPayload((current) => ({
      ...current,
      certification:
        typeof value === "function" ? value(current.certification) : value,
    }));
  }
  function updateUploadState(field: string, busy: boolean) {
    setUploadingFields((current) => {
      const next = new Set(current);
      if (busy) next.add(field);
      else next.delete(field);
      return next;
    });
  }
  function setWithholdingEnabled(enabled: boolean) {
    changed("withholdingTaxRate");
    setPayload((current) => ({
      ...current,
      withholdingTaxRate: enabled
        ? (current.withholdingTaxRate ?? "3.00")
        : null,
    }));
  }
  function updateSeller<K extends keyof SellerSnapshot>(
    key: K,
    value: SellerSnapshot[K],
  ) {
    changed(`seller.${String(key)}`);
    setPayload((current) => ({
      ...current,
      seller: { ...current.seller, [key]: value },
    }));
  }
  function replaceCustomerSnapshot(customer: CustomerSnapshot) {
    for (const field of ["name", "address", "taxId", "officeType", "branchNumber"] as const) {
      changed(`customer.${field}`);
    }
    setPayload((current) => ({ ...current, customer }));
  }
  function updateSellerOfficeType(officeType: SellerSnapshot["officeType"]) {
    changed("seller.officeType");
    setPayload((current) => ({
      ...current,
      seller: {
        ...current.seller,
        branchNumber:
          officeType === "branch" ? current.seller.branchNumber : "",
        officeType,
      },
    }));
  }
  function updateItem<K extends keyof QuotationItemInput>(
    index: number,
    key: K,
    value: QuotationItemInput[K],
  ) {
    changed(`items.${index}.${String(key)}`);
    setPayload((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    }));
  }
  function addItem() {
    changed("items");
    setPayload((current) => ({
      ...current,
      items: positions([
        ...current.items,
        {
          description: "",
          discountAmount: "0",
          id: crypto.randomUUID(),
          name: "",
          position: 0,
          quantity: "1",
          unit: "",
          unitPrice: "0.00",
          vatRate: "0",
          vatTreatment: "none",
        },
      ]),
    }));
  }
  function addPaymentMethod() {
    if (!paymentListState.canAdd) return;
    updateRoot(
      "paymentMethods",
      normalizePaymentPositions([...payload.paymentMethods, emptyPaymentMethod()]),
    );
  }
  function removeItem(index: number) {
    if (payload.items.length > 1) {
      changed("items");
      setPayload((current) => ({
        ...current,
        items: positions(
          current.items.filter((_, itemIndex) => itemIndex !== index),
        ),
      }));
    }
  }
  function recalculateValidUntil(
    issueDate: string,
    validityDays: string,
    validUntil: string,
  ) {
    try {
      return addQuotationCalendarDays(issueDate, Number(validityDays));
    } catch {
      return validUntil;
    }
  }
  function updateIssueDate(value: string) {
    changed("issueDate");
    setPayload((current) => ({
      ...current,
      issueDate: value,
      validUntil: current.validityDays
        ? recalculateValidUntil(value, current.validityDays, current.validUntil)
        : current.validUntil,
    }));
  }
  function updateValidityDays(value: string) {
    changed("validityDays");
    setPayload((current) => ({
      ...current,
      validityDays: value,
      validUntil: value
        ? recalculateValidUntil(current.issueDate, value, current.validUntil)
        : current.validUntil,
    }));
  }
  function save(close = false) {
    if (uploadingFields.size) return;
    startTransition(async () => {
      const result = await saveQuotationAction(payload);
      if (!result.ok) {
        const errorFields = Object.keys(result.fieldErrors);
        const firstField = errorFields[0];
        if (firstField) {
          pendingFocusField.current = firstField.startsWith("customer.")
            ? "customer.name"
            : firstField;
        }
        setFieldErrors(result.fieldErrors);
        if (result.formError) toast.error(result.formError);
        else if (errorFields.length)
          toast.error("กรุณาตรวจสอบข้อมูลที่กรอก");
        const completionField = errorFields.find(
          (field) =>
            field === "certification" ||
            field.startsWith("certification.") ||
            field.startsWith("paymentMethods"),
        );
        if (completionField) {
          setCompletionExpanded(true);
          setActiveCompletionTab(
            completionField.startsWith("paymentMethods")
              ? "payments"
              : "certification",
          );
        }
        return;
      }
      setLastSavedPayload(result.payload);
      setPayload({ ...result.payload, id: result.id });
      setDocumentNumber(result.documentNumber);
      setPublicToken(result.publicToken);
      setFieldErrors({});
      setIsDirty(false);
      toast.success("บันทึกใบเสนอราคาแล้ว");
      if (close) router.push("/admin/quotations");
      else if (!payload.id)
        router.replace(
          `/admin/quotations/${encodeURIComponent(result.id)}?saved=1`,
        );
      else router.refresh();
    });
  }
  const printSaved = useCallback(() => {
    if (!canPrint) return;
    setIsPrinting(true);
  }, [canPrint]);
  useEffect(() => {
    if (!isPrinting) return;
    let finished = false;
    let timeout: number | undefined;
    const controller = new AbortController();
    const printStyle = document.createElement("style");
    printStyle.textContent = "@page { size: A4; margin: 0; }";
    function cleanup() {
      if (finished) return;
      finished = true;
      document.documentElement.classList.remove("quotation-printing");
      printStyle.remove();
      if (timeout !== undefined) window.clearTimeout(timeout);
      setIsPrinting(false);
    }

    const frame = window.requestAnimationFrame(() => {
      void (async () => {
        try {
          const images =
            document.querySelectorAll<HTMLImageElement>(
              "[data-quotation-print] img",
            );
          const ready = await waitForQuotationPrintImages(images, {
            signal: controller.signal,
          });
          if (!ready || controller.signal.aborted) return;
          document.head.append(printStyle);
          document.documentElement.classList.add("quotation-printing");
          window.addEventListener("afterprint", cleanup, { once: true });
          window.print();
          if (!finished) timeout = window.setTimeout(cleanup, 1_000);
        } catch {
          if (!controller.signal.aborted) {
            toast.error(
              "ไม่สามารถเตรียมเอกสารสำหรับพิมพ์ได้ กรุณาลองอีกครั้ง",
            );
            cleanup();
          }
        }
      })();
    });

    return () => {
      controller.abort();
      window.cancelAnimationFrame(frame);
      if (timeout !== undefined) window.clearTimeout(timeout);
      window.removeEventListener("afterprint", cleanup);
      document.documentElement.classList.remove("quotation-printing");
      printStyle.remove();
    };
  }, [isPrinting]);
  useEffect(() => {
    if (!printOnLoad || !canPrint || autoPrintStarted.current) return;
    autoPrintStarted.current = true;
    printSaved();
  }, [canPrint, printOnLoad, printSaved]);
  useEffect(() => {
    let stale = false;
    if (!lastSavedPayload?.documentDisplay.certificationQr || !publicOrigin || !publicToken) {
      queueMicrotask(() => {
        if (stale) return;
        setPublicQrDataUrl("");
        setPublicQrSettledToken(publicToken ?? "");
      });
      return () => {
        stale = true;
      };
    }

    const publicUrl = buildQuotationPublicUrl(publicOrigin, publicToken);
    createQuotationPublicQrDataUrl(publicUrl)
      .then((value) => {
        if (stale) return;
        setPublicQrDataUrl(value);
        setPublicQrSettledToken(publicToken);
      })
      .catch(() => {
        if (stale) return;
        setPublicQrDataUrl("");
        setPublicQrSettledToken(publicToken);
        toast.error("ไม่สามารถสร้าง QR เอกสารสาธารณะได้");
      });
    return () => {
      stale = true;
    };
  }, [lastSavedPayload?.documentDisplay.certificationQr, publicOrigin, publicToken]);
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);
  function closeEditor() {
    if (isDirty) {
      setPendingConfirmation("close");
      return;
    }
    router.push("/admin/quotations");
  }
  function confirmPendingAction() {
    setPendingConfirmation(null);
    setIsDirty(false);
    router.push("/admin/quotations");
  }
  async function shareSaved() {
    if (!canUseSavedDocument || !publicOrigin || !publicToken) return;
    try {
      await navigator.clipboard.writeText(buildQuotationPublicUrl(publicOrigin, publicToken));
      toast.success("คัดลอกลิงก์สาธารณะแล้ว");
    } catch {
      toast.error("ไม่สามารถคัดลอกลิงก์ได้");
    }
  }
  async function downloadSaved() {
    if (!canUseSavedDocument || !lastSavedPayload || !savedCalculation || !documentNumber || isDownloading) return;
    const needsPublicQr = lastSavedPayload.documentDisplay.certificationQr;
    if (needsPublicQr && (!publicOrigin || !publicToken)) return;
    setIsDownloading(true);
    try {
      const publicQrDataUrl = needsPublicQr
        ? savedPublicQrDataUrl || await createQuotationPublicQrDataUrl(
          buildQuotationPublicUrl(publicOrigin!, publicToken!),
        )
        : "";
      const { downloadQuotationPdf } = await import("./quotation-pdf");
      await downloadQuotationPdf({
        calculation: savedCalculation,
        documentNumber,
        payload: lastSavedPayload,
        publicQrDataUrl,
      });
    } catch {
      toast.error("ไม่สามารถสร้าง PDF ได้ กรุณาลองอีกครั้ง");
    } finally {
      setIsDownloading(false);
    }
  }
  function openDeleteDialog() {
    setDeleteError("");
    setDeleteOpen(true);
  }
  function deleteQuotation() {
    if (!payload.id) return;
    setDeleteError("");
    startTransition(async () => {
      const result = await deleteQuotationAction(payload.id!);
      if (!result.ok) {
        setDeleteError(result.formError);
        toast.error(result.formError);
        return;
      }
      setDeleteOpen(false);
      setIsDirty(false);
      toast.success(`ลบ ${documentNumber ?? "ใบเสนอราคา"} แล้ว`);
      router.push("/admin/quotations");
    });
  }
  const itemProps = (item: QuotationItemInput, index: number): ItemProps => ({
    calculation: calculation ?? undefined,
    errors: fieldErrors,
    index,
    item,
    itemNames,
    onRemove: () => removeItem(index),
    onUpdate: (key, value) => updateItem(index, key, value),
    showDiscount: payload.documentDisplay.discount,
    showTax: payload.documentDisplay.tax,
    showUnit: payload.documentDisplay.unit,
    totalItems: payload.items.length,
  });
  const saveDisabled = isPending || uploadingFields.size > 0;
  const confirmationCopy = {
    title: "ออกจากหน้านี้โดยไม่บันทึก?",
    description: "การเปลี่ยนแปลงที่ยังไม่ได้บันทึกจะหายไป",
    confirm: "ออกโดยไม่บันทึก",
  };

  return (
    <div
      className="space-y-4 pb-24 md:pb-0"
      data-dirty={isDirty}
      data-quotation-editor
    >
      <header
        className="flex flex-wrap items-start justify-between gap-3 border-b border-foreground/25 pb-3"
        data-workbench-command-bar
      >
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {documentNumber ?? "ใบเสนอราคาใหม่"}
          </h1>
          {!documentNumber ? (
            <p className="text-xs text-muted-foreground">เลขที่ออกเมื่อบันทึก</p>
          ) : null}
        </div>
        <div
          className="hidden items-center gap-2 md:flex"
          data-desktop-command-actions
        >
          <Button onClick={closeEditor} type="button" variant="outline">
            กลับ
          </Button>
          <Button
            disabled={!calculation}
            onClick={() => setPreviewOpen(true)}
            type="button"
            variant="outline"
          >
            ดูตัวอย่าง
          </Button>
          <Button disabled={saveDisabled} onClick={() => save()} type="button">
            {isPending ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </div>
      </header>
      {calculationError ? (
        <Alert variant="destructive">
          <AlertDescription>{calculationError}</AlertDescription>
        </Alert>
      ) : null}
      <section
        className="flex flex-wrap items-center justify-between gap-3 border-b py-2"
        data-seller-strip
      >
        <div className="flex min-w-0 items-center gap-3">
          {payload.seller.logoUrl && !logoUnavailable ? (
            <picture>
              <img
                alt="โลโก้ผู้ขาย"
                className="max-h-12 max-w-24 object-contain"
                onError={() => setLogoUnavailable(true)}
                src={payload.seller.logoUrl}
              />
            </picture>
          ) : (
            <div className="grid h-10 w-16 place-items-center rounded border text-xs text-muted-foreground">
              โลโก้
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium">
              {payload.seller.name || "ยังไม่มีชื่อผู้ขาย"}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {payload.seller.officeType === "branch"
                ? `สาขา ${payload.seller.branchNumber || "-"}`
                : payload.seller.officeType === "head_office"
                  ? "สำนักงานใหญ่"
                  : "ไม่ระบุ"}
              {payload.seller.taxId ? ` · ${payload.seller.taxId}` : ""}
            </p>
          </div>
          <Button
            onClick={() => setSellerExpanded((open) => !open)}
            size="sm"
            type="button"
            variant="ghost"
          >
            แก้ไขเฉพาะใบ
          </Button>
        </div>
        <div
          className="flex flex-wrap items-center gap-2"
          data-document-actions
        >
          <QuotationDocumentDisplayDialog
            disabled={isPending || uploadingFields.size > 0}
            onApply={applyDocumentDisplay}
            payload={payload}
          />
          <Button
            aria-describedby={shareUnavailableMessage ? "quotation-share-unavailable" : undefined}
            disabled={!canUseSavedDocument}
            onClick={shareSaved}
            size="sm"
            title={shareUnavailableMessage || (documentNumber && isDirty ? "บันทึกการเปลี่ยนแปลงก่อน" : undefined)}
            type="button"
            variant="outline"
          >
            <Share2 aria-hidden="true" className="size-4" />
            แชร์
          </Button>
          <Button
            disabled={!canPrint}
            onClick={printSaved}
            size="sm"
            type="button"
            variant="outline"
          >
            <Printer aria-hidden="true" className="size-4" />
            พิมพ์
          </Button>
          <Button
            disabled={!canUseSavedDocument || isDownloading}
            onClick={downloadSaved}
            size="sm"
            title={documentNumber && isDirty ? "บันทึกการเปลี่ยนแปลงก่อน" : undefined}
            type="button"
            variant="outline"
          >
            <Download aria-hidden="true" className="size-4" />
            {isDownloading ? "กำลังสร้าง PDF…" : "ดาวน์โหลด"}
          </Button>
          {shareUnavailableMessage ? (
            <p className="basis-full text-xs text-destructive" id="quotation-share-unavailable">
              {shareUnavailableMessage}
            </p>
          ) : null}
          {payload.id ? (
            <Button
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={openDeleteDialog}
              size="sm"
              type="button"
              variant="outline"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              ลบใบเสนอราคา
            </Button>
          ) : null}
        </div>
      </section>
      {sellerExpanded ? (
        <section
          className="grid gap-3 rounded-lg border p-4 md:grid-cols-2"
          data-seller-edit
        >
          <TextInput
            error={fieldErrors["seller.name"]}
            field="seller.name"
            label="ผู้ขาย"
            onChange={(value) => updateSeller("name", value)}
            value={payload.seller.name}
          />
          <Field
            error={fieldErrors["seller.address"]}
            field="seller.address"
            label="ที่อยู่"
          >
            <Textarea
              aria-describedby={
                fieldErrors["seller.address"]
                  ? fieldErrorId("seller.address")
                  : undefined
              }
              aria-invalid={Boolean(fieldErrors["seller.address"])}
              data-field="seller.address"
              onChange={(event) => updateSeller("address", event.target.value)}
              value={payload.seller.address}
            />
          </Field>
          <TextInput
            digitsOnly
            error={fieldErrors["seller.taxId"]}
            field="seller.taxId"
            inputClassName="max-w-72"
            label="เลขผู้เสียภาษี"
            onChange={(value) => updateSeller("taxId", value)}
            value={payload.seller.taxId}
          />
          <OfficeTypeControls
            error={fieldErrors["seller.officeType"]}
            field="seller.officeType"
            label="สำนักงานผู้ขาย"
            onChange={updateSellerOfficeType}
            value={payload.seller.officeType}
          />
          <TextInput
            disabled={payload.seller.officeType !== "branch"}
            error={fieldErrors["seller.branchNumber"]}
            field="seller.branchNumber"
            inputClassName="max-w-48"
            label="เลขสาขาผู้ขาย"
            onChange={(value) => updateSeller("branchNumber", value)}
            value={payload.seller.branchNumber}
          />
          <TextInput
            error={fieldErrors["seller.phone"]}
            field="seller.phone"
            inputClassName="max-w-56"
            label="โทรศัพท์"
            onChange={(value) => updateSeller("phone", value)}
            value={payload.seller.phone}
          />
          <TextInput
            error={fieldErrors["seller.email"]}
            field="seller.email"
            inputClassName="max-w-80"
            label="อีเมล"
            onChange={(value) => updateSeller("email", value)}
            value={payload.seller.email}
          />
          <TextInput
            error={fieldErrors["seller.website"]}
            field="seller.website"
            inputClassName="max-w-80"
            label="เว็บไซต์"
            onChange={(value) => updateSeller("website", value)}
            value={payload.seller.website}
          />
        </section>
      ) : null}
      <div data-workbench-metadata className="grid gap-6 lg:grid-cols-12">
        <section
          data-customer-section
          className="border-t border-foreground/35 pt-2 lg:col-span-7"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">01 ลูกค้า</h2>
            <span className="text-xs text-muted-foreground">
              เลือกจากข้อมูลลูกค้าเท่านั้น
            </span>
          </div>
          <QuotationCustomerPicker
            current={payload.customer}
            error={
              fieldErrors["customer.name"]
              || fieldErrors["customer.address"]
              || fieldErrors["customer.taxId"]
              || fieldErrors["customer.officeType"]
              || fieldErrors["customer.branchNumber"]
            }
            onSelect={replaceCustomerSnapshot}
          />
        </section>
        <section
          data-document-section
          className="border-t border-foreground/35 pt-2 lg:col-span-5"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">02 ข้อมูลเอกสาร</h2>
            <span className="text-xs text-muted-foreground">บาท</span>
          </div>
          <div data-document-fields className="grid gap-3 sm:grid-cols-2">
            <Field
              error={fieldErrors.issueDate}
              field="issueDate"
              label="วันที่ออก"
            >
              <Input
                aria-describedby={
                  fieldErrors.issueDate
                    ? fieldErrorId("issueDate")
                    : undefined
                }
                aria-invalid={Boolean(fieldErrors.issueDate)}
                className={controlClassName("date")}
                data-field="issueDate"
                onChange={(event) => updateIssueDate(event.target.value)}
                type="date"
                value={payload.issueDate}
              />
            </Field>
            <TextInput
              disabled
              error={fieldErrors.validityDays}
              field="validityDays"
              inputMode="numeric"
              label="จำนวนวัน"
              onChange={updateValidityDays}
              size="compact"
              value={payload.validityDays}
            />
            <Field
              error={fieldErrors.validUntil}
              field="validUntil"
              label="ใช้ได้ถึง"
            >
              <Input
                aria-describedby={
                  fieldErrors.validUntil
                    ? fieldErrorId("validUntil")
                    : undefined
                }
                aria-invalid={Boolean(fieldErrors.validUntil)}
                className={controlClassName("date")}
                data-field="validUntil"
                onChange={(event) => {
                  changed("validUntil");
                  setPayload((current) => ({
                    ...current,
                    validUntil: event.target.value,
                    validityDays: "",
                  }));
                }}
                type="date"
                value={payload.validUntil}
              />
            </Field>
            <TextInput
              error={fieldErrors.subject}
              field="subject"
              label="เรื่อง / ชื่องาน (ถ้ามี)"
              onChange={(value) => updateRoot("subject", value)}
              size="name"
              value={payload.subject}
            />
            {payload.documentDisplay.reference ? <div className="sm:col-span-2">
              <TextInput
                error={fieldErrors.reference}
                field="reference"
                label="เลขอ้างอิง (ถ้ามี)"
                onChange={(value) => updateRoot("reference", value)}
                size="identifier"
                value={payload.reference}
              />
            </div> : null}
          </div>
        </section>
      </div>
      <section className="space-y-3 border-t border-foreground/35 pt-2">
        <h2 className="text-sm font-semibold">03 รายการ</h2>
        <div
          className={cn(
            "hidden xl:grid xl:gap-2 xl:border-b xl:pb-2 xl:text-xs xl:text-muted-foreground",
            itemGrid(),
          )}
        >
          <span className="xl:col-start-1">#</span>
          <span className="xl:col-start-2">รายการ / รายละเอียด</span>
          <span className="xl:col-start-3">จำนวน</span>
          {payload.documentDisplay.unit ? <span className="xl:col-start-4">หน่วย</span> : null}
          <span className="xl:col-start-5">ราคาต่อหน่วย</span>
          {payload.documentDisplay.discount ? <span className="xl:col-start-6">ส่วนลด</span> : null}
          {payload.documentDisplay.tax ? <span className="xl:col-start-7">VAT</span> : null}
          <span className="text-right xl:col-start-8">มูลค่าก่อนภาษี</span>
        </div>
        <DragDropProvider
          onDragEnd={(event) => {
            if (event.canceled) return;
            changed("items");
            setPayload((current) => ({
              ...current,
              items: positions(
                move(current.items, event) as QuotationItemInput[],
              ),
            }));
          }}
        >
          <div className="grid gap-3 xl:gap-0" data-sortable-items>
            {payload.items.map((item, index) => (
              <SortableQuotationItem
                key={item.id}
                {...itemProps(item, index)}
              />
            ))}
          </div>
        </DragDropProvider>
        <Button
          className="text-blue-700"
          onClick={addItem}
          size="sm"
          type="button"
          variant="outline"
        >
          เพิ่มรายการ
        </Button>
      </section>
      <div
        data-workbench-completion
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]"
      >
        <section
          data-notes-grid
          className="grid gap-4 lg:col-start-1 lg:row-start-1 lg:grid-cols-2"
        >
          {payload.documentDisplay.notes ? <div data-public-notes>
            <Field
              error={fieldErrors.publicNotes}
              field="publicNotes"
              label="หมายเหตุบนเอกสาร"
            >
              <Textarea
                aria-describedby={
                  fieldErrors.publicNotes
                    ? fieldErrorId("publicNotes")
                    : undefined
                }
                aria-invalid={Boolean(fieldErrors.publicNotes)}
                data-field="publicNotes"
                onChange={(event) =>
                  updateRoot("publicNotes", event.target.value)
                }
                value={payload.publicNotes}
              />
            </Field>
          </div> : null}
          <div data-field="items" data-internal-notes tabIndex={-1}>
            {fieldErrors.items ? (
              <span className="text-xs text-destructive">
                {fieldErrors.items}
              </span>
            ) : null}
            <Field
              error={fieldErrors.internalNotes}
              field="internalNotes"
              label="หมายเหตุภายใน (ไม่แสดงในเอกสาร)"
            >
              <Textarea
                aria-describedby={
                  fieldErrors.internalNotes
                    ? fieldErrorId("internalNotes")
                    : undefined
                }
                aria-invalid={Boolean(fieldErrors.internalNotes)}
                data-field="internalNotes"
                onChange={(event) =>
                  updateRoot("internalNotes", event.target.value)
                }
                value={payload.internalNotes}
              />
            </Field>
          </div>
        </section>
        <section
          data-quotation-totals
          className="space-y-2 border-t-2 border-foreground pt-3 lg:col-start-2 lg:row-span-2 lg:row-start-1"
        >
          <Totals
            label="รวมก่อนส่วนลด"
            value={money(calculation?.grossTotal)}
          />
          {calculation?.discountTotal !== "0.00" ? (
            <Totals label="ส่วนลด" value={money(calculation?.discountTotal)} />
          ) : null}
          <Totals
            label="มูลค่าก่อนภาษี"
            value={money(calculation?.preTaxTotal)}
          />
          <Totals label="VAT" value={money(calculation?.vatTotal)} />
          <Totals
            bold
            label="จำนวนเงินรวมทั้งสิ้น"
            value={money(calculation?.grandTotal)}
          />
          {payload.documentDisplay.withholdingTax ? <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-2">
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <input
                checked={payload.withholdingTaxRate !== null}
                className="size-4 accent-primary"
                onChange={(event) =>
                  setWithholdingEnabled(event.target.checked)
                }
                type="checkbox"
              />
              หักภาษี ณ ที่จ่าย
              <Numeric
                disabled={payload.withholdingTaxRate === null}
                error={fieldErrors.withholdingTaxRate}
                field="withholdingTaxRate"
                inputClassName="w-28"
                onChange={(value) => updateRoot("withholdingTaxRate", value)}
                size="compact"
                value={payload.withholdingTaxRate ?? "0.00"}
              />
              %
            </label>
            <output className="ml-auto max-w-full text-right tabular-nums [overflow-wrap:anywhere]">
              {money(calculation?.withholdingTaxTotal)}
            </output>
          </div> : null}
          <Totals bold label="ยอดชำระ" value={money(calculation?.amountDue)} />
          <p className="text-sm">
            {calculation ? formatThaiBahtText(calculation.amountDue) : "—"}
          </p>
        </section>
        <section
          className="min-w-0 lg:col-start-1 lg:row-start-2"
          data-completion-tabs
        >
          <div className="flex items-center justify-between gap-3 border-b py-2">
            <h2 className="text-sm font-semibold">ข้อมูลท้ายใบเสนอราคา</h2>
            <Button
              aria-controls="quotation-completion-content"
              aria-expanded={completionExpanded}
              aria-label={`${completionExpanded ? "ซ่อน" : "แสดง"}ข้อมูลท้ายใบเสนอราคา`}
              onClick={() =>
                setCompletionExpanded((current) => !current)
              }
              size="sm"
              type="button"
              variant="outline"
            >
              {completionExpanded ? "ซ่อน" : "แสดง"}
            </Button>
          </div>
          <div
            hidden={!completionExpanded}
            id="quotation-completion-content"
          >
          <div
            aria-label="ข้อมูลท้ายใบเสนอราคา"
            className="flex gap-5 border-b"
            role="tablist"
          >
            <button
              aria-controls="quotation-completion-panel"
              aria-selected={activeCompletionTab === "payments"}
              className={cn(
                "border-b-2 px-1 py-2 text-sm font-medium",
                activeCompletionTab === "payments"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground",
              )}
              id="quotation-payments-tab"
              onClick={() => setActiveCompletionTab("payments")}
              role="tab"
              type="button"
            >
              ช่องทางชำระเงิน
            </button>
            <button
              aria-controls="quotation-completion-panel"
              aria-selected={activeCompletionTab === "certification"}
              className={cn(
                "border-b-2 px-1 py-2 text-sm font-medium",
                activeCompletionTab === "certification"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground",
              )}
              id="quotation-certification-tab"
              onClick={() => setActiveCompletionTab("certification")}
              role="tab"
              type="button"
            >
              การรับรอง
            </button>
          </div>
          <div
            aria-labelledby={
              activeCompletionTab === "payments"
                ? "quotation-payments-tab"
                : "quotation-certification-tab"
            }
            className="pt-4"
            id="quotation-completion-panel"
            role="tabpanel"
          >
            <div
              className="grid gap-3"
              data-payment-methods
              hidden={activeCompletionTab !== "payments"}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">ช่องทางชำระเงิน</span>
                <Button
                  disabled={!paymentListState.canAdd}
                  onClick={addPaymentMethod}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  เพิ่มช่องทางชำระเงิน
                </Button>
              </div>
              <PaymentMethodList
                banks={banks}
                errors={fieldErrors}
                methods={payload.paymentMethods}
                mode="quotation"
                onChange={(paymentMethods) =>
                  updateRoot("paymentMethods", paymentMethods)
                }
                showAddButton={false}
              />
            </div>
            <div
              data-certification-fields
              hidden={activeCompletionTab !== "certification"}
            >
              <CertificationFields
                disabled={isPending}
                errors={fieldErrors}
                onChange={updateCertification}
                onUploadStateChange={updateUploadState}
                value={payload.certification}
              />
            </div>
          </div>
          </div>
        </section>
      </div>
      <div
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 gap-2 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden print:hidden"
        data-mobile-command-bar
      >
        <Button onClick={closeEditor} type="button" variant="outline">
          กลับ
        </Button>
        <Button
          disabled={!calculation}
          onClick={() => setPreviewOpen(true)}
          type="button"
          variant="outline"
        >
          ดูตัวอย่าง
        </Button>
        <Button disabled={saveDisabled} onClick={() => save()} type="button">
          {isPending ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </div>
      <Dialog onOpenChange={setPreviewOpen} open={previewOpen}>
        <DialogContent
          className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-auto p-0 sm:max-w-[calc(100vw-4rem)]"
          showCloseButton
        >
          {calculation ? (
            <QuotationDocument
              calculation={calculation}
              documentNumber={documentNumber}
              payload={payload}
              publicQrDataUrl={draftPublicQrDataUrl}
            />
          ) : (
            <p className="p-4">กรุณาแก้ไขข้อมูลก่อนดูตัวอย่าง</p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        onOpenChange={(open) => !open && setPendingConfirmation(null)}
        open={pendingConfirmation !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmationCopy.title}</DialogTitle>
            <DialogDescription>{confirmationCopy.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setPendingConfirmation(null)}
              type="button"
              variant="outline"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={confirmPendingAction}
              type="button"
              variant="destructive"
            >
              {confirmationCopy.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ลบใบเสนอราคา</DialogTitle>
            <DialogDescription>
              ต้องการลบ {documentNumber ?? "ใบเสนอราคานี้"} ของ{" "}
              {payload.customer.name || "ลูกค้ารายนี้"} ใช่หรือไม่
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <Alert variant="destructive">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              onClick={() => setDeleteOpen(false)}
              type="button"
              variant="outline"
            >
              ยกเลิก
            </Button>
            <Button
              disabled={isPending}
              onClick={deleteQuotation}
              type="button"
              variant="destructive"
            >
              ลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isPrinting && lastSavedPayload && savedCalculation
        ? createPortal(
            <div data-quotation-print>
              <QuotationDocument
                calculation={savedCalculation}
                documentNumber={documentNumber}
                payload={lastSavedPayload}
                publicQrDataUrl={savedPublicQrDataUrl}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
