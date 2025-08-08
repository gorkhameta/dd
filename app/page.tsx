"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useRouter } from "next/navigation";

/**
 * Renders a centered "Login" button that navigates to the sign-in page when clicked.
 *
 * Displays a full-screen layout with a single button. Clicking the button routes the user to the "/sign-in" page using client-side navigation.
 */
export default function Home() {

  const router = useRouter();

  const onClick = () => {
    router.push("/sign-in");
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <Button onClick={onClick}>
        Login
      </Button>
    </div>
  );
}
