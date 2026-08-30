import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/lib/toast-context";
import { NotificationCountProvider } from "@/lib/notification-count-context";
import { Sidebar } from "@/components/Sidebar";
import { RightSidebar } from "@/components/RightSidebar";
import { BottomNav } from "@/components/BottomNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SNS",
  description: "シンプルなSNSアプリ",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SNS",
  },
};

export const viewport = {
  themeColor: "#171717",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full pb-14 sm:pb-0">
        <ToastProvider>
          <AuthProvider>
            <NotificationCountProvider>
              <div className="min-h-full sm:flex sm:justify-center">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 sm:max-w-2xl bg-black/[0.015] dark:bg-white/[0.02]">
                  {children}
                </div>
                <RightSidebar />
              </div>
              <BottomNav />
            </NotificationCountProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
