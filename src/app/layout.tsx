import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Klickkk : Performance Reports",
  description: "Multi-platform reporting dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
