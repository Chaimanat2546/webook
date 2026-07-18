import Link from "next/link";

import { CompanyProfileForm } from "../../../../../components/admin/quotations/company-profile-form";
import { Empty, EmptyHeader, EmptyTitle } from "../../../../../components/ui/empty";
import { canUseQuotation, requireAdmin } from "../../../../../server/auth/admin";
import { companyProfileToSeller, getQuotationCompanyProfile } from "../../../../../server/repositories/quotations";

export default async function CompanyProfilePage() {
  const { adminUser, supabase, user } = await requireAdmin();
  if (!canUseQuotation(adminUser)) return <Empty><EmptyHeader><EmptyTitle>ไม่มีสิทธิ์เข้าถึงข้อมูลผู้ขาย</EmptyTitle></EmptyHeader></Empty>;
  const profile = await getQuotationCompanyProfile(supabase, user.id);
  const seller = profile ? companyProfileToSeller(profile) : {
    address: "", branchNumber: "", contactEmail: "", contactName: "", contactPhone: "", email: "", logoUrl: "", name: "", officeType: "head_office" as const, phone: "", taxId: "", website: "",
  };
  return <div className="mx-auto max-w-3xl space-y-4"><Link className="text-sm underline" href="/admin/quotations">กลับไปใบเสนอราคา</Link><div><h1 className="text-xl font-semibold">ข้อมูลผู้ขายหลัก</h1><p className="text-sm text-muted-foreground">ใบเสนอราคาใหม่จะคัดลอกข้อมูลนี้เป็นสำเนาที่แก้ไขได้</p></div><CompanyProfileForm initialSeller={seller} /></div>;
}
