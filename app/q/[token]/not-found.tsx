export default function PublicQuotationNotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-muted p-6">
      <section className="max-w-md text-center">
        <h1 className="text-xl font-semibold">ไม่พบใบเสนอราคา</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          ลิงก์อาจไม่ถูกต้องหรือเอกสารถูกนำออกแล้ว
        </p>
      </section>
    </main>
  );
}
