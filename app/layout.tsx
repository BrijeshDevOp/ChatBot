import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Groq Chat — AI Powered Conversations",
  description:
    "A professional AI chatbot powered by Groq's lightning-fast LPU inference. Experience intelligent conversations with a clean, focused interface.",
  keywords: ["AI", "chatbot", "Groq", "LLM", "artificial intelligence"],
  authors: [{ name: "Groq Chat" }],
  openGraph: {
    title: "Groq Chat — AI Powered Conversations",
    description: "Lightning-fast AI conversations powered by Groq",
    type: "website",
  },
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
