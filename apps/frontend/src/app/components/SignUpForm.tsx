"use client";

import { useState } from "react";
import InputField from "./InputField";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";
import { motion } from "framer-motion";
import { validateSignUp } from "@/utils/validateSignUp";
import { AUTH_PATH } from "@/routes/path";
import axios from "@/lib/axios";
import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface SignUpData {
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
}

interface ApiError {
  error?: string;
  detail?: string;
  email?: string | string[];
  password?: string | string[];
  first_name?: string | string[];
  last_name?: string | string[];
  non_field_errors?: string | string[];
}

export default function SignUpForm() {
  const router = useRouter();

  const [formData, setFormData] = useState<SignUpData>({
    email: "",
    password: "",
    password_confirm: "",
    first_name: "",
    last_name: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // إزالة الخطأ عند تعديل أي حقل
    if (error) {
      setError("");
    }
  };

  const getApiErrorMessage = (data: ApiError | string | undefined) => {
    if (!data) {
      return "Sign up failed";
    }

    if (typeof data === "string") {
      return data;
    }

    if (data.error) {
      return data.error;
    }

    if (data.detail) {
      return data.detail;
    }

    if (data.email) {
      return Array.isArray(data.email) ? data.email[0] : data.email;
    }

    if (data.password) {
      return Array.isArray(data.password) ? data.password[0] : data.password;
    }

    if (data.first_name) {
      return Array.isArray(data.first_name)
        ? data.first_name[0]
        : data.first_name;
    }

    if (data.last_name) {
      return Array.isArray(data.last_name) ? data.last_name[0] : data.last_name;
    }

    if (data.non_field_errors) {
      return Array.isArray(data.non_field_errors)
        ? data.non_field_errors[0]
        : data.non_field_errors;
    }

    return "Sign up failed";
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;

    setError("");

    const validationError = validateSignUp(formData);

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post("/auth/register/", formData);

      router.push(`${AUTH_PATH.LOGIN}?signup=success`);
    } catch (err: unknown) {
      if (isAxiosError(err)) {
        const data = err.response?.data;

        if (data?.email) {
          setError(Array.isArray(data.email) ? data.email[0] : data.email);
        } else if (data?.password) {
          setError(
            Array.isArray(data.password) ? data.password[0] : data.password,
          );
        } else if (data?.detail) {
          setError(data.detail);
        } else if (data?.error) {
          setError(data.error);
        } else {
          setError("Sign up failed");
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Sign up failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        staggerChildren: 0.1,
        duration: 0.5,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 w-full">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-4"
      >
        {/* Error Message */}
        {error && (
          <div
            role="alert"
            className="mb-4 w-full rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive"
          >
            {error}
          </div>
        )}

        {/* Names */}
        <motion.div className="grid grid-cols-2 gap-4" variants={itemVariants}>
          <InputField
            label="First Name"
            type="text"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            placeholder="John"
            required
          />

          <InputField
            label="Last Name"
            type="text"
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            placeholder="Doe"
            required
          />
        </motion.div>

        {/* Email */}
        <motion.div variants={itemVariants}>
          <InputField
            label="Email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="user@example.com"
            required
          />
        </motion.div>

        {/* Password */}
        <motion.div className="relative" variants={itemVariants}>
          <InputField
            label="Password"
            type={showPassword ? "text" : "password"}
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            required
          />

          {/* Eye button MUST be button, not submit */}
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-9 text-faint transition-colors hover:text-fg"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <AiFillEyeInvisible size={20} />
            ) : (
              <AiFillEye size={20} />
            )}
          </button>
        </motion.div>

        {/* Confirm Password */}
        <motion.div variants={itemVariants}>
          <InputField
            label="Confirm Password"
            type="password"
            name="password_confirm"
            value={formData.password_confirm}
            onChange={handleChange}
            placeholder="••••••••"
            required
          />
        </motion.div>

        {/* Create Account */}
        <motion.button
          type="submit"
          disabled={isLoading}
          className="group relative w-full overflow-hidden rounded-xl bg-brand py-3 font-semibold text-brand-ink transition-all disabled:cursor-not-allowed disabled:opacity-70"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          variants={itemVariants}
        >
          <span className="anim-shimmer absolute inset-0" />
          <span className="relative">
            {isLoading ? "Creating account…" : "Create account"}
          </span>
        </motion.button>

        {/* Login */}
        <motion.div className="mt-4 text-center text-sm text-muted" variants={itemVariants}>
          Already have an account?{" "}
          <Link href={AUTH_PATH.LOGIN} className="font-medium text-brand hover:underline">
            sign in
          </Link>
        </motion.div>
      </motion.div>
    </form>
  );
}
