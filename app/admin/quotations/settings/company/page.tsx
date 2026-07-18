import Link from "next/link";
import { Building2, CreditCard } from "lucide-react";

import { CompanyProfileForm, PaymentMethodsSettings } from "../../../../../components/admin/quotations/company-profile-form";
import { Empty, EmptyHeader, EmptyTitle } from "../../../../../components/ui/empty";
import { cn } from "../../../../../lib/utils";
import { canUseQuotation, requireAdmin } from "../../../../../server/auth/admin";
import { companyProfileToSeller, getQuotationCompanyProfile, listCompanyPaymentMethods, listQuotationBanks } from "../../../../../server/repositories/quotations";

const sections = [
  { href: "/admin/quotations/settings/company?section=company", icon: Building2, id: "company", label: "ข้อมูลผู้ขายหลัก" },
  { href: "/admin/quotations/settings/company?section=payments", icon: CreditCard, id: "payments", label: "ช่องทางชำระเงิน" },
] as const;

export default async function CompanyProfilePage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { section } = await searchParams;
  const selectedSection = section === "payments" ? "payments" : "company";
  const { adminUser, supabase, user } = await requireAdmin();
  if (!canUseQuotation(adminUser)) return <Empty><EmptyHeader><EmptyTitle>ไม่มีสิทธิ์เข้าถึงข้อมูลผู้ขาย</EmptyTitle></EmptyHeader></Empty>;
  const [profile, banks, paymentMethods] = await Promise.all([
    getQuotationCompanyProfile(supabase, user.id),
    listQuotationBanks(supabase),
    listCompanyPaymentMethods(supabase, user.id),
  ]);
  const seller = profile ? companyProfileToSeller(profile) : {
    address: "", branchNumber: "", contactEmail: "", contactName: "", contactPhone: "", email: "", logoUrl: "", name: "", officeType: "head_office" as const, phone: "", taxId: "", website: "",
  };
  return <div className="mx-auto grid w-full max-w-6xl gap-4">
    <Link className="w-fit text-sm text-muted-foreground underline-offset-4 hover:underline" href="/admin/quotations">กลับไปหน้ารายการใบเสนอราคา</Link>
    <header><h1 className="text-xl font-semibold">ตั้งค่าข้อมูลใบเสนอราคา</h1><p className="text-sm text-muted-foreground">จัดการข้อมูลผู้ขายและช่องทางรับชำระเงินของบัญชีนี้</p></header>
    <div className="grid overflow-hidden rounded-lg border lg:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="min-w-0 border-b bg-muted/20 lg:border-b-0 lg:border-r">
        <div className="hidden border-b px-4 py-3 text-sm font-semibold lg:block">การตั้งค่า</div>
        <nav aria-label="ตั้งค่าข้อมูลใบเสนอราคา" className="flex gap-1 overflow-x-auto p-2 lg:grid lg:overflow-visible">
          {sections.map((item) => {
            const Icon = item.icon;
            return <Link aria-current={selectedSection === item.id ? "page" : undefined} className={cn("flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm", selectedSection === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")} href={item.href} key={item.id}><Icon aria-hidden="true" className="size-4" />{item.label}</Link>;
          })}
        </nav>
      </aside>
      <main className="min-w-0 p-4 lg:p-6">
        {selectedSection === "company" ? <CompanyProfileForm initialSeller={seller} /> : null}
        {selectedSection === "payments" ? <PaymentMethodsSettings banks={banks} initialMethods={paymentMethods} /> : null}
      </main>
    </div>
  </div>;
}
