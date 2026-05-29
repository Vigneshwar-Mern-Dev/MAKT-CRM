import { redirect } from "next/navigation";

export default function RegisterPage() {
  // Public registration is disabled; redirect all traffic to sign in.
  redirect("/login");
}
