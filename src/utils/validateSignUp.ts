interface SignUpData {
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
}

export const validateSignUp = (data: SignUpData): string | null => {
  const { email, password, password_confirm, first_name, last_name } = data;

  // Check required fields
  if (!email || !password || !password_confirm || !first_name || !last_name) {
    return 'All fields are required';
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }

  // Validate password match
  if (password !== password_confirm) {
    return 'Passwords do not match';
  }

  // Validate password strength
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }

  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }

  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain at least one special character';
  }

  // Validate name fields
  if (first_name.length < 2) {
    return 'First name is too short';
  }

  if (last_name.length < 2) {
    return 'Last name is too short';
  }

  return null; // No errors
};
