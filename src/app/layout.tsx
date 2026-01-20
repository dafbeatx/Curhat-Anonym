import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Curhat Anonim",
  description: "Tempat aman untuk meluapkan isi hati. Tanpa akun. Tanpa nama. Tanpa jejak.",
  openGraph: {
    title: "Curhat Anonim",
    description: "Tempat aman untuk meluapkan isi hati. Tanpa akun. Tanpa nama. Tanpa jejak.",
    url: "https://curhat-anonym.vercel.app/",
    siteName: "Curhat Anonim",
    images: [
      {
        url: "https://curhat-anonym.vercel.app/assets/thumbnail.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "id_ID",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" data-theme="light">
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
