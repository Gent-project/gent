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
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
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
        NextResponse.json(
          { error: "Email and password are required" },
          { status: 400 },
        ),
      );
    }

    // Send login request using axios instance (with trailing slash to match API endpoint)
    const response = await axios.post("/auth/login/", { email, password });

    // Return successful response
    return withCors(
      new NextResponse(JSON.stringify(response.data), { status: 200 }),
    );
  } catch (error: unknown) {
    console.error("Login error:", error);

    // Error from external API
    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as AxiosError<any>;
      const errorData = axiosError.response?.data;

      let errorMessage = "Login error occurred";

      // Handle various error response formats from backend
      if (typeof errorData === "string") {
        errorMessage = errorData;
      } else if (errorData?.error) {
        errorMessage = errorData.error;
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      } else if (errorData?.detail) {
        errorMessage = errorData.detail;
      }

      console.error("Backend error details:", errorData);

      return withCors(
        NextResponse.json(
          { error: errorMessage },
          { status: axiosError.response?.status || 500 },
        ),
      );
    }

    // Server error
    return withCors(
      NextResponse.json({ error: "Server error occurred" }, { status: 500 }),
    );
  }
}
