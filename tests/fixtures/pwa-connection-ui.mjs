import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConnectionNotice } from "../../components/pwa/connection-status.tsx";
import { PageError } from "../../components/pwa/page-error.tsx";

console.log(JSON.stringify({
  offline: renderToStaticMarkup(createElement(ConnectionNotice, { offline: true })),
  online: renderToStaticMarkup(createElement(ConnectionNotice, { offline: false })),
  error: renderToStaticMarkup(createElement(PageError, { reset: () => {}, error: new Error("private server details") })),
}));
