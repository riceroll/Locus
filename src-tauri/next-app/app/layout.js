"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = RootLayout;
var google_1 = require("next/font/google");
require("./globals.css");
var theme_provider_1 = require("@/components/theme-provider");
var fontSans = (0, google_1.Geist)({
    subsets: ["latin"],
    variable: "--font-sans",
});
var fontMono = (0, google_1.Geist_Mono)({
    subsets: ["latin"],
    variable: "--font-mono",
});
function RootLayout(_a) {
    var children = _a.children;
    return (<html lang="en" suppressHydrationWarning className={"".concat(fontSans.variable, " ").concat(fontMono.variable, " font-sans antialiased")}>
      <body>
        <theme_provider_1.ThemeProvider>{children}</theme_provider_1.ThemeProvider>
      </body>
    </html>);
}
