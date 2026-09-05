import { NextResponse } from 'next/server';
import axios from '@/lib/axios';
import { AxiosError } from 'axios';

export async function POST(request: Request) {
  // Handle CORS preflight request
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const { email, password, first_name, last_name } = await request.json();
    
    // Validate required fields
    if (!email || !password || !first_name || !last_name) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Send request to your authentication service
    const response = await axios.post('/auth/register', {
      email,
      password,
      first_name,
      last_name,
    });

    return new NextResponse(JSON.stringify(response.data), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error: AxiosError | unknown) {
    console.error('Signup error:', error);
    
    let errorMessage = 'An error occurred during signup';
    let statusCode = 500;

    if (error instanceof AxiosError && error.response) {
      // Error from the external API
      errorMessage = error.response.data?.message || errorMessage;
      statusCode = error.response.status;
    }

    return new NextResponse(
      JSON.stringify({ error: errorMessage }),
      {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  }
}

// Add CORS headers to all responses
export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
