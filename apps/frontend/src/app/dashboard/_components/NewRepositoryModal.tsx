"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, Globe, Loader2, AlertTriangle } from "lucide-react";
import { getDashboardTheme } from "./dashboard-theme";
import { useCreateRepository } from "@/hooks/use-repositories";
import { CreateRepositoryRequest } from "@/types/repository";

const getApiErrorMessage = (error: any, fallback: string) => {
  const data = error?.response?.data;

  if (!data) return error?.message || fallback;
  if (typeof data === "string") return data;
  if (data.error) return Array.isArray(data.error) ? data.error[0] : data.error;
  if (data.detail) {
    return Array.isArray(data.detail) ? data.detail[0] : data.detail;
  }
  if (data.message) {
    return Array.isArray(data.message) ? data.message[0] : data.message;
  }
  if (data.name) return Array.isArray(data.name) ? data.name[0] : data.name;

  return fallback;
};

interface NewRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  onCreate: (repo: {
    name: string;
    description: string;
    isPrivate: boolean;
  }) => Promise<void>;
}

export default function NewRepositoryModal({
  isOpen,
  onClose,
  isDark,
}: NewRepositoryModalProps) {
  const t = getDashboardTheme(isDark);
  const [formData, setFormData] = useState<CreateRepositoryRequest>({
    name: "",
    description: "",
    is_private: false,
    default_branch: "main",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createRepository = useCreateRepository();

  useEffect(() => {
    if (!isOpen) {
      setFormData({
        name: "",
        description: "",
        is_private: false,
        default_branch: "main",
      });
      setErrors({});
      return;
    }

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Repository name is required";
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.name)) {
      newErrors.name =
        "Repository name can only contain letters, numbers, hyphens, and underscores";
    } else if (formData.name.length < 2) {
      newErrors.name = "Repository name must be at least 2 characters";
    } else if (formData.name.length > 100) {
      newErrors.name = "Repository name must be less than 100 characters";
    }

    if (formData.description && formData.description.length > 350) {
      newErrors.description = "Description must be less than 350 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      await createRepository.mutateAsync(formData);
      onClose();
    } catch (error: any) {
      console.error("Failed to create repository:", error);
      setErrors({
        form: getApiErrorMessage(error, "Failed to create repository."),
      });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto w-full max-w-lg max-h-[85vh] flex flex-col rounded-xl border shadow-2xl"
              style={{
                backgroundColor: t.elevated,
                borderColor: t.border,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
                style={{ borderColor: t.border }}
              >
                <h2 className="text-lg font-semibold" style={{ color: t.text }}>
                  Create a new repository
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                  style={{ color: t.textMuted }}
                  disabled={createRepository.isPending}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content with Scroll */}
              <form
                onSubmit={handleSubmit}
                className="flex flex-col flex-1 min-h-0"
              >
                <div className="px-5 py-4 space-y-4 overflow-y-auto">
                  {/* Error Alert */}
                  {(createRepository.error || errors.form) && (
                    <div
                      className="flex items-start gap-3 p-3 rounded-lg border text-sm"
                      style={{
                        backgroundColor: "#fff1f3",
                        borderColor: "#f85149",
                        color: "#cf222e",
                      }}
                    >
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Failed to create repository</strong>
                        <p className="mt-1">
                          {errors.form ||
                            getApiErrorMessage(
                              createRepository.error,
                              "An unexpected error occurred",
                            )}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Repository Name */}
                  <div>
                    <label
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: t.text }}
                    >
                      Repository name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="my-awesome_repo"
                      disabled={createRepository.isPending}
                      className={`w-full px-3 py-2 text-sm rounded-md border outline-none transition-colors focus:ring-2 ${
                        errors.name
                          ? "border-red-500 focus:ring-red-500/20"
                          : "focus:ring-violet-500/20"
                      }`}
                      style={{
                        backgroundColor: t.inputBg,
                        borderColor: errors.name ? "#f85149" : t.border,
                        color: t.text,
                      }}
                    />
                    {errors.name && (
                      <p className="text-xs text-red-500 mt-1">{errors.name}</p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: t.text }}
                    >
                      Description{" "}
                      <span
                        className="font-normal"
                        style={{ color: t.textMuted }}
                      >
                        (optional)
                      </span>
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      placeholder="A short description of your repository"
                      rows={2}
                      disabled={createRepository.isPending}
                      className={`w-full px-3 py-2 text-sm rounded-md border outline-none transition-colors focus:ring-2 resize-none ${
                        errors.description
                          ? "border-red-500 focus:ring-red-500/20"
                          : "focus:ring-violet-500/20"
                      }`}
                      style={{
                        backgroundColor: t.inputBg,
                        borderColor: errors.description ? "#f85149" : t.border,
                        color: t.text,
                      }}
                    />
                    {errors.description && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.description}
                      </p>
                    )}
                  </div>

                  {/* Visibility */}
                  <fieldset
                    className="space-y-2"
                    disabled={createRepository.isPending}
                  >
                    <legend
                      className="text-sm font-medium mb-2"
                      style={{ color: t.text }}
                    >
                      Visibility
                    </legend>
                    <label
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        !formData.is_private ? "ring-2 ring-violet-500/20" : ""
                      }`}
                      style={{
                        borderColor: !formData.is_private
                          ? t.accent
                          : t.border,
                        backgroundColor: !formData.is_private
                          ? t.accentMuted
                          : "transparent",
                      }}
                    >
                      <input
                        type="radio"
                        name="visibility"
                        checked={!formData.is_private}
                        onChange={() =>
                          setFormData({ ...formData, is_private: false })
                        }
                        className="mt-1 cursor-pointer accent-violet-600"
                      />
                      <div>
                        <div
                          className="flex items-center gap-2 text-sm font-medium"
                          style={{ color: t.text }}
                        >
                          <Globe className="w-4 h-4" />
                          Public
                        </div>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: t.textMuted }}
                        >
                          Anyone can see this repository
                        </p>
                      </div>
                    </label>
                    <label
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        formData.is_private ? "ring-2 ring-violet-500/20" : ""
                      }`}
                      style={{
                        borderColor: formData.is_private ? t.accent : t.border,
                        backgroundColor: formData.is_private
                          ? t.accentMuted
                          : "transparent",
                      }}
                    >
                      <input
                        type="radio"
                        name="visibility"
                        checked={formData.is_private}
                        onChange={() =>
                          setFormData({ ...formData, is_private: true })
                        }
                        className="mt-1 cursor-pointer accent-violet-600"
                      />
                      <div>
                        <div
                          className="flex items-center gap-2 text-sm font-medium"
                          style={{ color: t.text }}
                        >
                          <Lock className="w-4 h-4" />
                          Private
                        </div>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: t.textMuted }}
                        >
                          You choose who can see this repository
                        </p>
                      </div>
                    </label>
                  </fieldset>
                </div>

                {/* Footer Buttons */}
                <div
                  className="flex justify-end gap-2 px-5 py-4 border-t flex-shrink-0"
                  style={{ borderColor: t.border }}
                >
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={createRepository.isPending}
                    className="px-4 py-2 text-sm font-medium rounded-md border transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    style={{
                      borderColor: t.border,
                      color: t.text,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      createRepository.isPending || !formData.name.trim()
                    }
                    className="px-4 py-2 text-sm font-semibold rounded-lg transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                    style={{
                      background: t.accentGradient,
                      color: t.successText,
                    }}
                  >
                    {createRepository.isPending && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    {createRepository.isPending
                      ? "Creating..."
                      : "Create repository"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
