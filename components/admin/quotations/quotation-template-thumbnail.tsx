import type { QuotationTemplate } from "../../../lib/quotation-template";
import { cn } from "../../../lib/utils";

interface TemplatePalette {
  accent: string;
  light: string;
}

const palette: Record<QuotationTemplate, TemplatePalette> = {
  corporate: { accent: "bg-[#142d4c]", light: "bg-[#f2f5f8]" },
  current: { accent: "bg-indigo-500", light: "bg-indigo-50" },
  hospitality: { accent: "bg-[#286a5b]", light: "bg-[#f1f7f4]" },
};

interface QuotationTemplateThumbnailProps {
  template: QuotationTemplate;
}

export function QuotationTemplateThumbnail({
  template,
}: QuotationTemplateThumbnailProps) {
  switch (template) {
    case "current":
      return <TemplateThumbnail data-template-thumbnail="current" template={template} />;
    case "hospitality":
      return <TemplateThumbnail data-template-thumbnail="hospitality" template={template} />;
    case "corporate":
      return <TemplateThumbnail data-template-thumbnail="corporate" template={template} />;
  }
}

function TemplateThumbnail({
  template,
  ...props
}: QuotationTemplateThumbnailProps & React.HTMLAttributes<HTMLDivElement>) {
  const colors = palette[template];
  const title = template === "corporate" ? "QUOTATION" : "Quotation";

  return (
    <div
      aria-hidden="true"
      className="aspect-[210/297] w-full overflow-hidden rounded-sm border bg-white p-2 shadow-xs"
      {...props}
    >
      <div className={cn("h-1 rounded-full", colors.accent)} />
      <div className="mt-2 flex items-start justify-between gap-2" data-template-header-split>
        <div className="grid gap-1">
          <div className={cn("h-1.5 w-8 rounded-full", colors.accent)} />
          <div className="h-1 w-12 rounded-full bg-slate-200" />
        </div>
        <div className="text-right">
          <p className="text-[0.45rem] font-bold tracking-[0.14em] text-slate-700" data-template-title-treatment>
            {title}
          </p>
          <div className="ml-auto mt-1 h-1 w-7 rounded-full bg-slate-200" />
        </div>
      </div>
      <div className={cn("mt-3 rounded-sm p-1.5", colors.light)}>
        <div className="h-1 w-14 rounded-full bg-slate-300" />
        <div className="mt-1 h-1 w-10 rounded-full bg-slate-200" />
      </div>
      <div className="mt-3 overflow-hidden rounded-sm border" data-template-table-band>
        <div className={cn("h-2", colors.accent)} />
        <div className="space-y-1 p-1.5">
          <div className="h-1 rounded-full bg-slate-100" />
          <div className="h-1 rounded-full bg-slate-100" />
          <div className="h-1 rounded-full bg-slate-100" />
        </div>
      </div>
      <div className="mt-3 ml-auto w-3/5 rounded-sm border p-1.5" data-template-settlement-box>
        <div className={cn("h-1.5 w-8 rounded-full", colors.accent)} />
        <div className="mt-1 h-1 w-full rounded-full bg-slate-200" />
        <div className="mt-1 h-1 w-3/4 rounded-full bg-slate-200" />
      </div>
    </div>
  );
}
