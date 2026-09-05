"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Settings,
  Save,
  AlertTriangle,
  Lock,
  Globe,
  Users,
  UserPlus,
  X,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import {
  useRepository,
  useUpdateRepository,
  useDeleteRepository,
} from "@/hooks/use-repositories";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { getDashboardTheme } from "@/app/dashboard/_components/dashboard-theme";
import { DASHBOARD_PATH } from "@/routes/path";

import {
  useCollaborators,
  useAddCollaborator,
  useRemoveCollaborator,
} from "@/hooks/use-collaborators";
import { useBranches } from "@/hooks/use-branches";
import { getRepoOwner } from "@/lib/user-display";
export default function RepositorySettingsPage() {
  const params = useParams();
  const router = useRouter();
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const currentUserId = currentUser?.id ? Number(currentUser.id) : null;
  const ownerId = parseInt(params.owner_id as string);
  const repoName = params.repo_name as string;

  const { data: repository, isLoading } = useRepository(ownerId, repoName);
  const { data: branches = [], isLoading: isLoadingBranches } = useBranches(
    ownerId,
    repoName,
  );
  const updateRepository = useUpdateRepository();
  const deleteRepository = useDeleteRepository();

  const {
    data: collaborators = [],
    isLoading: isLoadingCollaborators,
    isError: isCollaboratorsError,
  } = useCollaborators(ownerId, repoName);

  const addCollaborator = useAddCollaborator();
  const removeCollaborator = useRemoveCollaborator();

  const [collaboratorEmail, setCollaboratorEmail] = useState("");
  const [collaboratorError, setCollaboratorError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const handleAddCollaborator = async () => {
    const email = collaboratorEmail.trim();

    if (!email) {
      setCollaboratorError("Please enter an email address.");
      return;
    }

    setCollaboratorError("");

    try {
      await addCollaborator.mutateAsync({
        ownerId,
        repoName,
        email,
        role: "write",
      });

      setCollaboratorEmail("");
    } catch (error: any) {
      console.error("Failed to add collaborator:", error);

      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.email?.[0] ||
        error?.response?.data?.error ||
        "Failed to add collaborator.";

      setCollaboratorError(message);
    }
  };

  const handleRemoveCollaborator = async (userId: number) => {
    setRemoveError("");

    // The current user cannot remove themselves
    if (currentUserId !== null && userId === currentUserId) {
      setRemoveError("You cannot remove yourself from this repository.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to remove this collaborator?",
    );

    if (!confirmed) return;

    try {
      await removeCollaborator.mutateAsync({
        ownerId,
        repoName,
        userId,
      });
    } catch (error: any) {
      console.error("Failed to remove collaborator:", error);

      setRemoveError(
        error?.response?.data?.detail ||
          error?.response?.data?.error ||
          "You do not have permission to remove this collaborator.",
      );
    }
  };
  const [removeError, setRemoveError] = useState("");
  const [formData, setFormData] = useState({
    name: repository?.name || "",
    description: repository?.description || "",
    is_private: repository?.is_private || false,
    default_branch: repository?.default_branch || "main",
  });
  useEffect(() => {
    if (repository) {
      setFormData({
        name: repository.name || "",
        description: repository.description || "",
        is_private: repository.is_private || false,
        default_branch: repository.default_branch || "main",
      });
    }
  }, [repository]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const t = getDashboardTheme(isDark);

  if (isLoading || !repository) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-300 rounded w-1/3"></div>
          <div className="h-64 bg-gray-300 rounded"></div>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    setSaveError("");
    setSaveSuccess("");

    try {
      await updateRepository.mutateAsync({
        ownerId,
        repoName,
        data: formData,
      });

      setSaveSuccess("Repository settings updated successfully.");
    } catch (error: any) {
      console.error("Failed to update repository:", error);

      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        "You do not have permission to update this repository.";

      setSaveError(message);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmation !== repository.name) return;

    setDeleteError("");

    try {
      await deleteRepository.mutateAsync({
        ownerId,
        repoName,
      });

      router.push("/dashboard");
    } catch (error: any) {
      console.error("Failed to delete repository:", error);

      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "You do not have permission to delete this repository.";

      setDeleteError(message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Link
          href={DASHBOARD_PATH.REPOSITORY(ownerId, repoName)}
          className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          style={{ color: t.textMuted }}
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: t.text }}>
            Repository Settings
          </h1>
          <p className="text-sm" style={{ color: t.textMuted }}>
            {getRepoOwner(repository)}/{repository.name}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* General Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border p-6"
          style={{
            backgroundColor: t.elevated,
            borderColor: t.border,
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5" style={{ color: t.accent }} />
            <h2 className="text-lg font-semibold" style={{ color: t.text }}>
              General
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: t.text }}
              >
                Repository name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 text-sm rounded-lg border"
                style={{
                  backgroundColor: t.inputBg,
                  borderColor: t.border,
                  color: t.text,
                }}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: t.text }}
              >
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg border resize-none"
                style={{
                  backgroundColor: t.inputBg,
                  borderColor: t.border,
                  color: t.text,
                }}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: t.text }}
              >
                Default branch
              </label>

              <select
                value={formData.default_branch}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    default_branch: e.target.value,
                  })
                }
                disabled={isLoadingBranches || branches.length === 0}
                className="w-full px-3 py-2 text-sm rounded-lg border"
                style={{
                  backgroundColor: t.inputBg,
                  borderColor: t.border,
                  color: t.text,
                  colorScheme: isDark ? "dark" : "light",
                }}
              >
                {isLoadingBranches ? (
                  <option value="">Loading branches...</option>
                ) : branches.length === 0 ? (
                  <option value="">No branches available</option>
                ) : (
                  branches.map((branch) => (
                    <option
                      key={branch.name}
                      value={branch.name}
                      style={{
                        backgroundColor: t.inputBg,
                        color: t.text,
                      }}
                    >
                      {branch.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            {/* Collaborators */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-lg border p-6"
              style={{
                backgroundColor: t.elevated,
                borderColor: t.border,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-5 h-5" style={{ color: t.accent }} />

                <h2 className="text-lg font-semibold" style={{ color: t.text }}>
                  Collaborators
                </h2>
              </div>

              <p className="text-sm mb-6" style={{ color: t.textMuted }}>
                Manage who can access and push changes to this repository.
              </p>

              {/* Invite */}
              <div
                className="rounded-lg border p-4 mb-6"
                style={{
                  borderColor: t.border,
                  backgroundColor: t.inputBg,
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <UserPlus className="w-4 h-4" style={{ color: t.accent }} />

                  <h3
                    className="text-sm font-semibold"
                    style={{ color: t.text }}
                  >
                    Invite collaborator
                  </h3>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    value={collaboratorEmail}
                    onChange={(e) => {
                      setCollaboratorEmail(e.target.value);
                      setCollaboratorError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddCollaborator();
                      }
                    }}
                    placeholder="classmate@example.com"
                    className="flex-1 px-3 py-2 text-sm rounded-lg border"
                    style={{
                      backgroundColor: t.elevated,
                      borderColor: t.border,
                      color: t.text,
                    }}
                    disabled={addCollaborator.isPending}
                  />

                  <button
                    onClick={handleAddCollaborator}
                    disabled={
                      addCollaborator.isPending || !collaboratorEmail.trim()
                    }
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
                    style={{
                      backgroundColor: t.accent,
                      color: t.successText,
                    }}
                  >
                    {addCollaborator.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Inviting...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Invite
                      </>
                    )}
                  </button>
                </div>

                {collaboratorError && (
                  <p className="mt-2 text-sm text-red-500">
                    {collaboratorError}
                  </p>
                )}

                <p className="text-xs mt-2" style={{ color: t.textMuted }}>
                  Collaborators are given read and write access.
                </p>
              </div>

              {/* Members */}
              <div>
                {removeError && (
                  <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
                    <p className="text-sm text-red-500">{removeError}</p>
                  </div>
                )}
                <h3
                  className="text-sm font-semibold mb-3"
                  style={{ color: t.text }}
                >
                  People with access
                </h3>

                {isLoadingCollaborators ? (
                  <div className="space-y-3">
                    {[1, 2].map((item) => (
                      <div
                        key={item}
                        className="h-16 rounded-lg animate-pulse"
                        style={{
                          backgroundColor: t.inputBg,
                        }}
                      />
                    ))}
                  </div>
                ) : isCollaboratorsError ? (
                  <div
                    className="rounded-lg border p-4 text-sm text-red-500"
                    style={{ borderColor: t.border }}
                  >
                    Failed to load collaborators.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {collaborators.length === 0 ? (
                      <div
                        className="text-center py-8 rounded-lg border border-dashed"
                        style={{
                          borderColor: t.border,
                        }}
                      >
                        <Users
                          className="w-8 h-8 mx-auto mb-2"
                          style={{ color: t.textMuted }}
                        />

                        <p className="text-sm" style={{ color: t.textMuted }}>
                          No collaborators yet.
                        </p>
                      </div>
                    ) : (
                      collaborators.map((member) => (
                        <div
                          key={member.user_id}
                          className="flex items-center justify-between gap-3 rounded-lg border p-3"
                          style={{
                            borderColor: t.border,
                            backgroundColor: t.inputBg,
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                              style={{
                                backgroundColor: t.elevated,
                                color: t.textMuted,
                              }}
                            >
                              <span className="text-sm font-semibold">
                                {member.email?.charAt(0)?.toUpperCase() || "U"}
                              </span>
                            </div>

                            <div className="min-w-0">
                              <p
                                className="text-sm font-medium truncate"
                                style={{ color: t.text }}
                              >
                                {member.email}
                              </p>

                              <p
                                className="text-xs"
                                style={{ color: t.textMuted }}
                              >
                                Added{" "}
                                {new Date(
                                  member.created_at,
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className="hidden sm:inline-block px-2 py-1 rounded-md text-xs font-medium"
                              style={{
                                backgroundColor: t.elevated,
                                color: t.textMuted,
                              }}
                            >
                              {member.role === "owner"
                                ? "Owner"
                                : member.role === "read"
                                  ? "Read"
                                  : "Read & Write"}
                            </span>

                            {member.role !== "owner" && (
                              <button
                                onClick={() =>
                                  handleRemoveCollaborator(member.user_id)
                                }
                                disabled={removeCollaborator.isPending}
                                className="p-2 rounded-lg transition-colors hover:bg-red-500/10 disabled:opacity-50"
                                title="Remove collaborator"
                              >
                                <X className="w-4 h-4 text-red-500" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </motion.div>
            <div>
              <label
                className="block text-sm font-medium mb-3"
                style={{ color: t.text }}
              >
                Visibility
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    checked={!formData.is_private}
                    onChange={() =>
                      setFormData({ ...formData, is_private: false })
                    }
                    className="mt-1"
                  />
                  <div>
                    <div
                      className="flex items-center gap-2 text-sm font-medium"
                      style={{ color: t.text }}
                    >
                      <Globe className="w-4 h-4" />
                      Public
                    </div>
                    <p className="text-xs mt-1" style={{ color: t.textMuted }}>
                      Anyone can see this repository.
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    checked={formData.is_private}
                    onChange={() =>
                      setFormData({ ...formData, is_private: true })
                    }
                    className="mt-1"
                  />
                  <div>
                    <div
                      className="flex items-center gap-2 text-sm font-medium"
                      style={{ color: t.text }}
                    >
                      <Lock className="w-4 h-4" />
                      Private
                    </div>
                    <p className="text-xs mt-1" style={{ color: t.textMuted }}>
                      You choose who can see and commit to this repository.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-4">
              {saveError && (
                <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
                  <p className="text-sm text-red-500">{saveError}</p>
                </div>
              )}

              {saveSuccess && (
                <div className="mb-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
                  <p className="text-sm text-green-500">{saveSuccess}</p>
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={updateRepository.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: t.accent,
                  color: t.successText,
                }}
              >
                <Save className="w-4 h-4" />
                {updateRepository.isPending ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-lg border p-6"
          style={{
            backgroundColor: isDark ? "#ffeef0" : "#fff5f5",
            borderColor: "#f87171",
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-red-600 mb-1">
                Delete this repository
              </h3>
              <p className="text-sm text-red-500">
                Once you delete a repository, there is no going back.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Delete repository
            </button>
          </div>
        </motion.div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setShowDeleteModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-md rounded-lg border p-6"
            style={{
              backgroundColor: t.elevated,
              borderColor: t.border,
            }}
          >
            <h3 className="text-lg font-semibold mb-2 text-red-600">
              Delete Repository
            </h3>
            <p className="text-sm mb-4" style={{ color: t.textMuted }}>
              This action cannot be undone. Type{" "}
              <strong>{repository.name}</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={repository.name}
              className="w-full px-3 py-2 mb-4 text-sm rounded-lg border"
              style={{
                backgroundColor: t.inputBg,
                borderColor: t.border,
                color: t.text,
              }}
            />
            {deleteError && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
                <p className="text-sm text-red-500">{deleteError}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 text-sm rounded-lg border"
                style={{
                  borderColor: t.border,
                  color: t.text,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={
                  deleteConfirmation !== repository.name ||
                  deleteRepository.isPending
                }
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleteRepository.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
