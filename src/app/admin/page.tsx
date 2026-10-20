import type { Metadata } from "next";
import { Admin } from "@/components/Admin";

export const metadata: Metadata = { title: "Pain Cave Timer · Settings", robots: { index: false } };

export default function AdminPage() {
  return <Admin />;
}
