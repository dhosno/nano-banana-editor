import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nano Banana Editor",
  description:
    "An AI-powered iterative image editor. Upload a photo, describe an edit, and Google Gemini's \"Nano Banana\" model does the rest.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
