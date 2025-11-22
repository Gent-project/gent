import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Input } from "postcss";

// import   { GoArrowRight } from "react-icons/go";

function page() {
  return (
    <div className="flex min-h-screen w-full h-full   items-center">
      <div className="h-dvh w-dvw ">
        <Image
          src="/register1.jpg"
          alt="Next.js logo"
          width={900}
          height={20}
          priority
        />
      </div>
      <div className="h-screen w-dvw ">
        <p className="flex justify-end me-9 p-4">
          <span>Already have an account?</span>
          <Link href={"/login"} style={{ color: "green" }}>
            Sign in
          </Link>
        </p>

        <div className="mx-auto w-full flex justify-center max-w-7xl px-3 py-5 sm:px-5">
          {" "}
          <div className=" flex justify-center  gap-2 flex-col ">
            <h2>Sign up for GitHub</h2>
            <div className="">
              <span>or</span>
            </div>
            <form action="" className="flex flex-col gap-1">
              <label htmlFor="">Email</label>
              <input
                type="text"
                placeholder="Email"
                className="rounded-sm  w-xs h-9 border-2 border-gray-300  mb-4"
              />
              <label htmlFor="">Password</label>
              <input
                type="password"
                placeholder="password"
                className="rounded-sm  w-xs h-9 border-2 border-gray-300  mb-4"
              />
              <label htmlFor="">UserName</label>
              <input
                type="text"
                placeholder="UserName"
                className="rounded-sm  w-xs h-9 border-2 border-gray-300  mb-4"
              />
              <label htmlFor="">Your Country/Region</label>
              <select className="rounded-sm  w-xs h-9 border-2 border-gray-300  mb-4">
                <option value="India">India</option>
                <option value="USA">USA</option>
                <option value="UK">UK</option>
                <option value="Canada">Canada</option>
                <option value="Australia">Australia</option>
              </select>
              <label>Email preferences</label>
              <div>
                <input type="checkbox" className="size-4" />
                <span className="p-2">
                  Receive occasional product updates and announcements
                </span>
              </div>
              <button
                type="submit"
                className="bg-black w-full h-12 rounded-md mt-4 text-white"
              >
                Create account
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default page;
