import { SiteHeader } from "@/components/brand/SiteHeader";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = { title: "Sign in — arc" };

export default function LoginPage() {
  return (<><SiteHeader /><AuthForm mode="login" /></>);
}
