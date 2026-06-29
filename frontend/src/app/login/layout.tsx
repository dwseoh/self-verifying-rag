import { AuthChrome } from "@/components/auth/auth-chrome";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthChrome>{children}</AuthChrome>;
}
