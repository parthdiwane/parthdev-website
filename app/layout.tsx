import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Parth | Developer",
  description:
    "Portfolio for Parth Diwane featuring research, experience, projects, publications, and contact.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
