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
          ? "bg-[#7dd3fc] text-[#0f1419] hover:bg-[#06b6d4] hover:shadow-lg hover:shadow-cyan-500/50"
          : "bg-[#5A7863] text-white hover:bg-[#4a6853] hover:shadow-lg hover:shadow-green-500/50"
      }`}
    >
      Sign In
    </Button>
  );
}
