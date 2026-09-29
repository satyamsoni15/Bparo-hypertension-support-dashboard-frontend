// The project's only two typefaces, self-hosted by next/font so every OS
// renders the same metrics (the old system-font stack sat text differently in
// fixed-height buttons, pills and inputs on Windows vs macOS):
//   - Manrope: headings and display type (`font-heading` / `.font-display`)
//   - DM Sans: body copy, UI and data (`font-sans`, also backs `font-mono`)
// Both are variable fonts, so every weight comes from one file and nothing is
// faux-bolded.
import { DM_Sans, Manrope } from "next/font/google";

export const headingFont = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const bodyFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});
