export function validatePassword(password:string):string {
  const minLength = 6;
  const hasNumber = /\d/.test(password);
  const hasLetter = /[a-zA-Z]/.test(password);

  if (password.length < minLength) return "Password must be at least 6 characters.";
  if (!hasNumber) return "Password must contain at least one number.";
  if (!hasLetter) return "Password must contain at least one letter.";

  return "";
}
