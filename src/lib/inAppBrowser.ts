const IN_APP_UA = /Instagram|FBAN|FBAV|FB_IAB/i;

/** Instagram and Facebook open links in a webview with the same scroll bug. */
export function isInAppBrowser() {
  if (typeof navigator === "undefined") return false;
  return IN_APP_UA.test(navigator.userAgent || "");
}
