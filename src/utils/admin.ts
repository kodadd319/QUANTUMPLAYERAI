export const ADMIN_EMAILS = ["jkoehler319@gmail.com", "jtothek319@gmail.com"];
export const ADMIN_USERNAMES = ["jtothek319", "jkoehler319"];

export const isAdminUserEmail = (emailOrUsername?: string | null): boolean => {
  if (emailOrUsername) {
    const clean = emailOrUsername.toLowerCase().trim();
    if (ADMIN_EMAILS.includes(clean) || ADMIN_USERNAMES.includes(clean) || clean.startsWith("jtothek319@") || clean.startsWith("jkoehler319@")) {
      return true;
    }
  }
  const override = typeof window !== "undefined" ? localStorage.getItem("quantumplayer_admin_override") : null;
  if (override) {
    const clean = override.toLowerCase().trim();
    if (ADMIN_EMAILS.includes(clean) || ADMIN_USERNAMES.includes(clean) || clean.startsWith("jtothek319@") || clean.startsWith("jkoehler319@")) {
      return true;
    }
  }
  return false;
};

export const getAdminEmailDisplay = (email?: string | null): string => {
  if (email) return email;
  const override = typeof window !== "undefined" ? localStorage.getItem("quantumplayer_admin_override") : null;
  if (override && (ADMIN_EMAILS.includes(override.toLowerCase().trim()) || ADMIN_USERNAMES.includes(override.toLowerCase().trim()))) {
    return override;
  }
  return "jtothek319@gmail.com";
};
