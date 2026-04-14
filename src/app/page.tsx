import { AUTH_PATH } from "@/routes/path";

export default function Home() {
  return (
    <div className="flex justify-center flex-col p-20 items-center text-[#57914b]">
     <h1>Coming Soon...</h1>
     <button  className="text-[#22331e] cursor-pointer bg-[#ffffff] hover:bg-accent">
      <a href={AUTH_PATH.LOGIN}> Get Started </a> 
     </button>
    </div>
  );
}
