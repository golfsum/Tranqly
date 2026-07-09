export type PasswordRuleState = {
  minLength: boolean;
  uppercase: boolean;
  number: boolean;
  special: boolean;
};

export type PasswordStrength = "Weak" | "Okay" | "Strong";

export function getPasswordRuleState(password: string): PasswordRuleState {
  return {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

export function passwordRuleItems(password: string) {
  const rules = getPasswordRuleState(password);
  return [
    { key: "minLength", label: "8 characters minimum", met: rules.minLength },
    { key: "uppercase", label: "1 uppercase letter", met: rules.uppercase },
    { key: "number", label: "1 number", met: rules.number },
    { key: "special", label: "1 special character", met: rules.special },
  ] as const;
}

export function getPasswordStrength(password: string): PasswordStrength {
  const rules = getPasswordRuleState(password);
  const metCount = Object.values(rules).filter(Boolean).length;
  if (rules.minLength && metCount === 4 && password.length >= 10) return "Strong";
  if (password.length >= 8 && metCount >= 3) return "Okay";
  return "Weak";
}

export function isPasswordValid(password: string) {
  const rules = getPasswordRuleState(password);
  return Object.values(rules).every(Boolean);
}
