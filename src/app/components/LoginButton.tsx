import { Button } from "@/components/ui/button";

interface LoginButtonProps {
  onClick: () => void;
}

export default function LoginButton({ onClick }: LoginButtonProps) {
  return (
    <Button
      onClick={onClick}
      className="w-full cursor-pointer mt-4 bg-[#5A7863] text-[#EBF4DD] hover:bg-[#3B4953] transition-all duration-300"
    >
      Login
    </Button>
  );
}
