import type { Metadata } from "next";
import SignupConfirmed from "@/components/auth/signup-confirmed";

export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false, follow: false } };
export default function ConfirmedPage() { return <SignupConfirmed />; }
