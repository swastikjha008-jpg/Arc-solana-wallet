import { SiteHeader } from "@/components/brand/SiteHeader";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = { title: "Create wallet — arc" };

export default function SignupPage() {
  return (<><SiteHeader /><AuthForm mode="signup" /></>);
}
