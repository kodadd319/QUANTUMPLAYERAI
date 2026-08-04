export const ADMIN_EMAILS = ["jkoehler319@gmail.com", "jtothek319@gmail.com"];

export const isAdminUserEmail = (email?: string | null): boolean => {
  if (email && ADMIN_EMAILS.includes(email.toLowerCase().trim())) {
    return true;
  }
  const override = typeof window !== "undefined" ? localStorage.getItem("quantumplayer_admin_override") : null;
  if (override && ADMIN_EMAILS.includes(override.toLowerCase().trim())) {
    return true;
  }
  return false;
};

export const getAdminEmailDisplay = (email?: string | null): string => {
  if (email) return email;
  const override = typeof window !== "undefined" ? localStorage.getItem("quantumplayer_admin_override") : null;
  if (override && ADMIN_EMAILS.includes(override.toLowerCase().trim())) {
    return override;
  }
  return "jtothek319@gmail.com";
};
