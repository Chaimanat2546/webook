import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import { operationMessage, UserManagerPage } from "../../components/admin/user-manager/user-manager-page.tsx";
import { getUserTableActions } from "../../components/admin/user-manager/user-table.tsx";

const pageHtml = renderToStaticMarkup(createElement(UserManagerPage, { tenants: [] }));
const staleActionHtml = renderToStaticMarkup(createElement("p", null, operationMessage({
  operationId: "ced64b64-341e-45f3-9f13-fa1003b3e2f3",
  status: "rejected",
  error: {
    code: "invalid_lifecycle_transition",
    message: "This action is not available for the user's current status.",
  },
})));

console.log(JSON.stringify({
  actions: {
    abnormal: getUserTableActions("abnormal"),
    active: getUserTableActions("active"),
    passwordChangeRequired: getUserTableActions("password_change_required"),
    suspended: getUserTableActions("suspended"),
  },
  pageHtml,
  staleActionHtml,
}));
