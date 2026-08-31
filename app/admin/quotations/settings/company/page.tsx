import { ArrowLeft, BadgeCheck, Building2, CreditCard, PanelsTopLeft } from "lucide-react";

import { CertificationSettings, CompanyProfileForm, PaymentMethodsSettings } from "../../../../../components/admin/quotations/company-profile-form";
import { QuotationSettingsDirtyProvider, QuotationSettingsNavLink } from "../../../../../components/admin/quotations/quotation-settings-dirty";
import { QuotationLayoutEditor } from "../../../../../components/admin/quotations/quotation-layout-editor";
import { Button } from "../../../../../components/ui/button";
import { emptyCertificationSnapshot } from "../../../../../lib/quotation-certification";
import { cn } from "../../../../../lib/utils";
import { isQuotationTemplate } from "../../../../../lib/quotation-template";
import { QUOTATION_TEMPLATES, QUOTATION_TEMPLATE_LABELS } from "../../../../../lib/quotation-template";
import { requireQuotationAdmin } from "../../../../../server/auth/admin";
import { companyProfileToCertification, companyProfileToSeller, companyProfileToTemplate, getQuotationCompanyProfile, listCompanyPaymentMethods, listQuotationBanks, listQuotationDocumentTemplateRevisions, listQuotationDocumentTemplateSnapshots } from "../../../../../server/repositories/quotations";

const sections = [
  { href: "/admin/quotations/settings/company?section=company", icon: Building2, id: "company", label: "ข้อมูลผู้ขายหลัก" },
  { href: "/admin/quotations/settings/company?section=payments", icon: CreditCard, id: "payments", label: "ช่องทางชำระเงิน" },
  { href: "/admin/quotations/settings/company?section=certification", icon: BadgeCheck, id: "certification", label: "ข้อมูลรับรองหลัก" },
  { href: "/admin/quotations/settings/company?section=layout", icon: PanelsTopLeft, id: "layout", label: "จัดการเลเอาท์" },
] as const;

export default async function CompanyProfilePage({ searchParams }: { searchParams: Promise<{ section?: string; template?: string }> }) {
  const { section, template: templateValue } = await searchParams;
  const selectedSection = section === "payments" || section === "certification" || section === "layout" ? section : "company";
  const { supabase, user } = await requireQuotationAdmin();
  const profile = selectedSection === "payments"
    ? null
    : await getQuotationCompanyProfile(supabase, user.id);
  const [banks, paymentMethods] = selectedSection === "payments"
    ? await Promise.all([
        listQuotationBanks(supabase),
        listCompanyPaymentMethods(supabase, user.id),
      ])
    : [[], []];
  const seller = profile ? companyProfileToSeller(profile) : {
    address: "", branchNumber: "", contactEmail: "", contactName: "", contactPhone: "", email: "", logoUrl: "", name: "", officeType: "head_office" as const, phone: "", taxId: "", website: "",
  };
  const initialCertification = profile ? companyProfileToCertification(profile) : emptyCertificationSnapshot();
  const selectedTemplate = isQuotationTemplate(templateValue)
    ? templateValue
    : profile ? companyProfileToTemplate(profile) : "current";
  const templateSnapshots = selectedSection === "layout" && profile
    ? await listQuotationDocumentTemplateSnapshots(supabase, user.id)
    : null;
  const revisions = templateSnapshots
    ? await listQuotationDocumentTemplateRevisions(supabase, templateSnapshots[selectedTemplate].sourceId, selectedTemplate)
    : [];
  return <QuotationSettingsDirtyProvider><div className="mx-auto grid w-full max-w-[1440px] gap-5">
    <header className="flex items-start gap-3 border-b pb-4">
      <Button asChild size="icon-sm" variant="ghost"><QuotationSettingsNavLink aria-label="กลับไปหน้ารายการใบเสนอราคา" href="/admin/quotations"><ArrowLeft aria-hidden="true" /></QuotationSettingsNavLink></Button>
      <div><h1 className="text-xl font-semibold">ตั้งค่าข้อมูลใบเสนอราคา</h1><p className="text-sm text-muted-foreground">จัดการข้อมูลผู้ขาย ช่องทางรับชำระเงิน และข้อมูลรับรองของบัญชีนี้</p></div>
    </header>
    <div className="grid overflow-hidden rounded-lg border lg:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="min-w-0 border-b bg-muted/20 lg:border-b-0 lg:border-r">
        <div className="hidden border-b px-4 py-3 text-sm font-semibold lg:block">การตั้งค่า</div>
        <nav aria-label="ตั้งค่าข้อมูลใบเสนอราคา" className="flex gap-1 overflow-x-auto p-2 lg:grid lg:overflow-visible">
          {sections.map((item) => {
            const Icon = item.icon;
            return <QuotationSettingsNavLink className={cn("flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm", selectedSection === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")} current={selectedSection === item.id} href={item.href} key={item.id}><Icon aria-hidden="true" className="size-4" />{item.label}</QuotationSettingsNavLink>;
          })}
        </nav>
      </aside>
      <main className="min-w-0 p-4 lg:p-6">
        {selectedSection === "company" ? <CompanyProfileForm initialSeller={seller} /> : null}
        {selectedSection === "payments" ? <PaymentMethodsSettings banks={banks} initialMethods={paymentMethods} /> : null}
        {selectedSection === "certification" ? <CertificationSettings initialCertification={initialCertification} /> : null}
        {selectedSection === "layout" && templateSnapshots ? <>
          <div className="mb-5 flex flex-wrap gap-2" aria-label="เลือกเทมเพลตสำหรับจัดการเลเอาท์">
            {QUOTATION_TEMPLATES.map((template) => <QuotationSettingsNavLink
              className={cn("rounded-md border px-3 py-2 text-sm", selectedTemplate === template ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
              current={selectedTemplate === template}
              href={`/admin/quotations/settings/company?section=layout&template=${template}`}
              key={template}
            >{QUOTATION_TEMPLATE_LABELS[template]}</QuotationSettingsNavLink>)}
          </div>
          <QuotationLayoutEditor
            initial={templateSnapshots[selectedTemplate]}
            key={selectedTemplate}
            revisions={revisions}
            template={selectedTemplate}
          />
        </> : null}
      </main>
    </div>
  </div></QuotationSettingsDirtyProvider>;
}
