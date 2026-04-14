import { NextResponse } from "next/server";
import axios from "@/lib/axios";
import { AxiosError } from "axios";

export const dynamic = "force-dynamic";

interface ErrorResponse {
  message?: string;
}

// Helper: Add CORS headers to any response
const withCors = (response: NextResponse) => {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
};

// Handle preflight requests
export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return withCors(
        NextResponse.json({ error: "Email and password are required" }, { status: 400 })
      );
    }

    // Send login request using axios instance
    const response = await axios.post("/auth/login", { email, password });

    // Return successful response
    return withCors(new NextResponse(JSON.stringify(response.data), { status: 200 }));
  } catch (error: unknown) {
    console.error("Login error:", error);

    // Error from external API
    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      return withCors(
        NextResponse.json(
          { error: axiosError.response?.data?.message || "Login error occurred" },
          { status: axiosError.response?.status || 500 }
        )
      );
    }

    // Server error
    return withCors(
      NextResponse.json({ error: "Server error occurred" }, { status: 500 })
    );
  }
}
