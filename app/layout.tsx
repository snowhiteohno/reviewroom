import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ReviewRoom | Your creative workspace",
  description:
    "A thoughtful space to share designs, collect feedback, and bring projects together.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
