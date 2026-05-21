import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AUTH_PATH } from "@/routes/path";
interface LoginButtonProps {
  onClick: () => void;
}

export default function LoginButton({ onClick }: LoginButtonProps) {
  return (
    <Link href={AUTH_PATH.REPOS} className="w-full">
      <Button
        onClick={onClick}
        className="w-full cursor-pointer mt-4 bg-[#5A7863] text-[#EBF4DD] hover:bg-[#3B4953] transition-all duration-300"
      >
        Login
      </Button>
    </Link>
  );
}
