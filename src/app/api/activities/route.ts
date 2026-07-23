import { NextResponse } from "next/server";

const activities = [
  {
    id: "1",
    type: "repository_created",
    title: "Created repository",
    message: "Gent Platform",
    repository: { id: 10, name: "Gent" },
    actor: { id: 5, name: "Aya" },
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: "2",
    type: "push",
    title: "Pushed 3 commits",
    message: "main",
    repository: { id: 10, name: "Gent" },
    actor: { id: 5, name: "Aya" },
    created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
  {
    id: "3",
    type: "branch_created",
    title: "Created branch",
    message: "feature/login",
    repository: { id: 10, name: "Gent" },
    actor: { id: 5, name: "Aya" },
    created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: "4",
    type: "tag_created",
    title: "Created tag",
    message: "v1.0.0",
    repository: { id: 10, name: "Gent" },
    actor: { id: 5, name: "Aya" },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  },
  {
    id: "5",
    type: "pull_request",
    title: "Opened pull request",
    message: "#42 Review authentication flow",
    repository: { id: 10, name: "Gent" },
    actor: { id: 5, name: "Aya" },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

export async function GET() {
  return NextResponse.json(activities);
}
