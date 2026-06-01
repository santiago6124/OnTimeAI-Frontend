import { redirect } from "next/navigation";
import { getServerRole } from "@/lib/auth";

export default async function TesisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getServerRole();
  if (role !== "admin") redirect("/");
  return <>{children}</>;
}
