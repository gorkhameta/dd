"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useRouter } from "next/navigation";

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
