const CENTRAL_USER_LIST_PAGE_SIZE = 10;

export function createCentralUserListFormData({ tenantKey, page, operationId }: { tenantKey: string; page: number; operationId: string }) {
  const formData = new FormData();
  formData.set("tenantKey", tenantKey);
  formData.set("page", String(page));
  formData.set("pageSize", String(CENTRAL_USER_LIST_PAGE_SIZE));
  formData.set("operationId", operationId);
  return formData;
}
