"use client";
"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThemeProvider = ThemeProvider;
var React = require("react");
var next_themes_1 = require("next-themes");
function ThemeProvider(_a) {
    var children = _a.children, props = __rest(_a, ["children"]);
    return (<next_themes_1.ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange {...props}>
      <ThemeHotkey />
      {children}
    </next_themes_1.ThemeProvider>);
}
function isTypingTarget(target) {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    return (target.isContentEditable ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT");
}
function ThemeHotkey() {
    var _a = (0, next_themes_1.useTheme)(), resolvedTheme = _a.resolvedTheme, setTheme = _a.setTheme;
    React.useEffect(function () {
        function onKeyDown(event) {
            if (event.defaultPrevented || event.repeat) {
                return;
            }
            if (event.metaKey || event.ctrlKey || event.altKey) {
                return;
            }
            if (event.key.toLowerCase() !== "d") {
                return;
            }
            if (isTypingTarget(event.target)) {
                return;
            }
            setTheme(resolvedTheme === "dark" ? "light" : "dark");
        }
        window.addEventListener("keydown", onKeyDown);
        return function () {
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [resolvedTheme, setTheme]);
    return null;
}
