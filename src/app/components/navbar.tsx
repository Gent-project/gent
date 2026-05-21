import React from "react";
import Container from "../common/container";
import Button from "../common/button";
import LanguageButton from "../common/language-buttom.component";
import Logo from "./logo";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import CustomDrawer from "./Drawer";
import { FaUser } from "react-icons/fa";
import LoggedInWrapper from "../common/logged-in-wrapper";
export default async function Navbar() {
  const t = await getTranslations();

  return (
    <Container className="flex w-full items-center justify-between rounded-3xl text-black">
      <Logo />
      <div className="flex items-center justify-around gap-10 max-md:hidden lg:gap-12">
        <Link href="/">
          <p className="cursor-pointer text-gray-500 transition-colors duration-300 hover:text-black">
            {t("Home")}
          </p>
        </Link>
        <Link href={"/cities"}>
          <p className="cursor-pointer text-gray-500 transition-colors duration-300 hover:text-black">
            {t("Cities")}
          </p>
        </Link>
        <Link href={"/attractions"}>
          <p className="cursor-pointer text-gray-500 transition-colors duration-300 hover:text-black">
            {t("Destination")}
          </p>
        </Link>
        <Link href={"/plans"}>
          <p className="cursor-pointer text-gray-500 transition-colors duration-300 hover:text-black">
            {t("Plans")}
          </p>
        </Link>
        <Link href={"/blogs"}>
          <p className="cursor-pointer text-gray-500 transition-colors duration-300 hover:text-black">
            {t("Blogs")}
          </p>
        </Link>
        <Link href={"/about"}>
          <p className="cursor-pointer text-gray-500 transition-colors duration-300 hover:text-black">
            {t("About")}
          </p>
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <div className="sm:m-2 sm:w-20 sm:border-e-2 sm:border-gray-300">
          <LanguageButton />
        </div>
        <LoggedInWrapper not>
          <Link href={"/register"}>
            <Button className="max-md:hidden">{t("Register")}</Button>
          </Link>
        </LoggedInWrapper>
        <LoggedInWrapper not>
          <Link href={"/login"}>
            <Button className="max-md:hidden">{t("Login")}</Button>
          </Link>
        </LoggedInWrapper>

        <LoggedInWrapper>
          <Link href="/profile">
            <div className="ml-4 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 transition hover:bg-gray-200">
              <FaUser size={24} color="gray" />
            </div>
          </Link>
        </LoggedInWrapper>

        <CustomDrawer />
      </div>
    </Container>
  );
}
