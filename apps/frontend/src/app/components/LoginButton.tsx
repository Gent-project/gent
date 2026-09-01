import { Button } from "@/components/ui/button";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

interface LoginButtonProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export default function LoginButton({ onClick }: LoginButtonProps) {
  const isDark = useSelector((state: RootState) => state.theme.isDark);

  return (
    <Button
      type="submit"
      onClick={onClick}
      className={`w-full cursor-pointer mt-4 font-bold transition-all duration-300 ${
        isDark
          ? "bg-gradient-to-r from-[#7dd3fc] to-[#06b6d4] text-[#0f1419] hover:shadow-lg hover:shadow-cyan-500/50"
          : "bg-gradient-to-r from-[#5A7863] to-[#4a6853] text-white hover:shadow-lg hover:shadow-green-500/50"
      }`}
    >
      Sign In
    </Button>
  );
}
